-- =============================================================================
-- Triggers BEFORE INSERT/UPDATE de normalizacao (Fase 5 do plano)
-- =============================================================================
-- Defense in depth: independente de qual caller gravou (SQL direto, n8n,
-- importacao manual, RPCs), o telefone fica sempre canonico no banco.
--
-- Depende de public.normalize_phone_br(text) criada na Fase 3.
--
-- Performance: UPDATE OF <col> limita o dispatch - trigger so dispara quando a
-- coluna especifica muda. Outras UPDATEs (contadores, endereco, etc.) nao
-- pagam overhead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcao generica (reutilizada pelos tres triggers)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_contact_telefone_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.telefone := public.normalize_phone_br(NEW.telefone);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.normalize_bot_contact_phone_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.contact_phone := public.normalize_phone_br(NEW.contact_phone);
  RETURN NEW;
END; $$;

-- -----------------------------------------------------------------------------
-- Trigger em contacts (dispara em INSERT ou UPDATE do campo telefone)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_normalize_contact_telefone ON public.contacts;
CREATE TRIGGER trg_normalize_contact_telefone
  BEFORE INSERT OR UPDATE OF telefone ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_contact_telefone_trigger();

-- -----------------------------------------------------------------------------
-- Trigger em bot_conversations (dispara em INSERT ou UPDATE de contact_phone)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_normalize_bot_contact_phone ON public.bot_conversations;
CREATE TRIGGER trg_normalize_bot_contact_phone
  BEFORE INSERT OR UPDATE OF contact_phone ON public.bot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_bot_contact_phone_trigger();

-- -----------------------------------------------------------------------------
-- Trigger em conversation_messages (dispara em INSERT ou UPDATE de contact_phone)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_normalize_msg_contact_phone ON public.conversation_messages;
CREATE TRIGGER trg_normalize_msg_contact_phone
  BEFORE INSERT OR UPDATE OF contact_phone ON public.conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_bot_contact_phone_trigger();

-- =============================================================================
-- Teste de sanidade pos-apply:
-- =============================================================================
-- INSERT INTO contacts (franchise_id, telefone, nome, status, source)
-- VALUES ('franquiaguarujasp', '+55 (11) 98765-4321', 'Teste Trigger', 'novo_lead', 'manual')
-- RETURNING id, telefone;  -- esperado: '11987654321'
-- DELETE FROM contacts WHERE nome = 'Teste Trigger';
