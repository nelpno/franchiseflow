-- 2026-09-27 cs 01 — Mural do CS, Onda 2: colunas novas (so aditivas)
--
-- O QUE FAZ
-- Acrescenta os campos que o estudo de 26/09 (cs-celso/analises/2026-09-26-estudo-mural-onda2.md,
-- secoes 2 e 5d) mostrou que faltam para medir o trabalho do CS:
--   cs_tasks ............ motivo congelado na abertura (motive_key, motive_evidence, motive_value,
--                         baseline_rev_day, rev_month_before), data de voltar (next_at), desfecho
--                         (closed_reason), "vai para o Nelson" (escalated_at/_note), historico de
--                         reabertura (reopen_count, last_closed_reason/_at) e o relogio do
--                         fechamento automatico (out_of_rule_since).
--   cs_worklist_events .. canal, resultado, combinado, voltar em, link da reuniao gravada;
--                         event_type ganha 'escalate' e 'park'.
--   cs_agreements ....... review_at (acordo com data de revisao).
-- Nenhuma tabela nova. Nenhuma policy muda (as colunas herdam a RLS de cada tabela).
--
-- POR QUE
-- Hoje o Mural guarda so "falei" e "resolvi": sem resultado, combinado, data de volta nem o
-- motivo do cartao, nao ha como dizer se a conversa mexeu na venda (estudo, secao 4.3).
--
-- DESVIO DO CONTRATO (1 coluna a mais): cs_tasks.motive_value numeric = o numero por tras do
-- motivo (% da queda, dias sem venda, dias sem robo, dias sem comprar, giro), atualizado todo
-- dia enquanto o cartao esta aberto. E o que permite a regra "fechado pelo CS nao volta em 14
-- dias A NAO SER QUE PIORE (queda +10 p.p. ou +7 dias sem venda)" — sem ele o reconcile nao
-- sabe como a unidade estava quando o cartao fechou.
--
-- BACKFILL (so preenche o que estava vazio; nada de cartao manual e reescrito em conteudo):
--   - motive_key = 'manual' nos cartoes manuais (todos).
--   - closed_reason = 'resolveu_sozinho' nos cartoes 'feito' cujo ultimo fechamento foi um
--     evento 'auto_resolve' (o radar fechou sem ninguem). Os fechados pelo "Resolver" antigo
--     ficam com closed_reason NULL = "sem desfecho registrado" (nao da para inventar).
--   - motive_key/evidence dos cartoes AUTOMATICOS abertos ficam NULL aqui: o 1o reconcile
--     novo (arquivo 03) congela com os numeros do dia em que rodar.
--
-- IDEMPOTENTE: add column if not exists; constraints recriadas com drop if exists.
-- LF. Aplicar pelo execute_sql. Ordem: 01 → 02 → 03 → 04 → 05 → 06.
--
-- COMO DESFAZER (so depois de desfazer 02..06, que usam estas colunas):
--   alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_event_type_check;
--   alter table public.cs_worklist_events add constraint cs_worklist_events_event_type_check
--     check (event_type = any (array['contact','meeting','note','resolve','reopen','move','auto_open','auto_resolve']));
--     (antes, apagar ou remapear eventos 'escalate'/'park' que existirem)
--   alter table public.cs_worklist_events drop column if exists channel, drop column if exists outcome,
--     drop column if exists commitment, drop column if exists next_at, drop column if exists drive_url;
--   alter table public.cs_tasks drop column if exists motive_key, drop column if exists motive_evidence,
--     drop column if exists motive_value, drop column if exists baseline_rev_day,
--     drop column if exists rev_month_before, drop column if exists next_at,
--     drop column if exists closed_reason, drop column if exists escalated_at,
--     drop column if exists escalated_note, drop column if exists reopen_count,
--     drop column if exists last_closed_reason, drop column if exists last_closed_at,
--     drop column if exists out_of_rule_since;
--   alter table public.cs_agreements drop column if exists review_at;

begin;

