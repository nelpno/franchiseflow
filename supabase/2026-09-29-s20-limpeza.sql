-- S20.2 — limpeza com prova de desuso (roteiro do franqueado, Onda 6)
-- 🔴 RASCUNHO — NÃO APLICAR ASSIM. P3 (Codex, 28/09/2026) reprovou o SQL; o front da S20.2 saiu sem ele.
--   1. rls_auto_enable NÃO é órfã: é a função do event trigger ensure_rls (liga RLS em tabela
--      nova). Retirada da lista abaixo (conferido em pg_event_trigger).
--   2. O teste por prosrc ILIKE %franchise_notes% falha pelos próprios comentários dentro dos corpos.
--   3. Migração e teste no mesmo arquivo terminando em RAISE: separar (BEGIN/COMMIT × BEGIN/ROLLBACK).
--   4. Rollback por pg_get_functiondef não devolve dono nem GRANT/REVOKE das funções dropadas.
--   5. Falta o corpo VIVO das 2 funções reescritas (backup em docs/db-backups/) e o diff contra ele.
--   6. O teste não percorre a exclusão real (dry_run=true; delete_user_complete para no guard).
--   DROP de tabela/função só com o ok do Nelson.
-- NÃO APLICADO. Gerado no worktree C:/Temp/wt-s20 (branch onda6/s20), 29/09/2026.
--
-- Prova de desuso está no relatório final da trilha S20.2 (front: grep em src/;
-- banco: pg_proc/pg_trigger/cron.job/pg_views; n8n LIVE: teste.dynamicagents.tech/api/v1/workflows,
-- todos os 190 workflows, ativos e inativos; outros consumidores: bots/, automation/,
-- operations/pcp, logistica/, cs-celso/, apps/erp/erp-maxi-massas — só docs/backups históricos,
-- nenhum consumidor vivo).
--
-- ============================================================================
-- ROLLBACK (para desfazer este arquivo INTEIRO, se algum dia for aplicado):
-- ============================================================================
--   -- 1) Recriar sales.net_value sem o comentário de obsolescência:
--   comment on column public.sales.net_value is null;
--
--   -- 2) Restaurar as duas funções alteradas a partir do backup do corpo vivo
--   --    (gerado ANTES de aplicar este arquivo, pelo orquestrador):
--   --    docs/db-backups/delete_franchise_cascade.2026-09-29-antes.sql
--   --    docs/db-backups/delete_user_complete.2026-09-29-antes.sql
--   --    (reaplicar o arquivo de backup = CREATE OR REPLACE FUNCTION com o corpo antigo)
--
--   -- 3) Recriar as tabelas dropadas a partir do dump feito ANTES do DROP
--   --    (pg_dump -t public.sales_goals -t public.franchise_notes, ou export
--   --    manual — o Nelson decide se restaura; nenhuma tem dado vivo em 28/09).
--
--   -- 4) Recriar as 10 funções dropadas: pg_get_functiondef salvo em
--   --    docs/db-backups/s20-funcoes-sem-chamador.2026-09-29-antes.sql
--   --    (gerar ANTES de aplicar; o corpo de cada uma está reproduzido nos
--   --    comentários da seção 4 abaixo, mas o arquivo de backup é a fonte).
-- ============================================================================


-- ============================================================================
-- 1) sales.net_value — marcar OBSOLETA (não remover; ninguém lê, várias
--    escrevem). Front: SaleForm.jsx grava (linhas 1168/1207) e save_sale_with_items
--    persiste (parâmetro p_sale_data->>'net_value'); Vendas.jsx e TabResultado.jsx
--    SELECIONAM a coluna mas NENHUM lugar do front lê `sale.net_value` de volta —
--    salesExport.js sempre RECALCULA via getSaleNetValue(sale) (grep: 0 ocorrências
--    de `.net_value` fora de SELECT/INSERT/UPDATE). No banco só aparece em
--    audit_sale_delete (grava o valor antigo no audit_logs.details no delete —
--    isso fica valendo, é log histórico) e no próprio save_sale_with_items (grava).
--    Regra do CLAUDE.md: "faturamento = getSaleNetValue, nunca net_value" — a
--    coluna é write-only por trás dessa regra. Risco zero: comentário não muda
--    comportamento.
-- ============================================================================
comment on column public.sales.net_value is
  'OBSOLETA (29/09/2026, S20.2): coluna write-only. SaleForm/save_sale_with_items ainda gravam '
  'por compatibilidade e audit_sale_delete ainda loga o valor antigo no delete, mas NINGUÉM lê '
  'sale.net_value de volta — faturamento/valor recebido é SEMPRE getSaleNetValue(sale) '
  '(value - discount_amount + delivery_fee), em src/lib/financialCalcs.js. Não remover sem '
  'antes tirar a escrita de SaleForm.jsx e save_sale_with_items (fora do escopo desta limpeza).';


