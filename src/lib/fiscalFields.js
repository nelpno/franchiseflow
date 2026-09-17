// Regra pura: quais campos faltam para a franquia ser considerada "fiscalmente
// completa". Extraída de saveFiscalData.js (16/09/2026, trilha "Primeiros passos")
// para NÃO puxar @/entities/all — que inicializa o cliente Supabase via
// import.meta.env e quebra em `node arquivo.test.mjs` puro (fora do Vite).
// saveFiscalData.js reexporta esta função: quem já importava de lá continua igual.
//
// Usado pelo AsaasSetupPanel, FiscalDataGate, Onboarding.jsx e por
// src/lib/onboardingJourney.js (sinal automático "fiscal" do Passo 1).
export function missingFiscalFields(franchise, config) {
  const missing = [];
  if (!franchise?.billing_email) missing.push("email de cobrança");
  if (!franchise?.cpf_cnpj) missing.push("CPF/CNPJ");
  if (!config?.cep) missing.push("CEP");
  if (!config?.street_address) missing.push("rua");
  if (!franchise?.address_number) missing.push("número");
  if (!franchise?.neighborhood) missing.push("bairro");
  if (!franchise?.city) missing.push("cidade");
  if (!franchise?.state_uf) missing.push("UF");
  return missing;
}
