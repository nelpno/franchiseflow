import { supabase } from '@/api/supabaseClient';

function parseOrderBy(orderByStr) {
  if (!orderByStr) return null;
  const desc = orderByStr.startsWith('-');
  const column = desc ? orderByStr.slice(1) : orderByStr;
  return { column, ascending: !desc };
}

// Timeout para queries de leitura — evita hang infinito quando Supabase trava
const QUERY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function createEntity(tableName) {
  return {
    async list(orderBy, limit) {
      let query = supabase.from(tableName).select('*');
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await withTimeout(query);
      if (error) throw error;
      return data || [];
    },

    async filter(criteria, orderBy, limit) {
      let query = supabase.from(tableName).select('*');
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
      const { data, error } = await withTimeout(query);
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
        15000
      );
      if (error) throw error;
      return created;
    },

    async update(id, data) {
      const { data: updated, error } = await withTimeout(
        supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select()
          .single(),
        15000
      );
      if (error) throw error;
      return updated;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  };
}

// Cascade delete para franquia — limpa todos dados relacionados antes de deletar
async function deleteFranchiseCascade(franchiseId, evolutionInstanceId) {
  const evoId = evolutionInstanceId;

  // Buscar IDs de vendas e pedidos para limpar itens (FK profunda)
  const { data: sales } = await supabase.from('sales').select('id').eq('franchise_id', franchiseId);
  const saleIds = (sales || []).map(s => s.id);
  const { data: orders } = await supabase.from('purchase_orders').select('id').eq('franchise_id', franchiseId);
  const orderIds = (orders || []).map(o => o.id);

  // Deletar itens filhos primeiro
  if (saleIds.length > 0) await supabase.from('sale_items').delete().in('sale_id', saleIds);
  if (orderIds.length > 0) await supabase.from('purchase_order_items').delete().in('order_id', orderIds);

  // Deletar tabelas que usam franchise UUID
  await supabase.from('sales').delete().eq('franchise_id', franchiseId);
  await supabase.from('purchase_orders').delete().eq('franchise_id', franchiseId);
  await supabase.from('expenses').delete().eq('franchise_id', franchiseId);

  // Deletar tabelas que usam evolution_instance_id
  await supabase.from('contacts').delete().eq('franchise_id', evoId);
  await supabase.from('daily_unique_contacts').delete().eq('franchise_id', evoId);
  await supabase.from('daily_checklists').delete().eq('franchise_id', evoId);
  await supabase.from('inventory_items').delete().eq('franchise_id', evoId);
  await supabase.from('franchise_configurations').delete().eq('franchise_evolution_instance_id', evoId);
  await supabase.from('franchise_invites').delete().eq('franchise_id', evoId);

  // Finalmente deletar a franquia
  const { error } = await supabase.from('franchises').delete().eq('id', franchiseId);
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

// RPC helpers
export async function getFranchiseRanking(date, franchiseId) {
  const { data, error } = await supabase.rpc('get_franchise_ranking', {
    p_date: date,
    p_franchise_id: franchiseId,
  });
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
  async me() {
    return withTimeout((async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError || new Error('Not authenticated');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      return { ...user, ...profile };
    })());
  }
};
