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

function createEntity(tableName) {
  return {
    async list(orderBy, limit, { columns, signal, fetchAll } = {}) {
      if (fetchAll) {
        // Paginate past Supabase max_rows (1000) limit
        const pageSize = 1000;
        let all = [];
        let from = 0;
        while (true) {
          let query = supabase.from(tableName).select(columns || '*');
          if (signal) query = query.abortSignal(signal);
          const order = parseOrderBy(orderBy);
          if (order) query = query.order(order.column, { ascending: order.ascending });
          query = query.range(from, from + pageSize - 1);
          const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
          if (error) throw error;
          const batch = data || [];
          all = all.concat(batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }
        return all;
      }
      let query = supabase.from(tableName).select(columns || '*');
      if (signal) query = query.abortSignal(signal);
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
      if (error) throw error;
      return data || [];
    },

    async filter(criteria, orderBy, limit, { columns, signal } = {}) {
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
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, signal);
      if (error) throw error;
      return data || [];
    },

    async search(term, { columns, signal, limit = 20, searchColumns = [], criteria } = {}) {
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
        const orConditions = searchColumns
          .map(col => `${col}.ilike.%${term}%`)
          .join(',');
        query = query.or(orConditions);
      }
      query = query.order('created_at', { ascending: false });
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
      const { error } = await withTimeout(
        supabase
          .from(tableName)
          .delete()
          .eq('id', id),
        30000 // 30s — consistente com create/update
      );
      if (error) throw error;
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
