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
export function assembleUnitAddress({ street, number, complement, neighborhood, city, cep } = {}) {
  const streetFull = foldStreetNumber(street, number);
  const parts = [streetFull, String(complement || "").trim(), String(neighborhood || "").trim(), stripCityUf(city)]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
  const cp = String(cep || "").trim();
  return (parts + (cp ? ` - ${cp}` : "")).trim();
}

// Normaliza pra comparação de "isso já está escrito ali?" (caixa + pontuação do fim).
function comparable(s) {
  return String(s || "").trim().toLowerCase().replace(/[.,;\s]+$/, "");
}

// Endereço de entrega da unidade para a ficha do motorista.
//
// NÃO confia no `unit_address` gravado: ele é derivado e nasceu truncado em franquia
// nova (o cadastro só mandava rua+CEP ao saveFiscalData, ver Franchises.jsx) — foi o
// que fez as fichas de Leme e Itapevi saírem sem número/bairro/cidade em 23/08/2026,
// com o cadastro fiscal completo o tempo todo. Aqui a fonte são os COMPONENTES
// (franchises = cadastro fiscal, franchise_configurations = wizard) e o `unit_address`
// é só o fallback de quem não tem rua no cadastro.
//
// As três regras abaixo saíram das 66 unidades REAIS (26/08/2026), não de fixture.
export function resolveDeliveryAddress(franchise, config) {
  let street = String(config?.street_address || "").trim();
  const stored = String(config?.unit_address || "").trim();
  if (!street) return stored;

  // (1) "Rua X 000" / "Rua X 0" — zero é placeholder de quem não sabia o número na
  // hora do cadastro (6 unidades). Sai, e o número do cadastro fiscal entra no lugar.
  street = street.replace(/[\s,-]+0+\s*$/, "").trim() || street;

  // (2) Rua que JÁ termina em número traz o número dentro dela — não anexar o do
  // cadastro fiscal: em 7 unidades os dois divergem ("Gen. Longo, 43" x 53) e
  // anexar produziria "Gen. Longo, 43 53". Mesma convenção do wizard.
  const number = /\d\s*$/.test(street) ? "" : franchise?.address_number;

  // (3) Complemento que o franqueado já digitou dentro da rua não repete
  // ("Via das Magnólias 421 - Casa 52" + complemento "Casa 52").
  const rawComplement = String(franchise?.address_complement || "").trim();
  const complement = comparable(street).includes(comparable(rawComplement)) ? "" : rawComplement;

  return (
    assembleUnitAddress({
      street,
      number,
      complement,
      neighborhood: config?.neighborhood || franchise?.neighborhood,
      city: config?.city || franchise?.city,
      cep: config?.cep,
    }) || stored
  );
}