-- ============================================================================
-- 2) Tabelas mortas — prova de desuso e ajuste do teardown ANTES do DROP
-- ============================================================================
--
-- 2a) sales_goals: 0 linhas, 0 INSERT/UPDATE/DELETE desde sempre (n_tup_ins=0),
--     nenhum leitor no front, no n8n LIVE (190 workflows, nenhum cita) nem em
--     bots/automation/pcp/logistica/cs-celso/erp (só automation/backups/, histórico).
--     Único lugar que cita o nome é src/lib/franchiseTeardown.js (mapa de rótulos
--     do dry-run de exclusão de franquia — "metas"); delete_franchise_cascade NÃO
--     a referencia por NOME: ela descobre e apaga por franchise_id (TEXT) via
--     information_schema.columns em tempo de execução (loop dinâmico, seção 2 da
--     função) — dropar a tabela é seguro pra essa função (ela só deixa de achá-la
--     na próxima chamada, sem erro de compilação nem de execução).
--     AÇÃO: só tirar a linha do label map em franchiseTeardown.js (front, feito
--     nesta trilha) + DROP TABLE aqui.
--
-- 2b) franchise_notes: 0 linhas hoje. Front: 0 leitores/escritores — o componente
--     que escrevia (FranchiseNotes.jsx, telas de Acompanhamento) foi REMOVIDO em
--     03/07/2026 (ver CLAUDE.md do dashboard, "Health Score — REMOVIDO"). MAS a
--     tabela é citada por NOME (estática) em duas funções de teardown:
--       - delete_franchise_cascade: `delete from franchise_notes where franchise_id = p_franchise_id`
--       - delete_user_complete:      `DELETE FROM franchise_notes WHERE user_id = p_user_id`
--     Dropar a tabela SEM tirar essas duas linhas armaria a bomba clássica do
--     CLAUDE.md (DROP TABLE quebra em runtime toda função que a cita por nome).
--     AÇÃO: recriar as duas funções SEM a referência a franchise_notes (abaixo),
--     confirmar que compilam e rodam (bloco de teste no fim), só DEPOIS o DROP.
--
-- Nenhuma das duas tem dado (0 linhas) — não há export a fazer antes do drop.

-- 2b.i) Backup do corpo vivo ANTES de aplicar (o orquestrador gera, caminho já
--       reservado): docs/db-backups/delete_franchise_cascade.2026-09-29-antes.sql
--                    docs/db-backups/delete_user_complete.2026-09-29-antes.sql

