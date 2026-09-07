-- 2026-09-07 — Auditoria, Onda 0
-- Problema: as 3 RPCs de bot do Painel Geral do admin retornavam HTTP 500 em ~100% das
-- chamadas (statement_timeout de 8s para `authenticated`). Como supabase.rpc() resolve a
-- promise mesmo com erro, o AdminDashboard nunca mostrava erro: os cards de robo ficavam
-- vazios e a tela ainda esperava os 8s antes de pintar.
--
-- Medido em 07/09/2026 (pg_stat_statements, desde 20/03):
--   get_bot_leads_daily          2.589 chamadas, media 3.573 ms, max 7.996 ms
--   get_human_message_counts     1.613 chamadas, media 3.061 ms, max 7.992 ms
--   get_bot_conversation_summary 1.386 chamadas, media 2.386 ms, max 7.994 ms
-- (os "max" de ~7.99s sao o timeout batendo)
--
-- Tres causas, tres correcoes:
--
-- 1) get_bot_conversation_summary tinha um CTE `human_convos` que fazia
--    SELECT DISTINCT conversation_id sobre AS 938 MIL LINHAS de conversation_messages,
--    SEM filtro de data — enquanto o resto da query so olhava a janela de p_since.
--    Correcao: limitar o CTE a mesma janela (mensagem de uma conversa da janela sempre
--    cai na janela, entao e equivalente) + indice de cobertura para virar index-only.
--    EXPLAIN: CTE 6.301 ms -> 186 ms; query inteira 12.614 ms -> 2.317 ms.
--    (Testado tambem EXISTS correlacionado: PIOR — 38s, 115 mil loops.)
--
-- 2) get_human_message_counts devolvia UMA LINHA POR CONVERSA (dezenas de milhares),
--    mas o unico consumidor (AdminDashboard -> AlertsPanel "intervencao humana
--    excessiva") SOMA por franquia. Pior: o PostgREST corta em 1.000 linhas, entao o
--    alerta ja vinha silenciosamente truncado. Nova funcao agrega por franquia (62
--    linhas, 776 ms). A antiga fica de pe para nao quebrar consumidor desconhecido;
--    remover na limpeza da Onda 4 depois de confirmar 0 usos.
--
-- 3) As policies de SELECT das duas tabelas chamavam is_admin_or_manager() e
--    managed_franchise_ids() SEM `(select ...)` — as duas sao STABLE e sem argumento,
--    entao o Postgres so as promove a InitPlan (1 execucao por query) quando estao
--    dentro de um subselect. Sem isso, rodam UMA VEZ POR LINHA. E a mesma regra que o
--    CLAUDE.md ja manda aplicar para auth.uid().
--
-- Rollback no fim do arquivo.

-- ── 1. Indice de cobertura para o CTE de mensagens humanas ────────────────────
-- Criado com CONCURRENTLY em 07/09 (a tabela recebe escrita do bot o tempo todo).
-- 15 MB. Deixado aqui como documentacao — ja aplicado.
-- create index concurrently if not exists idx_conv_msg_human_conv
--   on public.conversation_messages (created_at, conversation_id)
--   where direction = 'human';

-- ── 2. RLS: helpers uma vez por query, nao uma vez por linha ──────────────────
alter policy conv_msg_select on public.conversation_messages
  using (
    (select public.is_admin_or_manager())
    or franchise_id = any ((select public.managed_franchise_ids()))
  );

alter policy bot_conv_select on public.bot_conversations
  using (
    (select public.is_admin_or_manager())
    or franchise_id in (
      select unnest(p.managed_franchise_ids) from public.profiles p
      where p.id = (select auth.uid())
    )
  );

alter policy bot_conv_update on public.bot_conversations
  using (
    (select public.is_admin_or_manager())
    or franchise_id in (
      select unnest(p.managed_franchise_ids) from public.profiles p
      where p.id = (select auth.uid())
    )
  );

-- ── 3. get_bot_conversation_summary com o CTE dentro da janela ────────────────
create or replace function public.get_bot_conversation_summary(
  p_since timestamp with time zone default (now() - '90 days'::interval)
)
returns table(
  franchise_id text, day date, total bigint, converted bigint,
  abandoned bigint, ongoing bigint, autonomous bigint, with_human_msgs bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_or_manager() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  return query
  with human_convos as (
    -- A JANELA AQUI E OBRIGATORIA. Sem ela isto varre a tabela inteira (938k linhas)
    -- e a funcao estoura o statement_timeout de 8s. Uma mensagem de uma conversa
    -- iniciada depois de p_since tambem foi criada depois de p_since, entao filtrar
    -- por created_at nao muda o resultado.
    select distinct cm.conversation_id
    from public.conversation_messages cm
    where cm.direction = 'human'
      and cm.created_at >= p_since
      and cm.conversation_id is not null
  )
  select
    bc.franchise_id,
    bc.started_at::date as day,
    count(*) as total,
    count(*) filter (where bc.outcome = 'converted' or bc.status = 'converted') as converted,
    count(*) filter (where bc.outcome = 'abandoned' or bc.status = 'abandoned') as abandoned,
    count(*) filter (
      where bc.outcome = 'ongoing'
      or (bc.outcome is null and bc.status = 'started' and bc.updated_at >= now() - interval '24 hours')
    ) as ongoing,
    count(*) filter (where hc.conversation_id is null) as autonomous,
    count(*) filter (where hc.conversation_id is not null) as with_human_msgs
  from public.vw_bot_conversations bc
  left join human_convos hc on hc.conversation_id = bc.id
  where bc.started_at >= p_since
  group by bc.franchise_id, bc.started_at::date;
end;
$function$;

-- ── 4. Totais de mensagem humana POR FRANQUIA (substitui a versao por conversa) ──
create or replace function public.get_human_message_totals(
  p_since timestamp with time zone default (now() - '90 days'::interval)
)
returns table(franchise_id text, msg_count bigint, conv_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    cm.franchise_id,
    count(*) as msg_count,
    count(distinct cm.conversation_id) as conv_count
  from public.conversation_messages cm
  where cm.direction = 'human'
    and cm.created_at >= p_since
  group by cm.franchise_id;
$function$;

revoke all on function public.get_human_message_totals(timestamp with time zone) from public;
grant execute on function public.get_human_message_totals(timestamp with time zone) to authenticated;

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- alter policy conv_msg_select on public.conversation_messages
--   using (is_admin_or_manager() or franchise_id = any (managed_franchise_ids()));
-- alter policy bot_conv_select on public.bot_conversations
--   using (is_admin_or_manager() or franchise_id in (
--     select unnest(profiles.managed_franchise_ids) from profiles where profiles.id = (select auth.uid())));
-- alter policy bot_conv_update on public.bot_conversations  -- idem bot_conv_select
-- drop function if exists public.get_human_message_totals(timestamp with time zone);
-- get_bot_conversation_summary: versao anterior em docs/db-backups/ (mesmo corpo, CTE sem
--   `and cm.created_at >= p_since`) — nao voltar sem antes derrubar o indice, senao o
--   timeout volta.
