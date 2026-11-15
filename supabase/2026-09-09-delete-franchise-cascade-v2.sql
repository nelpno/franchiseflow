-- Excluir franquia: a lista fixa de tabelas quebrou a exclusao INTEIRA, e deixava
-- resto para tras. Esta versao descobre as tabelas em tempo de execucao e devolve
-- o que apagou (ou o que apagaria, com p_dry_run).
--
-- O QUE ACONTECEU (09/09/2026, Cataguases). A versao anterior tinha
-- `DELETE FROM daily_checklists` e essa tabela foi dropada em 07/09 (onda 4 da
-- auditoria: zero linhas na vida). plpgsql resolve nome de tabela em RUNTIME, entao
-- nada acusou no deploy: a exclusao passou a morrer com 42P01 (undefined_table), que
-- o safeErrorMessage traduz para "Erro interno de configuracao. Contate o suporte."
-- Pior: o front cancela a cobranca no ASAAS ANTES de chamar esta funcao, entao a
-- Cataguases ficou VIVA e SEM COBRANCA (subscription_status CANCELLED, 09/09 16:30).
--
-- O QUE MAIS ESTAVA FALTANDO (medido na Cataguases, 14 linhas orfas):
--   cs_worklist_events 8 · cs_tasks 3 · system_subscriptions 1 · cs_worklist 1 ·
--   cs_agreements 1  (+ coach_actions e bot_reports, vazias nessa unidade)
-- Nenhuma dessas tem FK para `franchises`, entao ficavam para sempre, caladas.
--
-- POR QUE ISSO ERA GRAVE, e nao so sujeira: `auto_generate_instance_id` deriva o
-- evolution_instance_id da CIDADE ('franquia' || cidade sem acento) e so procura
-- duplicata em `franchises`. Excluir Cataguases e criar outra na mesma cidade devolve
-- o MESMO `franquiacataguasesmg` — e a unidade nova nasceria herdando a assinatura
-- CANCELADA, os cartoes velhos do mural do CS e, no Storage, o catalogo da franqueada
-- anterior (o bot remonta a URL por path fixo `{evo}/catalogo.jpg` e mandaria a imagem
-- errada para o cliente final).
--
-- DESENHO
--   1. `sale_items` e `purchase_order_items` saem ANTES do laco, pelos ids do pai:
--      as duas referenciam `inventory_items` com ON DELETE NO ACTION, e o laco apaga
--      inventory_items em ordem alfabetica (antes de sales). Sem isso, FK bloqueia.
--   2. Laco sobre TODA tabela do schema public com coluna `franchise_id` de tipo text.
--      Descoberta em tempo de execucao de proposito: tabela NOVA passa a ser limpa
--      sozinha, e tabela DROPADA some da lista em vez de derrubar a funcao.
--   3. As duas excecoes de nome/tipo, explicitas: `franchise_configurations`
--      (franchise_evolution_instance_id) e `franchise_notes` (franchise_id UUID).
--   3b. SEGUNDA PASSADA, e ela nao e paranoia: `audit_logs` sai no comeco do laco (ordem
--      alfabetica) e volta a encher no meio dele, porque `audit_on_sale_delete` grava um
--      registro por venda apagada. Na Cataguases sobravam 93 linhas — a versao antiga
--      escapava por acaso, so porque a lista fixa punha audit_logs depois de sales.
--      A passada 2 recolhe o que qualquer trigger tenha regravado.
--   3c. CONFERENCIA final na propria transacao: se ainda sobrar uma linha, a funcao
--      levanta excecao e o Postgres desfaz TUDO. Ou a franquia sai inteira, ou nao sai —
--      nunca meia excluida.
--   4. Usuarios: desvincula QUALQUER papel (a versao antiga so mexia em franchisee e
--      deixava id morto no array de admin/manager/CS) e apaga a conta so quando é
--      franqueado que ficou sem nenhuma franquia.
--   5. `franchises` por ultimo, e falha se nao achou a linha.
--
-- p_dry_run = true percorre o MESMO caminho contando em vez de apagar. O front chama
-- isso ao abrir o dialogo, o que (a) mostra ao admin o que vai sumir e (b) prova que a
-- exclusao vai passar ANTES de cancelar a cobranca no ASAAS.
--
-- NAO cobre, por serem de fora do banco (o front avisa, ver Franchises.jsx):
--   Storage (`{evo}/` em catalog-images, marketing-comprovantes, marketing-assets) —
--   apagado pelo front, que roda como admin e tem policy de DELETE nos tres buckets.
--   Instancia do WhatsApp no ZuckZapGo — exige o admin token, que nao pode ir ao
--   browser: `node supabase/scripts/limpar-instancia-zuck.mjs <evo_id> --apply`.
--   Cliente ASAAS (`asaas_customer_id`) — de proposito: e por CPF/CNPJ e o mesmo dono
--   costuma ter outras unidades nele. Quem se cancela e a ASSINATURA, nao o cliente.

drop function if exists public.delete_franchise_cascade(uuid, text);

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
$function$;

-- Estava exposta a PUBLIC e a anon (escapou da faxina da onda 0). O guard is_admin()
-- ja barrava, mas nao ha motivo para a funcao ser chamavel por deslogado.
revoke all on function public.delete_franchise_cascade(uuid, text, boolean) from public;
revoke all on function public.delete_franchise_cascade(uuid, text, boolean) from anon;
grant execute on function public.delete_franchise_cascade(uuid, text, boolean) to authenticated;
grant execute on function public.delete_franchise_cascade(uuid, text, boolean) to service_role;