create or replace function public.delete_franchise_cascade(
  p_franchise_id uuid,
  p_evolution_instance_id text,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r           record;
  n           bigint;
  v_sale_ids  uuid[];
  v_order_ids uuid[];
  v_user      record;
  v_resto     text[];
  v_resumo    jsonb := '{}'::jsonb;
  v_usuarios  jsonb := '[]'::jsonb;
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem excluir franquias' using errcode = '42501';
  end if;

  if p_franchise_id is null or coalesce(p_evolution_instance_id, '') = '' then
    raise exception 'Franquia nao identificada' using errcode = '22023';
  end if;

  -- 1. Filhas ligadas pelo id do PAI (nao tem franchise_id proprio)
  select array_agg(id) into v_sale_ids  from sales           where franchise_id = p_evolution_instance_id;
  select array_agg(id) into v_order_ids from purchase_orders where franchise_id = p_evolution_instance_id;

  if v_sale_ids is not null then
    if p_dry_run then
      select count(*) into n from sale_items where sale_id = any(v_sale_ids);
    else
      delete from sale_items where sale_id = any(v_sale_ids);
      get diagnostics n = row_count;
    end if;
    if n > 0 then v_resumo := v_resumo || jsonb_build_object('sale_items', n); end if;
  end if;

  if v_order_ids is not null then
    if p_dry_run then
      select count(*) into n from purchase_order_items where order_id = any(v_order_ids);
    else
      delete from purchase_order_items where order_id = any(v_order_ids);
      get diagnostics n = row_count;
    end if;
    if n > 0 then v_resumo := v_resumo || jsonb_build_object('purchase_order_items', n); end if;
  end if;

  -- 2. Toda tabela com coluna franchise_id TEXT, descoberta agora
  --    (sales_goals já não existe depois do DROP desta migração — some do loop
  --    em silêncio, sem erro, porque a descoberta é via information_schema)
  for r in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on  t.table_schema = c.table_schema
        and t.table_name   = c.table_name
        and t.table_type   = 'BASE TABLE'
     where c.table_schema  = 'public'
       and c.column_name   = 'franchise_id'
       and c.data_type     = 'text'
       and left(c.table_name, 8) <> '_backup_'
     order by c.table_name
  loop
    if p_dry_run then
      execute format('select count(*) from public.%I where franchise_id = $1', r.table_name)
        into n using p_evolution_instance_id;
    else
      execute format('delete from public.%I where franchise_id = $1', r.table_name)
        using p_evolution_instance_id;
      get diagnostics n = row_count;
    end if;
    if n > 0 then v_resumo := v_resumo || jsonb_build_object(r.table_name, n); end if;
  end loop;

  -- 3. Excecoes de nome/tipo que o laco nao alcanca
  if p_dry_run then
    select count(*) into n from franchise_configurations
     where franchise_evolution_instance_id = p_evolution_instance_id;
  else
    delete from franchise_configurations
     where franchise_evolution_instance_id = p_evolution_instance_id;
    get diagnostics n = row_count;
  end if;
  if n > 0 then v_resumo := v_resumo || jsonb_build_object('franchise_configurations', n); end if;

  -- [S20.2] bloco de franchise_notes REMOVIDO daqui (tabela dropada nesta
  -- migração; 0 linhas em 28/09, sem escritor desde a remoção do Acompanhamento
  -- em 03/07/2026).

  -- 3b. Segunda passada: trigger de auditoria regrava enquanto o laco roda
  if not p_dry_run then
    for r in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on  t.table_schema = c.table_schema
          and t.table_name   = c.table_name
          and t.table_type   = 'BASE TABLE'
       where c.table_schema  = 'public'
         and c.column_name   = 'franchise_id'
         and c.data_type     = 'text'
         and left(c.table_name, 8) <> '_backup_'
       order by c.table_name
    loop
      execute format('delete from public.%I where franchise_id = $1', r.table_name)
        using p_evolution_instance_id;
      get diagnostics n = row_count;
      if n > 0 then
        v_resumo := v_resumo || jsonb_build_object(
          r.table_name, coalesce((v_resumo ->> r.table_name)::bigint, 0) + n);
      end if;
    end loop;
  end if;

  -- 4. Usuarios vinculados
  for v_user in
    select id, managed_franchise_ids, role,
           coalesce(nullif(full_name, ''), email, '(sem nome)') as nome
      from profiles
     where managed_franchise_ids @> array[p_franchise_id::text]
        or managed_franchise_ids @> array[p_evolution_instance_id]
     order by id
  loop
    select array(
      select unnest(v_user.managed_franchise_ids)
      except select p_franchise_id::text
      except select p_evolution_instance_id
    ) into v_resto;

    if v_user.role = 'franchisee' and coalesce(array_length(v_resto, 1), 0) = 0 then
      v_usuarios := v_usuarios || jsonb_build_object(
        'acao', 'conta_apagada', 'nome', v_user.nome, 'id', v_user.id, 'papel', v_user.role);
      if not p_dry_run then
        perform delete_user_complete(v_user.id);
      end if;
    else
      v_usuarios := v_usuarios || jsonb_build_object(
        'acao', 'desvinculado', 'nome', v_user.nome, 'id', v_user.id, 'papel', v_user.role,
        'franquias_restantes', coalesce(array_length(v_resto, 1), 0));
      if not p_dry_run then
        update profiles set managed_franchise_ids = v_resto where id = v_user.id;
      end if;
    end if;
  end loop;

  -- 5. A franquia
  if p_dry_run then
    select count(*) into n from franchises where id = p_franchise_id;
    if n = 0 then
      raise exception 'Franquia % nao encontrada', p_franchise_id using errcode = '02000';
    end if;
  else
    delete from franchises where id = p_franchise_id;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Franquia % nao encontrada', p_franchise_id using errcode = '02000';
    end if;
  end if;
  v_resumo := v_resumo || jsonb_build_object('franchises', n);

  -- 3c. Conferencia: sobrou alguma linha? Entao desfaz tudo e diz onde.
  if not p_dry_run then
    for r in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on  t.table_schema = c.table_schema
          and t.table_name   = c.table_name
          and t.table_type   = 'BASE TABLE'
       where c.table_schema  = 'public'
         and c.column_name   = 'franchise_id'
         and c.data_type     = 'text'
         and left(c.table_name, 8) <> '_backup_'
    loop
      execute format('select count(*) from public.%I where franchise_id = $1', r.table_name)
        into n using p_evolution_instance_id;
      if n > 0 then
        raise exception 'Sobraram % linhas em % apos a exclusao — nada foi apagado.',
          n, r.table_name using errcode = '23000';
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'dry_run',  p_dry_run,
    'franquia', p_evolution_instance_id,
    'tabelas',  v_resumo,
    'usuarios', v_usuarios
  );
