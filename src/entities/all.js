import { supabase } from '@/api/supabaseClient';

function parseOrderBy(orderByStr) {
  if (!orderByStr) return null;
  const desc = orderByStr.startsWith('-');
  const column = desc ? orderByStr.slice(1) : orderByStr;
  return { column, ascending: !desc };
}

function createEntity(tableName) {
  return {
    async list(orderBy, limit) {
      let query = supabase.from(tableName).select('*');
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
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
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: created, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },

    async update(id, data) {
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
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

// Entidades com nomes de tabela Supabase
export const Franchise = createEntity('franchises');
export const Sale = createEntity('sales');
export const DailyUniqueContact = createEntity('daily_unique_contacts');
export const DailySummary = createEntity('daily_summaries');
export const FranchiseConfiguration = createEntity('franchise_configurations');
export const OnboardingChecklist = createEntity('onboarding_checklists');
export const DailyChecklist = createEntity('daily_checklists');
export const Message = createEntity('messages');

// Novas entidades (FASE 3)
export const InventoryItem = createEntity('inventory_items');
export const Contact = createEntity('contacts');

export const FranchiseInvite = createEntity('franchise_invites');
export const MarketingFile = createEntity('marketing_files');
export const SaleItem = createEntity('sale_items');
export const Expense = createEntity('expenses');
export const PurchaseOrder = createEntity('purchase_orders');
export const PurchaseOrderItem = createEntity('purchase_order_items');

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw authError || new Error('Not authenticated');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;
    return { ...user, ...profile };
  }
};
