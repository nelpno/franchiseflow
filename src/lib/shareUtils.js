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
 * Shares an image via Web Share API (mobile) or downloads it (desktop).
 * @param {Blob} blob - The image blob to share
 * @param {string} filename - Filename for the image
 */
export async function shareImage(blob, filename = "comprovante.png") {
  const file = new File([blob], filename, { type: "image/png" });

  // Try native share (mobile)
  if (navigator.canShare?.({ files: [file] })) {
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

  // Fallback desktop: print
  const url = URL.createObjectURL(blob);
  const printWindow = window.open("", "_blank", "width=450,height=600");
  if (printWindow) {
    const doc = printWindow.document;
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
      printWindow.print();
      printWindow.close();
      URL.revokeObjectURL(url);
    };
    doc.body.appendChild(img);
  } else {
    // Popup blocked — fallback to download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return true;
}
