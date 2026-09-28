-- S20.2 (Onda 6, 28/09/2026) — limpeza com prova de desuso. APLICADO 28/09 depois do teste
-- supabase/2026-09-28-s20-limpeza.teste.sql (roda tudo + exclusão real sintética e se desfaz).
-- Gerado por apps/dashboard/.tmp/onda6/gera-s20.mjs a partir do corpo VIVO das funções.
--
-- Prova de desuso (28/09): front (grep em src/), banco (pg_depend, pg_event_trigger, pg_trigger, outras
-- funções, views, policies, cron), n8n AO VIVO (190 workflows, ativos e inativos: 0 citações), ERP/bots/
-- automation/pcp/logistica/cs-celso (grep), logs da API 24 h (0 chamadas em 50.830 requisições REST;
-- controle: rpc/get_feature_flags 1.197). Tabelas com 0 linhas desde sempre (n_tup_ins = 0).
-- 🔴 rls_auto_enable NÃO entra: é a função do event trigger ensure_rls.
--
-- O que faz: delete_franchise_cascade e delete_user_complete sem o trecho de franchise_notes (resto
-- idêntico ao vivo; CREATE OR REPLACE mantém dono e permissões); DROP de franchise_notes e sales_goals;
-- DROP de 9 funções sem chamador; comment "obsoleta" em sales.net_value.
--
-- ROLLBACK (na ordem): reaplicar
--   docs/db-backups/s20-tabelas-mortas.2026-09-28-antes.sql        (recria as 2 tabelas vazias + RLS/policies/grants)
--   docs/db-backups/delete_franchise_cascade.2026-09-28-antes.sql  (corpo antigo)
--   docs/db-backups/delete_user_complete.2026-09-28-antes.sql      (corpo antigo)
--   docs/db-backups/s20-funcoes-sem-chamador.2026-09-28-antes.sql  (as 9 funções, com dono e GRANT/REVOKE)
--   comment on column public.sales.net_value is null;

begin;

CREATE OR REPLACE FUNCTION public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.delete_user_complete(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem deletar usuários';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível deletar a si mesmo';
  END IF;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

-- sem CASCADE de propósito: se algo ainda depender, o DROP falha e nada é aplicado
drop table public.franchise_notes;
drop table public.sales_goals;

drop function public.get_bot_conversation_summary(p_since timestamp with time zone);
drop function public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text);
drop function public.get_contact_by_phone(p_franchise_id text, p_telefone text);
drop function public.deduct_inventory(p_franchise_id text, p_items jsonb);
drop function public.get_network_touch_ranking(p_start date, p_end date);
drop function public.get_human_message_counts(p_since timestamp with time zone);
drop function public.get_human_message_totals(p_since timestamp with time zone);
drop function public.get_bot_leads_daily(p_since date);
drop function public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text);

comment on column public.sales.net_value is 'OBSOLETA (S20.2, 28/09/2026): só escrita (SaleForm e save_sale_with_items); ninguém lê. Faturamento = value - discount_amount + delivery_fee (getSaleNetValue). Não usar em relatório.';

commit;
