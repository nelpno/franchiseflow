import { Franchise, FranchiseConfiguration } from "@/entities/all";
import { resolveDeliveryAddress } from "@/lib/addressUtils";
// missingFiscalFields é regra pura (sem @/entities/all) — mora em fiscalFields.js e é
// reexportada aqui para quem já importava de "@/lib/saveFiscalData" continuar igual.
export { missingFiscalFields } from "@/lib/fiscalFields";

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

  // Guarda ANTES de mexer no configPatch (que ainda ganha o unit_address montado
  // mais abaixo): "tem campo de configuração no patch" é sobre o que o CHAMADOR
  // pediu, não sobre o efeito colateral do assembly de endereço.
  const hasExplicitConfigFields = Object.keys(configPatch).length > 0;

  // Normaliza: strings vazias viram null (evita CHECK constraint e lixo no banco)
  for (const k of Object.keys(franchisePatch)) {
    if (franchisePatch[k] === "") franchisePatch[k] = null;
  }
  for (const k of Object.keys(configPatch)) {
    if (configPatch[k] === "") configPatch[k] = null;
  }

  // Lê o estado ATUAL das duas tabelas pra montar o unit_address com tudo que a
  // unidade já tem. Montar só com o que veio no patch TRUNCAVA o endereço: o cadastro
  // de franquia nova manda apenas billing_email/cep/rua, e o resultado ("Rua X - CEP",
  // sem número/bairro/cidade) era o que ia parar na ficha do motorista — bug de Leme e
  // Itapevi, impresso em 23/08/2026 com o cadastro fiscal completo o tempo todo.
  let currentConfig = null;
  if (evolutionInstanceId) {
    const configs = await FranchiseConfiguration.filter({
      franchise_evolution_instance_id: evolutionInstanceId,
    });
    currentConfig = configs[0] || null;
  }
  let currentFranchise = null;
  try {
    const rows = await Franchise.filter({ id: franchiseId });
    currentFranchise = rows[0] || null;
  } catch {
    // leitura opcional: sem ela o endereço sai só com o que veio no patch
  }

  // Sem isso, o patch de franquia gravava normal e o de configuração sumia em
  // silêncio (currentConfig null => o `if (... && currentConfig)` mais abaixo
  // nunca disparava) — quem chamou achava que salvou tudo.
  if (hasExplicitConfigFields && !currentConfig) {
    throw new Error("Configuração da unidade não encontrada");
  }

  const assembledAddress = resolveDeliveryAddress(
    { ...(currentFranchise || {}), ...franchisePatch },
    { ...(currentConfig || {}), ...configPatch }
  );
  if (assembledAddress) configPatch.unit_address = assembledAddress;

  if (Object.keys(franchisePatch).length > 0) {
    await Franchise.update(franchiseId, franchisePatch);
  }

  if (Object.keys(configPatch).length > 0 && currentConfig) {
    await FranchiseConfiguration.update(currentConfig.id, configPatch);
  }
}

// missingFiscalFields agora vive em src/lib/fiscalFields.js (extraída 16/09/2026: regra
// pura, sem @/entities/all, para poder rodar em `node onboardingJourney.test.mjs` fora
// do Vite). Reexportada no topo deste arquivo — quem importava daqui não muda nada.
