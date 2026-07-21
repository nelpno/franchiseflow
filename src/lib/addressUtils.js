// Montagem canônica do endereço da unidade (unit_address) — fonte ÚNICA de formato.
// Usado pelo fluxo fiscal (saveFiscalData) e pelo wizard "Meu Vendedor" (FranchiseSettings),
// pra que a ficha de separação do motorista (pickingSheetPdf) sempre receba o mesmo formato:
//   "Rua X 123, Bairro, Cidade - CEP"

// Remove sufixo de UF do fim da cidade ("Campo Limpo Paulista - SP" -> "Campo Limpo Paulista").
export function stripCityUf(city) {
  return String(city || "").replace(/[\s,-]+[A-Za-z]{2}\.?\s*$/, "").trim();
}

// Junta rua + número, SEM duplicar quando a rua já termina com aquele número
// (o wizard grava "rua e número" num campo só; o fiscal tem número separado).
export function foldStreetNumber(street, number) {
  const s = String(street || "").trim();
  const n = (number == null ? "" : String(number)).trim();
  if (!n) return s;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // já termina com o número como token isolado? (precedido por não-dígito ou início)
  if (new RegExp(`(?:^|\\D)${esc}$`).test(s)) return s;
  return s ? `${s} ${n}` : n;
}

// Monta o endereço final a partir dos componentes. Partes vazias somem (sem vírgula solta).
export function assembleUnitAddress({ street, number, neighborhood, city, cep } = {}) {
  const streetFull = foldStreetNumber(street, number);
  const parts = [streetFull, String(neighborhood || "").trim(), stripCityUf(city)]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
  const cp = String(cep || "").trim();
  return (parts + (cp ? ` - ${cp}` : "")).trim();
}