end;
$function$;

create or replace function public.delete_user_complete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem deletar usuários';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível deletar a si mesmo';
  END IF;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;
  -- [S20.2] `DELETE FROM franchise_notes WHERE user_id = p_user_id;` REMOVIDA
  -- (tabela dropada nesta migração; ver nota acima).
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

-- 2b.ii) Só agora os drops (0 linhas nas duas; sem dado a exportar)
drop table if exists public.sales_goals;
drop table if exists public.franchise_notes;


-- ============================================================================
-- 3) As 10 funções sem chamador (public, prokind='f', não-trigger)
--    Prova (29/09/2026): 0 chamadas em src/ (grep completo, inclusive fora do
--    padrão `.rpc('nome'`), 0 em pg_proc (nenhuma outra função cita), 0 em
--    cron.job, 0 em pg_views, 0 nos 190 workflows do n8n LIVE (ativos e
--    inativos, teste.dynamicagents.tech/api/v1/workflows), 0 em bots/,
--    automation/ (fora de automation/backups/, histórico), operations/pcp,
--    logistica/, cs-celso/, apps/erp/erp-maxi-massas. Backup completo
--    (pg_get_functiondef de cada uma) em
--    docs/db-backups/s20-funcoes-sem-chamador.2026-09-29-antes.sql (gerado
--    pelo orquestrador ANTES de aplicar).
--
--    get_bot_conversation_summary(timestamptz)  -- documentada no CLAUDE.md como
--      consumida por BotSummaryCard/AlertsPanel/healthScore.js, mas esses 3
--      foram removidos na auditoria de 29/05/2026 (0 imports); a RPC ficou
--      órfã desde então — CLAUDE.md desatualizado nesse ponto.
--    upsert_bot_contact(text,text,text)
--    get_contact_by_phone(text,text)
--    deduct_inventory(text,jsonb)                -- provável antecessora do
--      trigger stock_decrement (que hoje faz a baixa de estoque na venda).
--    rls_auto_enable()                            -- utilitário de migração
--      (varre pg_class e liga RLS em lote); não é chamada por app nenhum.
--    get_network_touch_ranking(date,date)         -- superada por
--      get_network_funnel_ranking/get_network_funnel_benchmark (ativas).
--    get_human_message_counts(timestamptz)
--    get_human_message_totals(timestamptz)
--    get_bot_leads_daily(date)
--    update_contact_address(uuid,text,text)
-- ============================================================================
drop function if exists public.get_bot_conversation_summary(timestamptz);
drop function if exists public.upsert_bot_contact(text, text, text);
drop function if exists public.get_contact_by_phone(text, text);
drop function if exists public.deduct_inventory(text, jsonb);
-- drop function if exists public.rls_auto_enable();  -- NÃO: é a função do event trigger ensure_rls (P3)
drop function if exists public.get_network_touch_ranking(date, date);
drop function if exists public.get_human_message_counts(timestamptz);
drop function if exists public.get_human_message_totals(timestamptz);
drop function if exists public.get_bot_leads_daily(date);
drop function if exists public.update_contact_address(uuid, text, text);


