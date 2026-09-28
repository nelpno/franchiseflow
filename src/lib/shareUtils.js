/**
 * Generates a PNG blob from a DOM element using html2canvas.
 * html2canvas is loaded dynamically to avoid 94KB in initial bundle.
 * @param {HTMLElement} element - The DOM element to capture
 * @returns {Promise<Blob>} PNG blob
 */
export async function generateReceiptImage(element) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
  });
}

/**
 * Detecta celular/tablet pra decidir entre Web Share (arquivo) e download direto.
 * P3 da S13 (28/09/2026, "não publicar"): `canShare({files})` sozinho NÃO basta — Chrome e
 * Edge no Windows também respondem `true` (têm o share sheet do sistema operacional), então
 * "Compartilhar" no computador abria aquele menu em vez de baixar o PNG como pedido.
 * Ordem de sinais (do mais confiável pro mais genérico):
 *   1. `navigator.userAgentData.mobile` (Client Hints, Chromium) — é exatamente essa pergunta;
 *   2. UA string clássica (cobre Safari/iOS e Firefox, que não têm userAgentData);
 *   3. `matchMedia("(pointer: coarse)")` — só como último recurso (notebook com touchscreen
 *      teria pointer coarse E fine; por isso vem depois da UA, não antes).
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
    return navigator.userAgentData.mobile;
  }
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
  if (typeof window !== "undefined" && window.matchMedia) {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Shares an image via Web Share API (mobile, files only) or downloads it (desktop).
 * S13.1 (28/09/2026): "Compartilhar" no computador BAIXA o PNG — não abre diálogo de impressão
 * nem o menu de compartilhamento do Windows (isso já é o botão "Imprimir" separado, que usa
 * printReceipt/HTML nítido pra térmica). A decisão é por DISPOSITIVO (isMobileDevice), não só
 * por `canShare` — Chrome/Edge no Windows respondem `canShare({files}) === true` também.
 * @param {Blob} blob - The image blob to share
 * @param {string} filename - Filename for the image
 */
export async function shareImage(blob, filename = "comprovante.png") {
  const file = new File([blob], filename, { type: "image/png" });

  // Native share só em celular/tablet — mesmo quando o navegador desktop diz que "pode".
  if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Comprovante de Venda",
      });
      return true;
    } catch (err) {
      // User cancelled share — not an error
      if (err.name === "AbortError") return false;
    }
  }

  // Fallback desktop (ou mobile sem suporte a Web Share): baixa o PNG.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Opens print dialog directly for a receipt image (mobile & desktop).
 * @param {Blob} blob - The image blob to print
 */
export async function printImage(blob) {
  const url = URL.createObjectURL(blob);

  // Create a hidden iframe for printing (works on mobile + desktop, no popup blocker)
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:450px;height:600px;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const style = doc.createElement("style");
  style.textContent =
    "@media print { @page { margin: 10mm; } body { margin: 0; } } " +
    "body { display: flex; justify-content: center; padding: 0; margin: 0; } " +
    "img { max-width: 100%; height: auto; }";
  doc.head.appendChild(style);
  doc.title = "Comprovante de Venda";

  const img = doc.createElement("img");
  img.src = url;
  img.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
  doc.body.appendChild(img);
}

/**
 * Converts all <img> src attributes in a cloned DOM tree to data URIs.
 * Prevents cross-origin/loading issues when injecting into an isolated iframe.
 */
async function convertImagesToDataUri(container) {
  const images = container.querySelectorAll("img");
  for (const img of images) {
    if (img.src.startsWith("data:")) continue;
    try {
      const response = await fetch(img.src);
      const blob = await response.blob();
      const dataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      img.src = dataUri;
    } catch {
      // Keep original src if conversion fails
    }
  }
}

/**
 * Prints a receipt by cloning the DOM element and printing native HTML/CSS.
 * Uses @page { size: 80mm auto } for thermal printer compatibility.
 * Unlike printImage(), this preserves crisp text instead of rasterizing to PNG.
 * @param {HTMLElement} element - The rendered receipt DOM element
 */
export async function printReceipt(element) {
  const clone = element.cloneNode(true);
  await convertImagesToDataUri(clone);

  // Override fixed pixel width so content adapts to any paper size
  clone.style.width = "100%";
  clone.style.maxWidth = "100%";
  clone.style.boxSizing = "border-box";

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:450px;height:600px;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      @page { size: auto; margin: 0; }
      @media print {
        html, body { margin: 0; padding: 0; width: 100%; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body { margin: 0; padding: 0; background: #fff; }
    </style>
  </head><body></body></html>`);
  doc.close();

  doc.body.appendChild(clone);

  await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 1000);
}
