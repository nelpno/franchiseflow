// Peso de produto a partir do nome. Módulo PURO (sem import.meta) — usado no
// front (form/PDF) E no script de seed em Node.

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|gramas?)\b/i;

// Lê a gramatura do nome e devolve em KG (number) ou null se nada casar.
// "700g"->0.7, "1kg"->1, "700 gramas"->0.7, "1,5 kg"->1.5.
export function parseWeightKg(productName) {
  if (!productName || typeof productName !== "string") return null;
  const m = productName.match(WEIGHT_RE);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  if (isNaN(value)) return null;
  const unit = m[2].toLowerCase();
  const kg = unit.startsWith("kg") ? value : value / 1000;
  return kg;
}

// Formata kg pra UI: "58,8 kg". null/0/NaN -> "—".
export function formatWeightKg(kg) {
  if (kg == null || isNaN(kg) || kg === 0) return "—";
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

// Resolve o peso unitário de um item: override persistido > parser do nome > null.
export function getItemWeightKg(item, weightMap) {
  if (!item) return null;
  const name = item.product_name;
  const override = weightMap && name != null ? weightMap[name] : undefined;
  if (override != null) return Number(override);
  return parseWeightKg(name);
}
