import { Franchise, FranchiseConfiguration } from "@/entities/all";
import { assembleUnitAddress } from "@/lib/addressUtils";

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

// Campos que vão para franchise_configurations.
// bairro/cidade são copiados também pra config (o wizard "Meu Vendedor" lê daqui),
// mantendo config e cadastro fiscal em sincronia — senão um "salvar" no wizard,
// que carrega esses campos vazios, apagaria o endereço.
const CONFIG_FIELDS = ["street_address", "cep", "neighborhood", "city"];

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

  // Monta o unit_address (endereço do motorista) a partir do que foi enviado.
  // Assim, completar o cadastro fiscal (gate de onboarding ou edição admin) já
  // preenche o endereço — sem depender de abrir/salvar o wizard "Meu Vendedor".
  const assembledAddress = assembleUnitAddress({
    street: data.street_address,
    number: data.address_number,
    neighborhood: data.neighborhood,
    city: data.city,
    cep: data.cep,
  });
  if (assembledAddress) configPatch.unit_address = assembledAddress;

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
