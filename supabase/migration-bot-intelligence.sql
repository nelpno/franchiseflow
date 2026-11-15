-- =============================================================================
-- Bot Intelligence — Migration
-- Adiciona campos de classificação LLM + corrige RLS para incluir manager
-- Ref: docs/superpowers/specs/2026-04-04-bot-intelligence-design.md
-- =============================================================================

-- 1. Campos de classificação LLM em bot_conversations
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS intent TEXT
  CHECK (intent IN ('compra','duvida_produto','duvida_entrega','reclamacao',
                    'preparo_faq','preco','catalogo','saudacao','outro'));

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IN ('positivo','neutro','negativo','frustrado'));

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS outcome TEXT
  CHECK (outcome IN ('converted','abandoned','escalated','informational','ongoing'));

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS quality_score SMALLINT
  CHECK (quality_score BETWEEN 1 AND 10);

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS quality_notes TEXT;

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS tools_used TEXT[];

-- NOTA: `abandon_reason` (sem prefixo) já existe na tabela original mas nunca é populado.
-- Usamos `llm_abandon_reason` para a classificação do LLM, evitando ambiguidade.
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS llm_abandon_reason TEXT
  CHECK (llm_abandon_reason IN ('preco','frete','indisponivel','demora',
                                 'confuso','sem_resposta','preferiu_humano','outro'));

ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS improvement_hint TEXT;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS processing_model TEXT;

-- 2. Índices para queries do dashboard de inteligência
CREATE INDEX IF NOT EXISTS idx_bc_franchise_status ON bot_conversations(franchise_id, status);
CREATE INDEX IF NOT EXISTS idx_bc_processed ON bot_conversations(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bc_intent ON bot_conversations(intent);
CREATE INDEX IF NOT EXISTS idx_bc_quality ON bot_conversations(quality_score);

-- 3. Corrigir RLS: incluir manager (padrão do projeto usa is_admin_or_manager())
-- Policy SELECT existente usa role='admin' — manager fica sem acesso
DROP POLICY IF EXISTS "bot_conv_select" ON bot_conversations;

CREATE POLICY "bot_conv_select" ON bot_conversations FOR SELECT USING (
  is_admin_or_manager()
  OR franchise_id = ANY(
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = auth.uid()
  )
);

-- INSERT: bot (service_role) já tem policy ALL. Adicionar para admin/manager via app
CREATE POLICY "bot_conv_insert" ON bot_conversations FOR INSERT WITH CHECK (
  is_admin_or_manager()
  OR franchise_id = ANY(
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = auth.uid()
  )
);

-- UPDATE: admin/manager podem atualizar (ex: classificação manual futura)
CREATE POLICY "bot_conv_update" ON bot_conversations FOR UPDATE USING (
  is_admin_or_manager()
  OR franchise_id = ANY(
    SELECT unnest(managed_franchise_ids) FROM profiles WHERE id = auth.uid()
  )
);

-- DELETE: apenas admin (padrão do projeto — manager NÃO deleta)
CREATE POLICY "bot_conv_delete" ON bot_conversations FOR DELETE USING (
  is_admin()
);
