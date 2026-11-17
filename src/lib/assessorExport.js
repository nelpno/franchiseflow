// Assessor do CS: planilha (CSV para o Excel BR), cópia de texto e impressão/PDF de uma resposta.
import { format } from "date-fns";
import { sanitizeCSVCell } from "@/lib/csvSanitize";

const celula = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : ""; // vírgula decimal (Excel BR)
  if (typeof v === "boolean") return v ? "sim" : "não";
  const s = sanitizeCSVCell(v).replace(/\r?\n/g, " ");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com BOM UTF-8 e `;` (abre certo no Excel brasileiro). */
export function tabelaParaCsv(tabela) {
  const linhas = [tabela.colunas.map(celula).join(";"), ...tabela.linhas.map((l) => l.map(celula).join(";"))];
  return `﻿${linhas.join("\r\n")}\r\n`;
}

export function baixarCsv(tabela) {
  const blob = new Blob([tabelaParaCsv(tabela)], { type: "text/csv;charset=utf-8" });
  const slug = String(tabela.titulo || "planilha").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `assessor-${slug}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Markdown simples → texto limpo para colar (negrito e títulos sem os símbolos). */
export function markdownParaTexto(md) {
  return String(md || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .trim();
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const CSS_IMPRESSAO = `
  body{font-family:Inter,Arial,sans-serif;color:#1c1917;margin:32px auto;max-width:720px;padding:0 20px;line-height:1.5;font-size:14px}
  header{border-bottom:3px solid #b91c1c;padding-bottom:10px;margin-bottom:18px}
  header b{font-size:18px;color:#b91c1c;letter-spacing:.02em}
  header span{display:block;color:#78716c;font-size:12px;margin-top:2px}
  h4{margin:14px 0 4px;font-size:14px}
  ul,ol{padding-left:22px}
  footer{margin-top:28px;color:#78716c;font-size:11px;border-top:1px solid #e7e5e4;padding-top:8px}
  @media print{body{margin:0}}
`;

/** Abre uma janela só com aquela resposta (cabeçalho da Maxi) e chama a impressão / salvar como PDF. */
export function imprimirResposta(el, { titulo = "Assessor do CS", unidade = "" } = {}) {
  if (!el) return false;
  const w = window.open("about:blank", "_blank", "width=820,height=900");
  if (!w) return false;
  const d = w.document;
  d.title = titulo;
  const estilo = d.createElement("style");
  estilo.textContent = CSS_IMPRESSAO;
  d.head.appendChild(estilo);
  const cab = d.createElement("header");
  const marca = d.createElement("b");
  marca.textContent = "MAXI MASSAS";
  const sub = d.createElement("span");
  sub.textContent = `${titulo}${unidade ? ` · ${unidade}` : ""} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  cab.append(marca, sub);
  const rodape = d.createElement("footer");
  rodape.textContent = "Gerado pelo Assessor do CS a partir dos dados do dashboard. Confira os números antes de usar em conversa externa.";
  d.body.append(cab, d.importNode(el, true), rodape);
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* usuário fecha a janela */ } }, 300);
  return true;
}
