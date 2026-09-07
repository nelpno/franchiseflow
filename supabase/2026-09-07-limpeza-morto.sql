-- 2026-09-07 — apagar o que nao tem consumidor
--
-- POR QUE
--   Cada indice destes e mantido em TODO insert do robo (~1.800 mensagens/dia em
--   conversation_messages), e cada tabela de backup esquecida vira uma linha de ruido no
--   Security Advisor que faz a proxima sessao gastar tempo lendo achado que nao existe.
--
-- OS INDICES: numero medido, nao suposicao (pg_stat_user_indexes, estatisticas acumuladas
-- desde 12/02/2026 — quase 7 meses):
--   bot_conversations_phone_norm_idx .. 17 MB, idx_scan =  0
--   idx_conv_msg_model ................ 19 MB, idx_scan =  3   (Analyzer, desligado 08/06)
--   idx_bc_quality .................... 2,4 MB, idx_scan = 14   (Analyzer)
--   idx_bc_intent ..................... 2,3 MB, idx_scan =  1   (Analyzer)
--   Total: ~41 MB que ninguem le e que o banco atualiza a cada gravacao do robo.
--   NAO entram aqui, apesar de terem poucas leituras: idx_conv_msg_human_conv (36 leituras,
--   e o que faz get_bot_conversation_summary responder em 66 ms) e idx_contacts_ctwa_clid
--   (3 leituras, mas passou a ser usado hoje pela get_marketing_attribution).
--
-- A TABELA daily_checklists: ZERO linhas desde que foi criada, e a tela que a alimentava
--   (MyChecklist) nunca teve item de menu. Apagada junto com a tela neste mesmo commit.
--
-- AS TABELAS DE BACKUP: exportadas para docs/db-backups/*.json ANTES do drop (1, 32, 2,
--   66, 821 e 72 linhas). Ficam as duas de hoje, que ainda sao rede de seguranca da
--   propria auditoria: _backup_expenses_dup_marketing_2026_09_07 e
--   _backup_rls_policies_2026_09_07.
--
-- O QUE NAO FOI APAGADO, DE PROPOSITO
--   As 6 RPCs que o relatorio lista como "sem consumidor" (get_network_touch_ranking,
--   get_franchise_report_data, get_conversations_for_analysis, get_unprocessed_conversations,
--   deduct_inventory, update_contact_address). "Sem consumidor" ali significa sem consumidor
--   NO DASHBOARD — e os workflows do n8n tambem chamam RPC. deduct_inventory, em especial,
--   tem exatamente a cara do que o fluxo de venda do robo chamaria. Sem a chave da API do
--   n8n aqui, nao da para provar que ninguem chama, e drop de funcao viva quebra o robo em
--   silencio. Fica para quando der para varrer os workflows.
--
-- ROLLBACK
--   Os indices sao recriaveis (definicao completa no comentario de cada drop). As tabelas
--   de backup voltam dos JSON em docs/db-backups/. daily_checklists nao tem o que restaurar:
--   estava vazia.
begin;

-- CREATE INDEX bot_conversations_phone_norm_idx ON public.bot_conversations
--   USING btree (franchise_id, normalize_phone_br(contact_phone), started_at DESC)
--   WHERE ((contact_phone IS NOT NULL) AND (contact_phone <> ''::text));
drop index if exists public.bot_conversations_phone_norm_idx;

-- CREATE INDEX idx_conv_msg_model ON public.conversation_messages
--   USING btree (model_used, created_at DESC) WHERE (model_used IS NOT NULL);
drop index if exists public.idx_conv_msg_model;

-- CREATE INDEX idx_bc_quality ON public.bot_conversations USING btree (quality_score);
drop index if exists public.idx_bc_quality;

-- CREATE INDEX idx_bc_intent ON public.bot_conversations USING btree (intent);
drop index if exists public.idx_bc_intent;

drop table if exists public.daily_checklists cascade;

drop table if exists public._backup_araras_titularidade_20260805;
drop table if exists public._backup_promotions_combo_20260725;
drop table if exists public._backup_subs_20260806;
drop table if exists public._backup_unit_address_2026_08_26;
drop table if exists public.backup_outcome_pre_fix_20260428;
drop table if exists public.backup_save1_20260418;

commit;
