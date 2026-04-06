import { format, differenceInDays, subDays } from "date-fns";

/**
 * Calculates franchise health score (0-100) across 4 dimensions.
 *
 * Dimensions & weights (normal):
 *   Vendas 35%, Estoque 25%, Reposição 20%, Setup 20%
 *
 * New franchise (<30 days): Setup 40%, Vendas 25%, Estoque 15%, Reposição 20%
 */

// --- Individual dimension calculators ---

function calcSalesScore(franchise, salesData) {
  const franchiseSales = salesData.filter(
    (s) => s.franchise_id === franchise.id || s.franchise_id === franchise.evolution_instance_id
  );

  if (franchiseSales.length === 0) return { score: 0, detail: "Nenhuma venda registrada", daysSince: null };

  const mostRecentDate = franchiseSales.reduce((latest, s) => {
    const d = s.sale_date || s.created_at?.substring(0, 10) || "";
    return d > latest ? d : latest;
  }, "");

  const today = format(new Date(), "yyyy-MM-dd");
  const daysSince = differenceInDays(new Date(today), new Date(mostRecentDate));

  let score;
  if (daysSince === 0) score = 100;
  else if (daysSince === 1) score = 80;
  else if (daysSince === 2) score = 60;
  else if (daysSince === 3) score = 40;
  else if (daysSince <= 5) score = 20;
  else score = 0;

  const detail = daysSince === 0
    ? "Vendeu hoje"
    : `Última venda há ${daysSince} dia${daysSince > 1 ? "s" : ""}`;

  return { score, detail, daysSince };
}

function calcInventoryScore(franchise, inventoryData) {
  const items = inventoryData.filter(
    (i) => i.franchise_id === franchise.evolution_instance_id
  );

  if (items.length === 0) return { score: 0, detail: "Sem itens cadastrados", zeroCount: 0, zeroNames: "" };

  const zeroItems = items.filter((i) => (i.quantity || 0) === 0);
  const zeroCount = zeroItems.length;

  let score;
  if (zeroCount === 0) score = 100;
  else if (zeroCount === 1) score = 80;
  else if (zeroCount <= 3) score = 60;
  else if (zeroCount <= 5) score = 40;
  else if (zeroCount <= 8) score = 20;
  else score = 0;

  const detail = zeroCount === 0
    ? "Estoque OK"
    : `${zeroCount} ite${zeroCount > 1 ? "ns" : "m"} zerado${zeroCount > 1 ? "s" : ""}`;

  const zeroNames = zeroItems.slice(0, 4).map((i) => i.product_name || i.name).join(", ");

  return { score, detail, zeroCount, zeroNames };
}

function calcOrdersScore(franchise, ordersData) {
  const orders = ordersData.filter(
    (po) => po.franchise_id === franchise.id || po.franchise_id === franchise.evolution_instance_id
  );

  if (orders.length === 0) return { score: 0, detail: "Nunca fez pedido", daysSince: null, lastOrderDate: null };

  const mostRecent = orders.reduce((latest, po) => {
    const d = po.ordered_at || po.created_at?.substring(0, 10) || "";
    return d > latest ? d : latest;
  }, "");

  const daysSince = differenceInDays(new Date(), new Date(mostRecent));

  let score;
  if (daysSince <= 7) score = 100;
  else if (daysSince <= 14) score = 80;
  else if (daysSince <= 21) score = 60;
  else if (daysSince <= 30) score = 40;
  else if (daysSince <= 45) score = 20;
  else score = 0;

  const detail = `Último pedido há ${daysSince} dia${daysSince > 1 ? "s" : ""}`;

  return { score, detail, daysSince, lastOrderDate: mostRecent };
}

function calcBotScore(franchise, botConversations, conversationMessages, botSales) {
  const evoId = franchise.evolution_instance_id;
  const convos = botConversations.filter((c) => c.franchise_id === evoId);

  if (convos.length === 0) return { score: 0, detail: "Sem dados do bot", hasData: false, autonomyRate: 0 };

  // Autonomy: conversations without human intervention (10pts max, target 40%)
  const humanMsgsByConvo = {};
  conversationMessages.forEach((m) => {
    if (m.franchise_id === evoId && m.conversation_id) {
      humanMsgsByConvo[m.conversation_id] = (humanMsgsByConvo[m.conversation_id] || 0) + 1;
    }
  });
  const autonomousCount = convos.filter((c) => !humanMsgsByConvo[c.id]).length;
  const autonomyRate = convos.length > 0 ? autonomousCount / convos.length : 0;
  const autonomyPts = Math.min(10, Math.round((autonomyRate / 0.40) * 10));

  // Quality score avg (5pts max, target 7.0)
  const scored = convos.filter((c) => parseFloat(c.quality_score) > 0);
  const avgQuality = scored.length > 0
    ? scored.reduce((sum, c) => sum + (parseFloat(c.quality_score) || 0), 0) / scored.length
    : 0;
  const qualityPts = Math.min(5, Math.round((avgQuality / 7.0) * 5));

  // Bot conversion rate (5pts max, target 15%)
  const franchiseBotSales = botSales.filter((s) => s.franchise_id === evoId && s.source === "bot");
  const conversionRate = convos.length > 0 ? franchiseBotSales.length / convos.length : 0;
  const conversionPts = Math.min(5, Math.round((conversionRate / 0.15) * 5));

  const rawScore = autonomyPts + qualityPts + conversionPts; // max 20
  const score = Math.round((rawScore / 20) * 100); // normalize to 0-100

  const detail = `Autonomia ${Math.round(autonomyRate * 100)}% · Score ${avgQuality.toFixed(1)}`;

  return { score, detail, hasData: true, autonomyRate };
}

