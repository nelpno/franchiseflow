import { supabase } from '@/api/supabaseClient';
import { paginateAll } from "@/lib/paginateAll";

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

// Cascade delete via server-side RPC (atomic transaction — rollback on any failure)
async function deleteFranchiseCascade(franchiseId, evolutionInstanceId) {
  const { error } = await supabase.rpc('delete_franchise_cascade', {
    p_franchise_id: franchiseId,
    p_evolution_instance_id: evolutionInstanceId,
  });
  if (error) throw error;
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
export const MarketingFile = createEntity('marketing_files');
export const SaleItem = createEntity('sale_items');
export const Expense = createEntity('expenses');
export const PurchaseOrder = createEntity('purchase_orders');
export const PurchaseOrderItem = createEntity('purchase_order_items');
export const AuditLog = createEntity('audit_logs');
export const FranchiseNote = createEntity('franchise_notes');
export const MarketingPayment = createEntity('marketing_payments');
export const MarketingMetaDeposit = createEntity('marketing_meta_deposits');
export const ConversationMessage = createEntity('conversation_messages');
// Usa view vw_bot_conversations: exclui manual_sale e duplicate_stale do funil do bot (fix SAVE-1, 2026-04-19).
// Para write/raw: usar supabase.from('bot_conversations') diretamente.
export const BotConversation = createEntity('vw_bot_conversations');
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
export async function getFranchiseHealthSignals({ signal } = {}) {
  let query = supabase.rpc('get_franchise_health_signals');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
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

export async function deleteCsWorklistEvent(eventId) {
  // .select('id') detecta RLS silencioso (0 rows = sem permissão, não erro)
  const { data, error } = await withTimeout(
    supabase.from('cs_worklist_events').delete().eq('id', eventId).select('id'),
    30000,
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Sem permissão para apagar este registro.');
  return true;
}

export async function updateCsWorklistEventNote(eventId, note) {
  const trimmed = note?.trim() || null;
  const { data, error } = await withTimeout(
    supabase.from('cs_worklist_events').update({ note: trimmed }).eq('id', eventId).select('id'),
    30000,
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Sem permissão para editar este registro.');
  return true;
}

// ---- Mural CS v2 (cs_tasks) ----
export async function getCsTasks({ includeArchived = false, signal } = {}) {
  let query = supabase.from('cs_tasks').select('*').order('moved_to_column_at', { ascending: false });
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

export async function getCsTaskEvents(taskId, { signal } = {}) {
  let query = supabase.from('cs_worklist_events').select('*')
    .eq('task_id', taskId).order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
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
