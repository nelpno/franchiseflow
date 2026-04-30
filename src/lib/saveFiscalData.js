import { Franchise, FranchiseConfiguration } from "@/entities/all";

// Campos que vão para franchises
const FRANCHISE_FIELDS = [
  "billing_email",
  "cpf_cnpj",
  "address_number",
  "address_complement",
  "neighborhood",
  "state_uf",
  "city",
];

// Campos que vão para franchise_configurations
const CONFIG_FIELDS = ["street_address", "cep"];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// Grava dados fiscais em franchises + franchise_configurations.
// franchiseId: UUID da franchise
// evolutionInstanceId: evolution_instance_id (chave em franchise_configurations)
// data: objeto com qualquer subset de FRANCHISE_FIELDS e CONFIG_FIELDS
export async function saveFiscalData(franchiseId, evolutionInstanceId, data) {
  const franchisePatch = pick(data, FRANCHISE_FIELDS);
  const configPatch = pick(data, CONFIG_FIELDS);

  // Normaliza: strings vazias viram null (evita CHECK constraint e lixo no banco)
  for (const k of Object.keys(franchisePatch)) {
    if (franchisePatch[k] === "") franchisePatch[k] = null;
  }
  for (const k of Object.keys(configPatch)) {
    if (configPatch[k] === "") configPatch[k] = null;
  }

  if (Object.keys(franchisePatch).length > 0) {
    await Franchise.update(franchiseId, franchisePatch);
  }

  if (Object.keys(configPatch).length > 0 && evolutionInstanceId) {
    const configs = await FranchiseConfiguration.filter({
      franchise_evolution_instance_id: evolutionInstanceId,
    });
    if (configs[0]) {
      await FranchiseConfiguration.update(configs[0].id, configPatch);
    }
  }
}

// Retorna array de campos que faltam para a franquia ser considerada "fiscalmente completa"
// Usado pelo AsaasSetupPanel e FiscalDataGate.
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
