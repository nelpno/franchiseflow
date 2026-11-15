-- Índices para get_admin_canais_venda (10/11/2026). Rodar UM comando por vez (concurrently não roda em transação).
-- Sem eles a RPC levava 1,7 s (7 dias) e 17 s (30 dias): varria 165 mil mensagens de entrada lendo o heap (content é TOAST).
--
-- ROLLBACK:
--   drop index concurrently if exists public.idx_conv_msg_in_cover;
--   drop index concurrently if exists public.idx_conv_msg_in_ped;

-- 1) mensagens de ENTRADA por data, cobrindo unidade e telefone (index-only scan para "contatos que escreveram")
create index concurrently if not exists idx_conv_msg_in_cover
  on public.conversation_messages (created_at) include (franchise_id, contact_phone)
  where direction = 'in';

-- 2) só as mensagens de entrada com #PED- (pedido do cardápio): poucas linhas
create index concurrently if not exists idx_conv_msg_in_ped
  on public.conversation_messages (franchise_id, created_at)
  where direction = 'in' and content like '%#PED-%';