function calcSetupScore(franchise, onboardingData, configData) {
  const evoId = franchise.evolution_instance_id;
  const checklist = onboardingData.find((c) => c.franchise_id === evoId);
  const config = configData.find(
    (c) => c.franchise_evolution_instance_id === evoId
  );

  // Onboarding: 0-70 pts
  let onboardingPct = 0;
  if (checklist) {
    const completedCount = checklist.completed_count || 0;
    const totalItems = 27; // Fixed from ONBOARDING_BLOCKS
    onboardingPct = Math.min(100, Math.round((completedCount / totalItems) * 100));
  }
  const onboardingPts = Math.round((onboardingPct / 100) * 70);

  // WhatsApp: +30 pts if config exists with evolution instance
  const hasWhatsApp = !!(config && evoId);
  const whatsappPts = hasWhatsApp ? 30 : 0;

  const score = Math.min(100, onboardingPts + whatsappPts);

  // Only show onboarding info if not yet completed
  const onboardingComplete = onboardingPct >= 100;
  let detail;
  if (onboardingComplete) {
    detail = hasWhatsApp ? "Setup completo ✅" : "WhatsApp ❌";
  } else if (!checklist) {
    // No onboarding record at all — don't mention it
    detail = hasWhatsApp ? "WhatsApp ✅" : "WhatsApp ❌";
  } else {
    detail = `Onboarding ${onboardingPct}%${hasWhatsApp ? " · WhatsApp ✅" : " · WhatsApp ❌"}`;
  }

  return { score, detail, onboardingPct, hasWhatsApp, onboardingComplete };
}

// --- Main score calculator ---

export function calculateFranchiseHealth(franchise, data) {
  const {
    sales = [],
    inventory = [],
    orders = [],
    onboarding = [],
    configs = [],
    botConversations = [],
    conversationMessages = [],
    botSales = [],
  } = data;

  const vendas = calcSalesScore(franchise, sales);
  const estoque = calcInventoryScore(franchise, inventory);
  const reposicao = calcOrdersScore(franchise, orders);
  const setup = calcSetupScore(franchise, onboarding, configs);
  const bot = calcBotScore(franchise, botConversations, conversationMessages, botSales);

  const isNew = franchise.created_at &&
    differenceInDays(new Date(), new Date(franchise.created_at)) < 14;

  const hasBotData = bot.hasData;

  const weights = isNew
    ? { vendas: 0.25, estoque: 0.15, reposicao: 0.20, setup: 0.40, bot: 0 }
    : hasBotData
      ? { vendas: 0.30, estoque: 0.20, reposicao: 0.15, setup: 0.15, bot: 0.20 }
      : { vendas: 0.375, estoque: 0.25, reposicao: 0.1875, setup: 0.1875, bot: 0 };

  let total = Math.round(
    vendas.score * weights.vendas +
    estoque.score * weights.estoque +
    reposicao.score * weights.reposicao +
    setup.score * weights.setup +
    bot.score * weights.bot
  );

  // Penalty: any active dimension at 0 pulls total down
  const activeDimensions = [vendas, estoque, reposicao, setup];
  if (hasBotData) activeDimensions.push(bot);
  const hasZero = activeDimensions.some((d) => d.score === 0);
  if (hasZero) total -= 10;

  total = Math.max(0, Math.min(100, total));

  let status;
  if (isNew) status = "nova";
  else if (total >= 80) status = "saudavel";
  else if (total >= 50) status = "atencao";
  else status = "critico";

  const problems = [];
  if (vendas.score < 50 && vendas.daysSince !== null) problems.push(vendas.detail);
  if (estoque.score < 50 && estoque.zeroCount > 0) problems.push(estoque.detail);
  if (reposicao.score < 50 && reposicao.daysSince !== null) problems.push(reposicao.detail);
  if (setup.score < 50 && !setup.onboardingComplete) {
    problems.push(setup.onboardingPct > 0
      ? `Onboarding ${setup.onboardingPct}% — complete a configuração`
      : "Complete a configuração da sua franquia");
  }
  if (hasBotData && bot.score < 50) problems.push(bot.detail);

  return {
    total,
    status,
    isNew,
    dimensions: { vendas, estoque, reposicao, setup, bot },
    weights,
    problems,
  };
}

export const STATUS_COLORS = {
  critico: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  atencao: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  saudavel: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  nova: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
};

export const STATUS_LABELS = {
  critico: "Crítico",
  atencao: "Atenção",
  saudavel: "Saudável",
  nova: "Nova",
};
