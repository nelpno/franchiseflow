-- ============================================
-- Índices faltantes para escalabilidade
-- Criados em 2026-03-24
-- ============================================

-- Contacts: bot n8n faz lookup por telefone frequentemente
CREATE INDEX IF NOT EXISTS idx_contacts_franchise ON contacts(franchise_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(franchise_id, telefone);

-- Sale Items: JOIN frequente com sales
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- Purchase Orders: franqueado consulta seus pedidos
CREATE INDEX IF NOT EXISTS idx_purchase_orders_franchise ON purchase_orders(franchise_id);

-- Notifications: polling a cada 30s por todos os users logados
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Audit Logs: admin consulta por franquia
CREATE INDEX IF NOT EXISTS idx_audit_logs_franchise ON audit_logs(franchise_id);

-- ============================================
-- Índices compostos para performance (2026-03-25)
-- ============================================

-- Dashboard: Sale.filter({ franchise_id, sale_date }) — query mais frequente
CREATE INDEX IF NOT EXISTS idx_sales_franchise_date ON sales(franchise_id, sale_date DESC);

-- Vendas: Sale.list("-created_at", 500) filtrado por franchise
CREATE INDEX IF NOT EXISTS idx_sales_franchise_created ON sales(franchise_id, created_at DESC);

-- Dashboard admin: DailySummary por franchise e data
CREATE INDEX IF NOT EXISTS idx_daily_summaries_franchise_date ON daily_summaries(franchise_id, date DESC);

-- Toda página carrega config da franquia
CREATE INDEX IF NOT EXISTS idx_franchise_config_evo_id ON franchise_configurations(franchise_evolution_instance_id);

-- TabResultado: despesas por franquia
CREATE INDEX IF NOT EXISTS idx_expenses_franchise ON expenses(franchise_id);

-- Pipeline leads: contatos por franquia e status
CREATE INDEX IF NOT EXISTS idx_contacts_franchise_status ON contacts(franchise_id, status);

-- Admin dashboard: agrupa inventory por franchise
CREATE INDEX IF NOT EXISTS idx_inventory_franchise ON inventory_items(franchise_id);
