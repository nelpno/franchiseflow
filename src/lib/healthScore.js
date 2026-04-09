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

  if (franchiseSales.length === 0) return { score: 0, detail: "Nenhuma venda registrada", daysSince: null, noData: true };

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

  return { score, detail, daysSince, noData: false };
}

function calcInventoryScore(franchise, inventoryData) {
  const items = inventoryData.filter(
    (i) => i.franchise_id === franchise.evolution_instance_id && i.active !== false
  );

  if (items.length === 0) return { score: 0, detail: "Sem itens cadastrados", zeroCount: 0, zeroNames: "", noData: true };

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

  return { score, detail, zeroCount, zeroNames, noData: false };
}

function calcOrdersScore(franchise, ordersData) {
  const orders = ordersData.filter(
    (po) => po.franchise_id === franchise.id || po.franchise_id === franchise.evolution_instance_id
  );

  if (orders.length === 0) return { score: 0, detail: "Nunca fez pedido", daysSince: null, lastOrderDate: null, noData: true };

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

  return { score, detail, daysSince, lastOrderDate: mostRecent, noData: false };
}

function calcBotScore(franchise, botConversations, conversationMessages, botSales) {
  const evoId = franchise.evolution_instance_id;
  const convos = botConversations.filter((c) => c.franchise_id === evoId);

  if (convos.length === 0) return { score: 0, detail: "Sem dados do bot", hasData: false, autonomyRate: 0, noData: true };

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

  // Conversion rate (5pts max, target 10%)
  const converted = convos.filter(c => c.outcome === 'converted').length;
  const conversionRate = convos.length > 0 ? converted / convos.length : 0;
  const conversionPts = Math.min(5, Math.round(conversionRate * 50));

  const rawScore = autonomyPts + conversionPts; // max 15
  const score = Math.round((rawScore / 15) * 100); // normalize to 0-100

  const detail = `Autonomia ${Math.round(autonomyRate * 100)}% · Conversão ${Math.round(conversionRate * 100)}%`;

  return { score, detail, hasData: true, autonomyRate, noData: false };
}

export const SETUP_SIGNAL_LABELS = {
  whatsapp: "WhatsApp",
  pix: "PIX",
  delivery: "Entrega ou retirada",
  inventory: "Estoque com preços",
  orders: "Primeiro pedido",
  sales: "Primeira venda",
  bot: "Vendedor Digital",
};

function calcSetupScore(franchise, configData, extraData = {}) {
  const evoId = franchise.evolution_instance_id;
  const config = configData.find(
    (c) => c.franchise_evolution_instance_id === evoId
  );
  const { sales = [], inventory = [], orders = [], botConversations = [] } = extraData;

  const franchiseSales = sales.filter(
    (s) => s.franchise_id === franchise.id || s.franchise_id === evoId
  );
  const franchiseInventory = inventory.filter((i) => i.franchise_id === evoId);
  const franchiseOrders = orders.filter(
    (po) => po.franchise_id === franchise.id || po.franchise_id === evoId
  );

  const now = new Date();
  const fourteenDaysAgo = subDays(now, 14);
  const recentBotConvos = botConversations.filter((c) => {
    if (c.franchise_id !== evoId) return false;
    const d = c.started_at || c.created_at;
    return d && new Date(d) >= fourteenDaysAgo;
  });

  const signals = {
    whatsapp: !!(config && evoId),
    pix: !!(config?.pix_key_data),
    delivery: !!(config?.has_delivery || config?.has_pickup),
    inventory: franchiseInventory.some((i) => parseFloat(i.sale_price) > 0),
    orders: franchiseOrders.length > 0,
    sales: franchiseSales.length > 0,
    bot: recentBotConvos.length > 0,
  };

  const SIGNAL_POINTS = { whatsapp: 20, pix: 15, delivery: 10, inventory: 15, orders: 15, sales: 15, bot: 10 };

  let score = 0;
  const missingItems = [];
  for (const [key, pts] of Object.entries(SIGNAL_POINTS)) {
    if (signals[key]) {
      score += pts;
    } else {
      missingItems.push(SETUP_SIGNAL_LABELS[key]);
    }
  }
  score = Math.min(100, score);

  const hasWhatsApp = signals.whatsapp;
  let detail;
  if (score >= 90) {
    detail = "Operação completa ✅";
  } else if (score >= 50) {
    detail = `Quase pronto — falta: ${missingItems.slice(0, 2).join(", ")}`;
  } else {
    detail = `Configure: ${missingItems.slice(0, 3).join(", ")}`;
  }

  return { score, detail, hasWhatsApp, signals, missingItems };
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
  const setup = calcSetupScore(franchise, configs, { sales, inventory, orders, botConversations });
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

  // Penalty only for dimensions with real data that scored 0 (not missing data)
  const activeDimensions = [vendas, estoque, reposicao, setup];
  if (hasBotData) activeDimensions.push(bot);
  const hasRealZero = activeDimensions.some((d) => d.score === 0 && !d.noData);
  if (hasRealZero) total -= 5;

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
  if (setup.score < 50) {
    const missing = setup.missingItems || [];
    problems.push(missing.length > 0
      ? `Configure: ${missing.slice(0, 2).join(", ")}`
      : "Complete a configuração da franquia");
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
