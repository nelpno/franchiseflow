-- bot_reports: relatórios quinzenais de coaching por franquia
-- Gerados pelo workflow n8n "Bot Coach Report" (cron 1º e 15º do mês)

CREATE TABLE bot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT NOT NULL,                -- evolution_instance_id
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  profile_tier TEXT NOT NULL CHECK (profile_tier IN ('beginner', 'intermediate', 'advanced')),
  autonomy_rate NUMERIC,
  autonomy_target NUMERIC,
  ranking_position INT,
  ranking_total INT,
  metrics JSONB NOT NULL,                    -- dados brutos por dimensão (9 dimensões)
  action_items JSONB,                        -- [{priority, category, message, impact_estimate}]
  report_text TEXT,                           -- texto WhatsApp gerado pelo LLM
  llm_model TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_bot_reports_franchise ON bot_reports(franchise_id, report_period_end DESC);
CREATE INDEX idx_bot_reports_period ON bot_reports(report_period_end);

-- RLS
ALTER TABLE bot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_reports_select" ON bot_reports
  FOR SELECT USING (is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids()));

CREATE POLICY "Admin deleta" ON bot_reports
  FOR DELETE USING (is_admin());

-- INSERT/UPDATE: apenas via service_role (n8n). Sem policy = bloqueado para users normais.
-- service_role bypassa RLS automaticamente.
