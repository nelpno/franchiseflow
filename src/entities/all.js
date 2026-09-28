import { supabase } from '@/api/supabaseClient';
import { paginateAll } from "@/lib/paginateAll";
import { confirmarRecebimento } from "@/lib/conferenciaEntrega";

function parseOrderBy(orderByStr) {
  if (!orderByStr) return null;
  const desc = orderByStr.startsWith('-');
  const column = desc ? orderByStr.slice(1) : orderByStr;
  return { column, ascending: !desc };
}

// Timeout para queries de leitura — evita hang infinito quando Supabase trava
const QUERY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido')), ms);
  });
  const parts = [promise, timeout];
  if (signal) {
    parts.push(new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
  }
  return Promise.race(parts).finally(() => clearTimeout(timeoutId));
}

// A paginação vive em lib/paginateAll.js para poder ser testada sem o cliente do
// Supabase: node src/lib/paginateAll.test.mjs (8 casos, inclusive a varredura que
// prova que nenhuma linha duplica nem some — a invariante quebrada no fix 5333224).
// Aqui fica só o adaptador: desembrulha o { data, error } do supabase-js e mantém o
// timeout de 15 s e o AbortSignal que a versão anterior aplicava em CADA página.
const paginarComTimeout = (montarQuery, signal) =>
  paginateAll(async (from, to) => {
    const { data, error } = await withTimeout(montarQuery(from, to), QUERY_TIMEOUT_MS, signal);
    if (error) throw error;
    return data || [];
  });

function createEntity(tableName) {
  return {
    async list(orderBy, limit, { columns, signal, fetchAll, gte, lte } = {}) {
      const applyRangeFilters = (q) => {
        if (gte) for (const [col, val] of Object.entries(gte)) q = q.gte(col, val);
        if (lte) for (const [col, val] of Object.entries(lte)) q = q.lte(col, val);
        return q;
      };
      if (fetchAll) {
        const order = parseOrderBy(orderBy);
        return paginarComTimeout((from, to) => {
          let query = supabase.from(tableName).select(columns || '*');
          if (signal) query = query.abortSignal(signal);
          query = applyRangeFilters(query);
          if (order) query = query.order(order.column, { ascending: order.ascending });
          if (!order || order.column !== 'id') query = query.order('id', { ascending: true });
          return query.range(from, to);
        }, signal);
      }
      let query = supabase.from(tableName).select(columns || '*');
      if (signal) query = query.abortSignal(signal);
      query = applyRangeFilters(query);
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
      if (error) throw error;
      return data || [];
    },

    async filter(criteria, orderBy, limit, { columns, signal, fetchAll, gte, lte } = {}) {
      const applyFilters = (q) => {
        if (criteria) {
          for (const [key, value] of Object.entries(criteria)) {
            if (Array.isArray(value)) { q = q.in(key, value); }
            else { q = q.eq(key, value); }
          }
        }
        if (gte) for (const [col, val] of Object.entries(gte)) q = q.gte(col, val);
        if (lte) for (const [col, val] of Object.entries(lte)) q = q.lte(col, val);
        return q;
      };
      if (fetchAll) {
        const order = parseOrderBy(orderBy);
        return paginarComTimeout((from, to) => {
          let query = supabase.from(tableName).select(columns || '*');
          if (signal) query = query.abortSignal(signal);
          query = applyFilters(query);
          if (order) query = query.order(order.column, { ascending: order.ascending });
          if (!order || order.column !== 'id') query = query.order('id', { ascending: true });
          return query.range(from, to);
        }, signal);
      }
      let query = supabase.from(tableName).select(columns || '*');
      if (signal) query = query.abortSignal(signal);
      query = applyFilters(query);
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
      if (error) throw error;
      return data || [];
    },

    async search(term, { columns, signal, limit = 20, searchColumns = [], criteria, orderColumn = 'created_at' } = {}) {
      let query = supabase.from(tableName).select(columns || '*');
      if (signal) query = query.abortSignal(signal);
      if (criteria) {
        for (const [key, value] of Object.entries(criteria)) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      }
      if (term && searchColumns.length > 0) {
        const safeTerm = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
        const orConditions = searchColumns
          .map(col => `${col}.ilike.%${safeTerm}%`)
          .join(',');
        query = query.or(orConditions);
      }
      query = query.order(orderColumn, { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: created, error } = await withTimeout(
        supabase
          .from(tableName)
          .insert(data)
          .select()
          .single(),
        60000 // 60s — franchises dispara triggers pesados (config + 28 inventory items)
      );
      if (error) throw error;
      return created;
    },

    async createMany(rows) {
      if (!rows || rows.length === 0) return [];
      const { data, error } = await withTimeout(
        supabase.from(tableName).insert(rows).select(),
        60000
      );
      if (error) throw error;
      return data || [];
    },

    async update(id, data) {
      const { data: updated, error } = await withTimeout(
        supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select()
          .single(),
        30000 // 30s — Supabase Free tier pode ser lento sob carga
      );
      if (error) throw error;
      return updated;
    },

    async delete(id) {
      const { data, error } = await withTimeout(
        supabase
          .from(tableName)
          .delete()
          .eq('id', id)
          .select('id'),
        30000 // 30s — consistente com create/update
      );
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Sem permissão para excluir este registro.');
      }
    }
  };
}

