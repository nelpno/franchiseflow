/**
 * Valida URL para uso em href — rejeita javascript: e outros protocolos perigosos.
 * Retorna "#" para URLs inválidas.
 */
export function safeHref(url) {
  if (!url || typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed; // relative paths OK
  return "#";
}
