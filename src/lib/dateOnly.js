import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Postgres DATE volta como "yyyy-MM-dd". new Date(str) interpreta como UTC
// midnight e em BRT (UTC-3) volta 1 dia. Estes helpers parseiam no fuso local.

export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDateOnly(value, pattern = "dd/MM/yyyy") {
  const dt = parseDateOnly(value);
  if (!dt) return "";
  return format(dt, pattern, { locale: ptBR });
}