// Cascade delete via server-side RPC (atomic transaction — rollback on any failure).
// `dryRun: true` percorre o MESMO caminho contando em vez de apagar: é o preflight que
// a tela roda ANTES de cancelar a cobrança no ASAAS. Sem ele, uma falha no banco deixa
// a franquia viva e sem cobrança (foi o que aconteceu com Cataguases em 09/09/2026).
// Devolve { dry_run, franquia, tabelas: {tabela: n}, usuarios: [{acao, nome, ...}] }.
async function deleteFranchiseCascade(franchiseId, evolutionInstanceId, { dryRun = false } = {}) {
  const { data, error } = await supabase.rpc('delete_franchise_cascade', {
    p_franchise_id: franchiseId,
    p_evolution_instance_id: evolutionInstanceId,
    p_dry_run: dryRun,
  });
  if (error) throw error;
  return data;
}

// Frete calculado (cartão "Entrega", plano de frete 12/09/2026): o delivery_pricing só muda pelo servidor.
// A RPC grava o frete e os campos derivados juntos, confere permissão e conflito contra o que a tela
// carregou (esperado). Conflito volta como erro 40001 com a mensagem "CONFLITO_FRETE:col1,col2".
export async function salvarFreteEstruturado(configId, campos, esperado) {
  const { data, error } = await withTimeout(
    supabase.rpc('salvar_frete_estruturado', { p_config_id: configId, p_campos: campos, p_esperado: esperado }),
    30000
  );
  if (error) throw error;
  return data;
}

// "Contar estoque" (S16.1, revisão P3 28/09/2026): grava a quantidade só se ainda for
// a que a franqueada tinha visto ao tocar no item — senão o robô ou outra aba podem ter
// baixado o estoque no meio da contagem, e um update comum sobrescreveria essa baixa
// calado. `.eq('quantity', baseQty)` é o "compare-and-swap": 0 linhas afetadas = alguém
// mexeu no meio — busca o valor atual pra tela mostrar "mudou (agora X)" e a franqueada
// decidir de novo, em vez de gravar por cima.
export async function updateInventoryCountIfUnchanged(id, franchiseId, baseQty, newQty, userId) {
  const nowIso = new Date().toISOString();
  const { data, error } = await withTimeout(
    supabase
      .from('inventory_items')
      .update({ quantity: newQty, last_updated_by: userId || null, updated_at: nowIso })
      .eq('id', id)
      .eq('franchise_id', franchiseId)
      .eq('quantity', baseQty)
      .select('id, quantity, updated_at'),
    30000
  );
  if (error) throw error;
  if (!data || data.length === 0) {
    const { data: atual, error: fetchError } = await withTimeout(
      supabase.from('inventory_items').select('id, quantity').eq('id', id).maybeSingle(),
      15000
    );
    if (fetchError) throw fetchError;
    // Item não existe mais (excluído enquanto a contagem ficou pendente) — isso NÃO é
    // conflito (não há "valor atual" pra franqueada conferir e reenviar): é definitivo,
    // sai da pendência sozinho. Ver revisão P3 rodada 2, 28/09/2026.
    if (!atual) {
      return { missing: true };
    }
    return { conflict: true, currentQuantity: Number(atual.quantity) };
  }
  return { conflict: false, quantity: Number(data[0].quantity), updated_at: data[0].updated_at };
}

