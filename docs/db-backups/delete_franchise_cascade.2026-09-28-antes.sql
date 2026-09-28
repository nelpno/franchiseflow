-- Backup do corpo VIVO antes da S20.2 (Onda 6). Reaplicar este arquivo = voltar.
-- delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) · dono postgres · md5(prosrc) f7725ce1b8731d6685c6b00e6da0cba1
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

  if p_dry_run then
    select count(*) into n from franchise_notes where franchise_id = p_franchise_id;
  else
    delete from franchise_notes where franchise_id = p_franchise_id;
    get diagnostics n = row_count;
  end if;
  if n > 0 then v_resumo := v_resumo || jsonb_build_object('franchise_notes', n); end if;

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
$function$
;

alter function public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) owner to postgres;
revoke all on function public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) from public;
grant execute on function public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) to postgres;
grant execute on function public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) to authenticated;
grant execute on function public.delete_franchise_cascade(p_franchise_id uuid, p_evolution_instance_id text, p_dry_run boolean) to service_role;