-- ============================================================================
-- 4) Bloco de TESTE — prova que delete_franchise_cascade e delete_user_complete
--    continuam compilando e rodando SEM franchise_notes, sem deixar nada no
--    banco (tudo dentro de uma exceção, que desfaz a transação inteira,
--    inclusive os CREATE OR REPLACE acima se rodado antes deles).
--    Rodar em uma transação descartável (BEGIN; ...corpo...; ROLLBACK;) ou
--    deixar a RAISE EXCEPTION final desfazer sozinha.
-- ============================================================================
do $$
declare
  v_franchise_id uuid;
  v_evo text := 's20-teste-' || substr(gen_random_uuid()::text, 1, 8);
  v_user_id uuid;
  v_result jsonb;
  v_resultado_texto text := '';
begin
  -- pré-condição: as funções já foram recriadas nesta sessão (CREATE OR REPLACE
  -- acima), então get_functiondef não pode mais citar franchise_notes
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_franchise_cascade'
      and p.prosrc ilike '%franchise_notes%'
  ) then
    raise exception 'RESULT FALHOU: delete_franchise_cascade ainda cita franchise_notes';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_user_complete'
      and p.prosrc ilike '%franchise_notes%'
  ) then
    raise exception 'RESULT FALHOU: delete_user_complete ainda cita franchise_notes';
  end if;
  v_resultado_texto := v_resultado_texto || 'OK: nenhuma das 2 funcoes cita franchise_notes mais. ';

  -- cria uma franquia sintética (is_test=true, nunca entra em métrica) e um
  -- usuário franqueado vinculado só a ela, exercita o dry_run (não apaga nada
  -- de verdade) e confere que roda sem erro de "relation franchise_notes does
  -- not exist" nem qualquer outro erro de compilação/execução.
  insert into franchises (id, evolution_instance_id, city, status, is_test, created_at)
  values (gen_random_uuid(), v_evo, 'Cidade Teste S20 - SP', 'active', true, now())
  returning id into v_franchise_id;

  select public.delete_franchise_cascade(v_franchise_id, v_evo, true) into v_result;
  if (v_result->>'dry_run')::boolean is not true then
    raise exception 'RESULT FALHOU: dry_run nao voltou dry_run=true — %', v_result;
  end if;
  v_resultado_texto := v_resultado_texto || 'OK: delete_franchise_cascade dry_run rodou sem erro: ' || v_result::text || '. ';

  -- delete_user_complete: só confere que compila e recusa auto-exclusão (não
  -- cria usuário de teste em auth.users — fora do escopo desta função de
  -- limpeza; a auditoria de 28/09 já cobriu isso).
  begin
    perform public.delete_user_complete(auth.uid());
    raise exception 'RESULT FALHOU: delete_user_complete deveria ter recusado auto-exclusao';
  exception
    when others then
      if sqlerrm ilike '%si mesmo%' or sqlerrm ilike '%admins podem%' then
        v_resultado_texto := v_resultado_texto || 'OK: delete_user_complete recusou (guard funcionando): ' || sqlerrm || '. ';
      else
        raise exception 'RESULT FALHOU: delete_user_complete deu erro inesperado: %', sqlerrm;
      end if;
  end;

  -- desfaz tudo (inclusive a franquia sintética e os CREATE OR REPLACE, se
  -- este bloco rodar dentro da mesma transação que eles) e devolve o resultado
  raise exception 'RESULT % ', v_resultado_texto;
end $$;
