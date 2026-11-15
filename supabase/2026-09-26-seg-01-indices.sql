-- 2026-09-26 — Redesenho do admin, Fase 0 (B1) — INDICES
--
-- Por que: a home/Unidades nova agrega a REDE INTEIRA por data (mes ate hoje, 7 dias de
-- robo, ultimo pedido a fabrica). Os indices que existem comecam por franchise_id, entao
-- consulta "todas as unidades desde X" vira seq scan. Medido em pg_stat_user_tables
-- (estatistica desde 12/02/2026):
--   sales             178.452 seq scans, 1,63 bilhao de tuplas lidas por seq scan (20 mil linhas)
--   bot_conversations  18.863 seq scans, 1,10 bilhao de tuplas lidas (234 mil linhas, 148 MB)
--
-- Conferido em pg_indexes ANTES (nada cobre os de baixo):
--   sales:             (franchise_id, sale_date), (franchise_id, created_at desc), ... -> nenhum comeca por sale_date
--   bot_conversations: (franchise_id, started_at desc) include(...), (franchise_id, started_at),
--                      (contact_phone, started_at desc) -> nenhum comeca por started_at
--   purchase_orders:   (franchise_id), (status), (confirmed_by) -> falta a ordem por ordered_at.
--                      Tabela tem 413 linhas: ganho pequeno, custo ~zero. Mantido porque o
--                      plano pede "ultimo pedido por unidade" (DISTINCT ON / LATERAL LIMIT 1).
--
-- REMOCOES (provadas):
--   idx_daily_summaries_franchise_date = btree (franchise_id, date)  -> DUPLICATA EXATA das
--     colunas do UNIQUE daily_summaries_franchise_id_date_key = btree (franchise_id, date).
--     O unico fica (e ele que sustenta a constraint e o ON CONFLICT do cron). O planner passa
--     a usar o unico nas 99 mil leituras que hoje caem no duplicado.
--   idx_contacts_ctwa_clid = btree (ctwa_clid) where ctwa_clid is not null, 10 MB:
--     - idx_scan = 3 desde 12/02/2026 (7 meses);
--     - 42.958 de 64.872 contatos tem ctwa_clid (66%): indice parcial sem seletividade;
--     - grep no monorepo MaxiMassas inteiro: ctwa_clid so e LIDO (payload CAPI), nunca filtrado;
--     - unica funcao que cita (get_marketing_attribution) usa `ctwa_clid is not null OR
--       meta_ad_id is not null` junto com created_at -> EXPLAIN = Seq Scan em contacts (nao usa);
--     - nenhuma view cita. Custo hoje: 10 MB + escrita extra em todo upsert de contato do robo.
--
-- 🔴 CREATE/DROP INDEX CONCURRENTLY NAO roda dentro de transacao. Rodar CADA bloco abaixo
--    como UM statement isolado (um execute_sql por bloco; nada de colar o arquivo inteiro,
--    o MCP/Management API embrulha multiplos statements numa transacao e falha com
--    "cannot run inside a transaction block").
-- Se um CONCURRENTLY falhar no meio, sobra indice INVALID: conferir com a query de
-- conferencia (indisvalid) e dar DROP INDEX CONCURRENTLY nele antes de repetir.

-- ── Bloco 1 ────────────────────────────────────────────────────────────────
create index concurrently if not exists idx_sales_sale_date
  on public.sales (sale_date);

-- ── Bloco 2 ────────────────────────────────────────────────────────────────
create index concurrently if not exists idx_bot_conv_started_at
  on public.bot_conversations (started_at)
  include (franchise_id, contact_phone);

-- ── Bloco 3 ────────────────────────────────────────────────────────────────
create index concurrently if not exists idx_purchase_orders_franchise_ordered
  on public.purchase_orders (franchise_id, ordered_at desc);

-- ── Bloco 4 ────────────────────────────────────────────────────────────────
drop index concurrently if exists public.idx_daily_summaries_franchise_date;

-- ── Bloco 5 ────────────────────────────────────────────────────────────────
drop index concurrently if exists public.idx_contacts_ctwa_clid;


-- CONFERÊNCIA (rodar em query separada)
-- select coalesce(json_agg(t),'[]'::json) from (
--   select c.relname as indice, i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) as def
--   from pg_index i join pg_class c on c.oid = i.indexrelid
--   where c.relname in ('idx_sales_sale_date','idx_bot_conv_started_at','idx_purchase_orders_franchise_ordered',
--                       'idx_daily_summaries_franchise_date','idx_contacts_ctwa_clid','daily_summaries_franchise_id_date_key')
-- ) t;
-- Esperado: 3 novos com indisvalid=true; os 2 removidos AUSENTES; o unico de daily_summaries presente.
-- Prova de uso (dias depois): select indexrelname, idx_scan from pg_stat_user_indexes
--   where indexrelname in ('idx_sales_sale_date','idx_bot_conv_started_at','idx_purchase_orders_franchise_ordered');

-- ROLLBACK (cada linha e um statement isolado, fora de transacao)
-- drop index concurrently if exists public.idx_sales_sale_date;
-- drop index concurrently if exists public.idx_bot_conv_started_at;
-- drop index concurrently if exists public.idx_purchase_orders_franchise_ordered;
-- create index concurrently if not exists idx_daily_summaries_franchise_date on public.daily_summaries using btree (franchise_id, date);
-- create index concurrently if not exists idx_contacts_ctwa_clid on public.contacts using btree (ctwa_clid) where (ctwa_clid is not null);
