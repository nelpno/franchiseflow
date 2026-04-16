-- =============================================================================
-- Coach Actions — Log de ações do Coach Diário
-- Nudges para franqueados + sugestões de prompt para Nelson
-- =============================================================================

CREATE TABLE IF NOT EXISTS coach_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT,              -- NULL = ação global (ex: sugestão prompt)
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  action_type TEXT NOT NULL CHECK (action_type IN ('nudge', 'prompt_suggestion', 'alert')),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  reason TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'dashboard', NULL)),
  sent_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  effective BOOLEAN,              -- NULL = não avaliado ainda
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coach_actions_date
  ON coach_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_actions_franchise
  ON coach_actions(franchise_id, action_date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_actions_type
  ON coach_actions(action_type, action_date DESC);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE coach_actions ENABLE ROW LEVEL SECURITY;

-- Service role (n8n Coach Diário escreve)
CREATE POLICY "coach_actions_service" ON coach_actions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/manager vê tudo, franqueado vê só as suas
CREATE POLICY "coach_actions_select" ON coach_actions FOR SELECT
  USING (is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids()));

-- Admin pode atualizar (marcar acknowledged, effective)
CREATE POLICY "coach_actions_admin_update" ON coach_actions FOR UPDATE
  USING (is_admin());

-- Admin pode deletar
CREATE POLICY "coach_actions_admin_delete" ON coach_actions FOR DELETE
  USING (is_admin());