-- ---------- cs_tasks ----------
alter table public.cs_tasks
  add column if not exists motive_key         text,
  add column if not exists motive_evidence    text,
  add column if not exists motive_value       numeric,
  add column if not exists baseline_rev_day   numeric,
  add column if not exists rev_month_before   numeric,
  add column if not exists next_at            date,
  add column if not exists closed_reason      text,
  add column if not exists escalated_at       timestamptz,
  add column if not exists escalated_note     text,
  add column if not exists reopen_count       integer not null default 0,
  add column if not exists last_closed_reason text,
  add column if not exists last_closed_at     timestamptz,
  add column if not exists out_of_rule_since  date;

alter table public.cs_tasks drop constraint if exists cs_tasks_motive_key_check;
alter table public.cs_tasks add constraint cs_tasks_motive_key_check
  check (motive_key is null or motive_key in ('sem_venda','caiu','nao_lanca','robo_parado','sem_comprar','manual'));

alter table public.cs_tasks drop constraint if exists cs_tasks_closed_reason_check;
alter table public.cs_tasks add constraint cs_tasks_closed_reason_check
  check (closed_reason is null or closed_reason in ('resolvido','combinado_feito','recusou','nao_responde','resolveu_sozinho'));

alter table public.cs_tasks drop constraint if exists cs_tasks_last_closed_reason_check;
alter table public.cs_tasks add constraint cs_tasks_last_closed_reason_check
  check (last_closed_reason is null or last_closed_reason in ('resolvido','combinado_feito','recusou','nao_responde','resolveu_sozinho'));

alter table public.cs_tasks drop constraint if exists cs_tasks_text_len_check;
alter table public.cs_tasks add constraint cs_tasks_text_len_check
  check (char_length(coalesce(motive_evidence,'')) <= 500 and char_length(coalesce(escalated_note,'')) <= 1000);

-- ---------- cs_worklist_events ----------
alter table public.cs_worklist_events
  add column if not exists channel    text,
  add column if not exists outcome    text,
  add column if not exists commitment text,
  add column if not exists next_at    date,
  add column if not exists drive_url  text;

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_event_type_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_event_type_check
  check (event_type = any (array['contact','meeting','note','resolve','reopen','move','auto_open','auto_resolve','escalate','park']));

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_channel_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_channel_check
  check (channel is null or channel in ('mensagem','ligacao','reuniao'));

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_outcome_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_outcome_check
  check (outcome is null or outcome in ('vai_fazer','recusou','nao_respondeu','resolvido'));

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_commitment_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_commitment_check
  check (commitment is null or char_length(commitment) <= 300);

alter table public.cs_worklist_events drop constraint if exists cs_worklist_events_drive_url_check;
alter table public.cs_worklist_events add constraint cs_worklist_events_drive_url_check
  check (drive_url is null or (drive_url ~* '^https://' and char_length(drive_url) <= 500));

-- ---------- cs_agreements ----------
alter table public.cs_agreements add column if not exists review_at date;

-- ---------- backfill (so onde esta vazio) ----------
update public.cs_tasks set motive_key = 'manual'
 where source = 'manual' and motive_key is null;

update public.cs_tasks t set closed_reason = 'resolveu_sozinho'
 where t.column_status = 'feito' and t.closed_reason is null
   and (select e.event_type from public.cs_worklist_events e
         where e.task_id = t.id and e.event_type in ('auto_resolve','resolve')
         order by e.created_at desc limit 1) = 'auto_resolve';

-- indice para "cartoes com volta vencida" e para a lista do Nelson
create index if not exists cs_tasks_next_at on public.cs_tasks (next_at)
  where archived_at is null and column_status <> 'feito';
create index if not exists cs_worklist_events_created on public.cs_worklist_events (created_at desc);

commit;

-- CONFERÊNCIA (query separada):
--   select count(*) filter (where motive_key='manual') manuais_marcados,
--          count(*) filter (where closed_reason='resolveu_sozinho') resolveu_sozinho,
--          count(*) filter (where source='auto' and column_status<>'feito' and archived_at is null and motive_key is null) autos_sem_motivo
--   from public.cs_tasks;
--   (esperado em 26/09: 60 manuais; ~48 resolveu_sozinho; 4 autos abertos sem motivo ate o 1o reconcile)
