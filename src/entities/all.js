import { supabase } from '@/api/supabaseClient';

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

// Paginação além do limite de 1000 linhas do Supabase (max_rows).
// Lotes especulativos: busca PAGE_CONCURRENCY páginas em paralelo por vez e para
// quando uma página vem incompleta. Telas pequenas (1 página) custam 1 round-trip,
// idêntico ao comportamento serial anterior; telas grandes (admin: ~7k vendas, ~22k
// contatos) paralelizam e ficam ~2x mais rápidas. O tie-breaker por `id` no ORDER BY
// (aplicado por quem chama) garante ordem determinística entre páginas — sem duplicar
// nem omitir linhas (mesma invariante do fix 5333224). makeQuery(from, to) deve montar
// a query completa (select + filtros + order + range).
const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 6;

async function paginateAll(makeQuery, signal) {
  const fetchPage = async (from) => {
    const { data, error } = await withTimeout(
      makeQuery(from, from + PAGE_SIZE - 1), QUERY_TIMEOUT_MS, signal
    );
    if (error) throw error;
    return data || [];
  };
  // 1ª página sozinha: se vier curta, retorna na hora (caminho das telas pequenas)
  const first = await fetchPage(0);
  if (first.length < PAGE_SIZE) return first;
  let all = first;
  let base = 1;
  while (true) {
    const batch = await Promise.all(
      Array.from({ length: PAGE_CONCURRENCY }, (_, i) => fetchPage((base + i) * PAGE_SIZE))
    );
    for (const page of batch) all = all.concat(page);
    if (batch.some((page) => page.length < PAGE_SIZE)) break; // chegou ao fim
    base += PAGE_CONCURRENCY;
  }
  return all;
}

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
        return paginateAll((from, to) => {
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
        return paginateAll((from, to) => {
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
export const DailyChecklist = createEntity('daily_checklists');
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

export async function getStandardProductCatalog() {
  const { data, error } = await supabase.rpc('get_standard_product_catalog');
  if (error) throw error;
  return data || [];
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

export async function getCsWorklist({ signal } = {}) {
  let query = supabase.from('cs_worklist').select('*');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

export async function getCsWorklistEvents(franchiseId, { signal } = {}) {
  let query = supabase
    .from('cs_worklist_events')
    .select('*')
    .eq('franchise_id', franchiseId)
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
  if (error) throw error;
  return data || [];
}

export async function upsertCsWorklist(franchiseId, patch, userId) {
  const row = {
    franchise_id: franchiseId,
    ...patch,
    updated_by: userId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await withTimeout(
    supabase.from('cs_worklist').upsert(row, { onConflict: 'franchise_id' }).select().single(),
    30000,
  );
  if (error) throw error;
  return data;
}

export async function addCsWorklistEvent(franchiseId, eventType, note, userId) {
  const { data, error } = await withTimeout(
    supabase
      .from('cs_worklist_events')
      .insert({ franchise_id: franchiseId, event_type: eventType, note: note || null, created_by: userId ?? null })
      .select()
      .single(),
    30000,
  );
  if (error) throw error;
  return data;
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
