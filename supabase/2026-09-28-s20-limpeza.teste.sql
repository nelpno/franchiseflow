-- TESTE da S20.2: aplica a migração e exercita tudo na MESMA transação implícita; o raise no fim desfaz.
-- Mandar o arquivo inteiro numa requisição só (node supabase/cs-cockpit/_aplica-lf.mjs <este arquivo>).
-- Esperado: erro "RESULT ok=true ..." (e nada fica no banco — conferir em consulta separada).
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

do $t$
declare
  v_admin uuid := (select id from profiles where role = 'admin' order by created_at limit 1);
  v_fid uuid; v_evo text; v_uid uuid := gen_random_uuid(); v_res jsonb; v_dry jsonb;
  c_cascade boolean; c_deluser boolean; c_tabelas boolean; c_funcs boolean; c_fr boolean; c_user boolean; c_prof boolean; c_rls boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  c_cascade := (select prosrc not ilike '%franchise_notes%' from pg_proc where proname = 'delete_franchise_cascade');
  c_deluser := (select prosrc not ilike '%franchise_notes%' from pg_proc where proname = 'delete_user_complete');
  c_tabelas := to_regclass('public.franchise_notes') is null and to_regclass('public.sales_goals') is null;
  c_funcs := not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('get_bot_conversation_summary','upsert_bot_contact','get_contact_by_phone','deduct_inventory','get_network_touch_ranking','get_human_message_counts','get_human_message_totals','get_bot_leads_daily','update_contact_address'));
  c_rls := exists (select 1 from pg_event_trigger e where e.evtname = 'ensure_rls');
  -- franquia sintética: exclusão REAL (não só dry_run)
  insert into franchises (name, owner_name, city, status, is_test) values ('S20 teste', 'Teste', 'Teste - SP', 'active', true)
    returning id, evolution_instance_id into v_fid, v_evo;
  v_dry := public.delete_franchise_cascade(v_fid, v_evo, true);
  v_res := public.delete_franchise_cascade(v_fid, v_evo, false);
  c_fr := not exists (select 1 from franchises where id = v_fid);
  -- usuário sintético: exclusão REAL
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's20-teste-' || v_uid || '@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb);
  insert into notifications (user_id, title, message) values (v_uid, 'x', 'x');
  perform public.delete_user_complete(v_uid);
  c_user := not exists (select 1 from auth.users where id = v_uid);
  c_prof := not exists (select 1 from profiles where id = v_uid);
  raise exception 'RESULT ok=% | cascade_sem_notes=% deluser_sem_notes=% tabelas_fora=% funcs_fora=% ensure_rls=% franquia_apagada=% usuario_apagado=% perfil_apagado=% | dry=% | real=%',
    (c_cascade and c_deluser and c_tabelas and c_funcs and c_rls and c_fr and c_user and c_prof),
    c_cascade, c_deluser, c_tabelas, c_funcs, c_rls, c_fr, c_user, c_prof, v_dry::text, v_res::text;
end $t$;
