import { addMonths } from "date-fns";

/**
 * Franchise utilities — centraliza lógica de filtro e lookup de franquias.
 * Resolve a inconsistência UUID vs evolution_instance_id.
 */

/**
 * Filtra franquias que o usuário pode acessar.
 * Verifica tanto UUID (id) quanto evolution_instance_id,
 * porque managed_franchise_ids pode conter qualquer um dos dois.
 */
export function getAvailableFranchises(franchises, currentUser) {
  if (!currentUser || !franchises) return [];
  if (currentUser.role === "admin" || currentUser.role === "manager") return franchises;

  const ids = currentUser.managed_franchise_ids || [];
  return franchises.filter(
    (f) => ids.includes(f.id) || ids.includes(f.evolution_instance_id)
  );
}

/**
 * Encontra a franquia principal do usuário (primeira da lista).
 */
export function getPrimaryFranchise(franchises, currentUser) {
  const available = getAvailableFranchises(franchises, currentUser);
  return available[0] || null;
}

/**
 * Dado um franchiseId (que pode ser UUID ou evolution_instance_id),
 * encontra a franquia correspondente.
 */
export function findFranchise(franchises, franchiseId) {
  if (!franchiseId || !franchises) return null;
  return franchises.find(
    (f) => f.id === franchiseId || f.evolution_instance_id === franchiseId
  );
}

/**
 * Labels amigáveis para métodos de pagamento.
 */
export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX", icon: "qr_code_2" },
  { value: "payment_link", label: "Link de Pagamento", icon: "link" },
  { value: "card_machine", label: "Cartão (maquininha/aproximação)", icon: "credit_card" },
  { value: "cash", label: "Dinheiro", icon: "payments" },
];

/**
 * Labels para métodos de entrega.
 */
export const DELIVERY_METHODS = [
  { value: "own_fleet", label: "Motoboy próprio", description: "Leva máquina de cartão" },
  { value: "third_party", label: "Uber / Flash / iFood", description: "Só PIX ou link (sem máquina)" },
  { value: "both", label: "Ambos", description: "Próprio + terceirizado" },
];

/**
 * Labels para personalidade do bot.
 */
export const BOT_PERSONALITIES = [
  { value: "formal", label: "Formal", description: "Sério e executivo" },
  { value: "friendly", label: "Amigável", description: "Caloroso e prestativo" },
  { value: "casual", label: "Descontraído", description: "Jovial e direto" },
];

/**
 * Labels para tipo de chave PIX.
 */
export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
];

/**
 * Monta um Map de configs indexado por franchise_evolution_instance_id.
 * Usado para lookup rápido ao exibir nomes padronizados.
 */
export function buildConfigMap(configs) {
  const map = {};
  if (!configs) return map;
  configs.forEach((c) => {
    if (c.franchise_evolution_instance_id) {
      map[c.franchise_evolution_instance_id] = c;
    }
  });
  return map;
}

/**
 * Nome padronizado de franquia.
 * - compact (default): retorna string — "Bauru", "Itápolis Centro"
 * - full: retorna { primary, owner, city } para layouts detalhados
 *
 * Strip automático de "Maxi Massas" do franchise_name (cadastrado com prefixo).
 * Fallback: config.franchise_name → franchise.city → franchise.owner_name → "Franquia"
 */
function stripBrandPrefix(name) {
  if (!name) return name;
  return name.replace(/^Maxi\s*Massas\s*/i, "").trim() || name;
}

export function getFranchiseDisplayName(franchise, config, mode = "compact") {
  const raw =
    config?.franchise_name || franchise?.city || franchise?.owner_name || "Franquia";
  const primary = stripBrandPrefix(raw);

  if (mode === "compact") return primary;

  return {
    primary,
    owner: franchise?.owner_name || "",
    city: franchise?.city || "",
  };
}

/**
 * Dias da semana para chips.
 */
export const WEEKDAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

// Marketing — taxa de imposto sobre valor arrecadado (13%)
export const MARKETING_TAX_RATE = 0.13;
export const marketingLiquid = (amount) => amount * (1 - MARKETING_TAX_RATE);

/**
 * Mês-alvo de marketing: últimos 5 dias do mês → próximo mês, senão mês atual.
 * Retorna Date — caller formata com format(date, "yyyy-MM").
 */
export function getMarketingTargetMonth(now = new Date()) {
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day > daysInMonth - 5 ? addMonths(now, 1) : now;
}
