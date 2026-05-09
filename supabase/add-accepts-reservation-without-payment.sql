-- =============================================================================
-- Adiciona configuração: franquia aceita reserva/agendamento SEM pagamento antecipado
--
-- Default FALSE = mantém RC9 atual do bot vendedor V4 (bloqueia reserva sem pgto)
-- Quando TRUE, prompt do bot omite RC9 e adiciona regra positiva que OBRIGA
-- chamada de avisa_franqueado quando cliente fechar reserva pra data futura.
--
-- Aplicado: 2026-05-09. Plano: ~/.claude/plans/precisamos-resolver-a-quest-o-lovely-cookie.md
-- =============================================================================

ALTER TABLE public.franchise_configurations
  ADD COLUMN IF NOT EXISTS accepts_reservation_without_payment BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.franchise_configurations.accepts_reservation_without_payment IS
  'Se TRUE, franquia aceita reserva/agendamento de pedido para data futura sem pagamento antecipado. '
  'Bot vendedor V4 substitui RC9 (bloqueio rígido) por regra positiva que aceita reserva e OBRIGA '
  'chamada de avisa_franqueado para notificar humano. Default false mantém RC9 original.';

-- IMPORTANTE: Após aplicar este ALTER, rodar fix-vw-dadosunidade-v2-scale.sql
-- (com a nova coluna adicionada no SELECT) para que a view exponha o campo ao bot.
