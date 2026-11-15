/**
 * Sanitiza valor de célula CSV contra formula injection.
 * Excel/LibreOffice executam fórmulas que começam com = + - @
 * Prefixar com tab character impede execução sem alterar visual.
 */
export function sanitizeCSVCell(value) {
  const s = String(value ?? "");
  if (s.length > 0 && "=+-@".includes(s[0])) {
    return "\t" + s;
  }
  return s;
}