// Entidades com nomes de tabela Supabase
export const Franchise = {
  ...createEntity('franchises'),
  deleteCascade: deleteFranchiseCascade,
};
export const Sale = createEntity('sales');
export const DailyUniqueContact = createEntity('daily_unique_contacts');
export const DailySummary = createEntity('daily_summaries');
export const FranchiseConfiguration = createEntity('franchise_configurations');
export const OnboardingChecklist = createEntity('onboarding_checklists');
// Novas entidades (FASE 3)
export const InventoryItem = createEntity('inventory_items');
export const Contact = createEntity('contacts');

export const Notification = createEntity('notifications');
export const FranchiseInvite = createEntity('franchise_invites');
export const SaleItem = createEntity('sale_items');
export const Expense = createEntity('expenses');
export const PurchaseOrder = createEntity('purchase_orders');
export const PurchaseOrderItem = createEntity('purchase_order_items');
export const AuditLog = createEntity('audit_logs');
export const MarketingPayment = createEntity('marketing_payments');
export const MarketingMetaDeposit = createEntity('marketing_meta_deposits');
export const SystemSubscription = createEntity('system_subscriptions');

// RPC helpers
export async function getFranchiseRanking(date, franchiseId, { signal } = {}) {
  let query = supabase.rpc('get_franchise_ranking', {
    p_date: date,
    p_franchise_id: franchiseId,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data;
}

export async function getFranchiseRankingMonthly(yearMonth, franchiseId, { signal } = {}) {
  let query = supabase.rpc('get_franchise_ranking_monthly', {
    p_year_month: yearMonth,
    p_franchise_id: franchiseId,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Retorno da verba de marketing, por unidade e por mes.
// O robo grava ctwa_clid/meta_ad_id no contato desde o primeiro "oi": 38.612 dos 57.096
// contatos tem um dos dois, e em agosto/2026 as vendas ligadas a eles somaram R$ 119.264,93
// de R$ 390.429,48 (30,5% da receita da rede). Nenhuma tela lia isso ate 07/09/2026.
// A RPC devolve so o BRUTO: o liquido sai de MARKETING_TAX_RATE aqui no front, que e onde
// a taxa do Meta mora (o banco nao a conhece). ~65 ms para a rede inteira.
export async function getMarketingAttribution(yearMonth, franchiseId = null, { signal } = {}) {
  let query = supabase.rpc('get_marketing_attribution', {
    p_month: yearMonth,
    p_franchise_id: franchiseId,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}
// Pulso do robô da unidade: quando foi a ÚLTIMA conversa e quantas houve em 7 dias.
// Existe porque "robô ativo" no painel do franqueado significava apenas "existe linha em
// franchise_configurations" — ou seja, nunca ficava falso. Medido em 07/09/2026: 8
// franquias vendendo, com o robô sem UMA conversa há 7+ dias, viam a faixa verde
// "Tudo em dia!". ~0,6ms (duas subqueries no bot_conversations_lookup_idx).
export async function getFranchiseBotPulse(franchiseId, { signal } = {}) {
  let query = supabase.rpc('get_franchise_bot_pulse', { p_franchise_id: franchiseId });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Funil da franquia no período: quantas pessoas falaram com o robô e quantas compraram,
// mais o comportamento de recompra. ~18ms (index-only scan).
// has_bot_data=false quando o robô está parado/inexistente — o card esconde o número
// em vez de mostrar uma taxa sem sentido (Santos daria 4400%).
export async function getFranchiseFunnelStats(franchiseId, start, end, { signal } = {}) {
  let query = supabase.rpc('get_franchise_funnel_stats', {
    p_franchise_id: franchiseId,
    p_start: start,
    p_end: end,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Média anônima da rede, só para comparação no detalhe. ~230ms — por isso é chamada
// apenas quando o franqueado ABRE o detalhe, nunca no load do dashboard.
export async function getNetworkFunnelBenchmark(start, end, { signal } = {}) {
  let query = supabase.rpc('get_network_funnel_benchmark', {
    p_start: start,
    p_end: end,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Ranking de funil da rede (admin). ~230ms — lazy-load, nunca no load do AdminDashboard.
export async function getNetworkFunnelRanking(start, end, { signal } = {}) {
  let query = supabase.rpc('get_network_funnel_ranking', {
    p_start: start,
    p_end: end,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

export async function getStandardProductCatalog() {
  const { data, error } = await supabase.rpc('get_standard_product_catalog');
  if (error) throw error;
  return data || [];
}

// Mapa { [product_name]: weight_kg } da tabela-mestra de pesos.
// Leve (~33 linhas). Usado pelo form de reposição e pela geração de fichas PDF.
export async function getProductWeightMap({ signal } = {}) {
  let query = supabase.from("product_weights").select("product_name, weight_kg");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.product_name] = Number(row.weight_kg); });
  return map;
}

export async function addDefaultProduct({ name, category, unit, costPrice, minStock }) {
  const { data, error } = await supabase.rpc('add_default_product', {
    p_name: name,
    p_category: category,
    p_unit: unit || 'un',
    p_cost_price: costPrice || 0,
    p_min_stock: minStock || 5,
  });
  if (error) throw error;
  return data;
}

// --- Customer Success Cockpit ---
// Mural rápido (26/09/2026): lê o cache que reconcile_cs_auto_tasks grava
// (franchise_health_cache, RLS = is_cs_or_admin) em vez de recalcular a saúde da rede ao
// vivo (~5 s). Devolve as MESMAS chaves da get_franchise_health_signals
// ({...signals, franchise_id, tier, flags, is_standout}) + computed_at, para o Mural
// decidir se o cache está velho e reconciliar em segundo plano.
export async function getFranchiseHealthCache({ signal } = {}) {
  let query = supabase
    .from('franchise_health_cache')
    .select('franchise_id,tier,flags,is_standout,signals,computed_at');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return (data || []).map((r) => ({
    ...(r.signals || {}),
    franchise_id: r.franchise_id,
    tier: r.tier,
    flags: r.flags || [],
    is_standout: !!r.is_standout,
    computed_at: r.computed_at,
  }));
}

// Dono e telefone de cada unidade, para o Mural do CS. RPC PROPRIA de proposito: a
// get_franchise_health_signals que roda em producao tem regras que nao estao
// versionadas no repo, entao nao se mexe nela (auditoria 07/09/2026, F0.2).
export async function getCsFranchiseContacts({ signal } = {}) {
  let query = supabase.rpc('get_cs_franchise_contacts');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

// ---- Admin redesenhado (Fase 0, 26/09/2026) ----
// 1 linha por unidade ativa e não-teste (~66). Alimenta "Hoje" e "Unidades".
// Regras dos filtros em src/lib/networkOverview.js. Admin, gerente e CS; outros = [].
export async function getAdminNetworkOverview({ signal } = {}) {
  let query = supabase.rpc('get_admin_network_overview');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

// Ficha da unidade (/Unidade?id=<evo>): jsonb ~8 KB com cabeçalho, saúde/tier, vendas por
// semana, robô, marketing, clientes, pedidos à fábrica, assinatura, onboarding e cartões do
// Mural. null = unidade inexistente ou sem acesso (a RPC filtra por papel).
export async function getUnitDetail(franchiseId, { signal } = {}) {
  if (!franchiseId) return null;
  let query = supabase.rpc('get_unit_360', { p_evo: franchiseId });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data ?? null;
}

// Financeiro > "Fechamento do mês": 1 linha por unidade (não teste; ativa ou com venda no
// mês), ~35 KB. yearMonth = 'YYYY-MM'. Sem acesso, mês inválido ou futuro: [].
// SQL: supabase/2026-09-26-admin-06-financeiro-rede.sql
export async function getFinanceiroRede(yearMonth, { signal } = {}) {
  let query = supabase.rpc('get_financeiro_rede', { p_month: yearMonth });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

// Contadores de "Pendências" (substituem as notificações de pedido/pagamento).
// Só admin/gerente: para o CS a função dá erro 42501 → NÃO chamar para o CS (esconder o bloco).
// Chaves: pedidos_para_confirmar, pedidos_para_entregar, marketing_a_confirmar,
// marketing_sem_campanha, marketing_sem_comprovante, onboarding_aguardando_aprovacao,
// mensalidades_vencidas, mes_alvo_marketing ('YYYY-MM').
export async function getAdminPendingCounts({ signal } = {}) {
  let query = supabase.rpc('get_admin_pending_counts');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data ?? null;
}

// ---- Mural CS v2 (cs_tasks) ----
// columns: a Hoje só precisa de 'franchise_id,column_status,moved_to_column_at'; o Mural
// usa o default '*'. archived_at entra no filtro abaixo sem precisar estar na lista.
export async function getCsTasks({ includeArchived = false, columns = '*', signal } = {}) {
  let query = supabase.from('cs_tasks').select(columns).order('moved_to_column_at', { ascending: false });
  if (!includeArchived) query = query.is('archived_at', null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

export async function createCsTask(payload, userId) {
  const { data, error } = await withTimeout(
    supabase.from('cs_tasks').insert({ ...payload, created_by: userId ?? null }).select().single(),
    30000,
  );
  if (error) throw error;
  return data;
}

export async function updateCsTask(taskId, patch) {
  const { data, error } = await withTimeout(
    supabase.from('cs_tasks').update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId).select().single(),
    30000,
  );
  if (error) throw error;
  return data;
}

export async function moveCsTask(taskId, column, userId, franchiseId = null) {
  const nowIso = new Date().toISOString();
  const patch = { column_status: column, moved_to_column_at: nowIso, updated_at: nowIso };
  if (column === 'feito') patch.resolved_at = nowIso;
  const { data, error } = await withTimeout(
    supabase.from('cs_tasks').update(patch).eq('id', taskId).select().single(),
    30000,
  );
  if (error) throw error;
  // destino 'feito' registra 'resolve' (semântica do histórico); demais = 'move'
  await addCsTaskEvent(taskId, column === 'feito' ? 'resolve' : 'move', null, userId, data?.franchise_id ?? franchiseId);
  return data;
}

export async function addCsTaskEvent(taskId, eventType, note, userId, franchiseId = null) {
  const { data, error } = await withTimeout(
    supabase.from('cs_worklist_events')
      .insert({ task_id: taskId, franchise_id: franchiseId, event_type: eventType, note: note || null, created_by: userId ?? null })
      .select().single(),
    30000,
  );
  if (error) throw error;
  return data;
}

export async function reconcileCsAutoTasks() {
  const { error } = await withTimeout(supabase.rpc('reconcile_cs_auto_tasks'), 30000);
  if (error) throw error;
}

// User é especial - tem método .me() além dos métodos padrão
export const User = {
  ...createEntity('profiles'),
  async me({ signal } = {}) {
    return withTimeout((async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError || new Error('Not authenticated');
      let query = supabase.from('profiles').select('*').eq('id', user.id).single();
      if (signal) query = query.abortSignal(signal);
      const { data: profile, error: profileError } = await query;
      if (profileError) throw profileError;
      return { ...user, ...profile };
    })(), QUERY_TIMEOUT_MS, signal);
  }
};

// "Quem chamar hoje" (supabase/2026-09-17-crm-quem-chamar-hoje.sql).
// A RPC devolve null para unidade que o usuário não enxerga.
export async function getDailyCustomerActions(franchiseId, limit = 8) {
  const { data, error } = await withTimeout(supabase.rpc('get_daily_customer_actions', {
    p_franchise_id: franchiseId,
    p_limit: limit,
  }), QUERY_TIMEOUT_MS);
  if (error) throw error;
  return data ?? null;
}

// Primeiros passos: única porta para concluir ('approved') ou reabrir ('in_progress').
// Só admin/gerente; o banco recusa o resto (guard em onboarding_checklists).
export async function setOnboardingStatus(franchiseId, status) {
  const { data, error } = await withTimeout(supabase.rpc('set_onboarding_status', {
    p_franchise_id: franchiseId,
    p_status: status,
  }), 30000);
  if (error) throw error;
  return data ?? null;
}

// Fatos da trilha "Primeiros passos" de UMA unidade (null sem acesso):
// { stock_now, has_catalog, first_order_at, first_delivered_at, first_bot_reply_at,
//   first_sale_at, first_sale_with_contact_at }
export async function getOnboardingFacts(franchiseId) {
  const { data, error } = await withTimeout(supabase.rpc('get_onboarding_facts', {
    p_franchise_id: franchiseId,
  }), QUERY_TIMEOUT_MS);
  if (error) throw error;
  return data ?? null;
}

// Marca/desmarca UM item da trilha (p_* da franqueada, maxi_* da equipe) sem reenviar o
// mapa inteiro — quem abriu a tela antes não apaga o que o outro marcou depois.
// Devolve a linha atualizada (o banco ignora maxi_* vindo da franqueada).
export async function setOnboardingItem(franchiseId, key, done) {
  const { data, error } = await withTimeout(supabase.rpc('set_onboarding_item', {
    p_franchise_id: franchiseId,
    p_key: key,
    p_done: done,
  }), 30000);
  if (error) throw error;
  return data ?? null;
}

// Pedido modelo da Maxi para o 1º pedido: [{ product_name, quantidade }].
// Quantidades ficam em catalog_products.qtd_pedido_modelo.
// S14.7: preço que o pedido à fábrica GRAVA (tabela da fábrica; nome fora da tabela = custo da
// unidade), pela mesma função da RPC create_purchase_order_with_items. { [inventory_item_id]: preço }.
export async function getPrecosPedidoFabrica(franchiseId) {
  const { data, error } = await withTimeout(
    supabase.rpc('get_precos_pedido_fabrica', { p_franchise_id: franchiseId }), QUERY_TIMEOUT_MS);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.inventory_item_id, parseFloat(r.unit_price) || 0]));
}

export async function getPedidoModelo() {
  const { data, error } = await withTimeout(supabase.rpc('get_pedido_modelo'), QUERY_TIMEOUT_MS);
  if (error) throw error;
  return data ?? [];
}

// status: 'sent' | 'skipped' | null (null desfaz a ação de hoje)
export async function registrarAcaoCliente(contactId, actionType, status) {
  const { error } = await withTimeout(supabase.rpc('registrar_acao_cliente', {
    p_contact_id: contactId,
    p_action_type: actionType,
    p_status: status,
  }), 30000);
  if (error) throw error;
}

// ---- Chave liga/desliga por unidade (S1.2, 28/09/2026) ----
// {"ui_v2": true, ...} já resolvido (unidade > rede > desligada). null = sem acesso.
// Quem consome usa isFeatureOn() de src/lib/featureFlags.js (falha = desligada).
export async function getFeatureFlags(franchiseId, { signal } = {}) {
  if (!franchiseId) return {};
  let query = supabase.rpc('get_feature_flags', { p_franchise_id: franchiseId });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || {};
}

// ---- Conferir a entrega do pedido à fábrica (S15.1, 28/09/2026) ----
// RPC confirmar_recebimento_pedido (supabase/2026-09-28-s15-conferir-entrega.sql): grava o que
// chegou e fecha o pedido numa transação (estoque e despesa uma vez só). Lógica em conferenciaEntrega.js.
export async function confirmarRecebimentoPedido(orderId, itens, clientId) {
  return confirmarRecebimento({ rpc: (fn, p) => supabase.rpc(fn, p), orderId, itens, clientId });
}
