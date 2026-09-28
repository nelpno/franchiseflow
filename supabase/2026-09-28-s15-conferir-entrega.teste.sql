-- TESTE que se desfaz da S15 (NÃO deixa nada no banco).
-- Mandar NUMA requisição só: o conteúdo de 2026-09-28-s15-conferir-entrega.sql + este arquivo.
-- O bloco termina em raise exception 'RESULT ...': a exceção desfaz TUDO (colunas, funções,
-- trigger, pedido de teste, estoque, despesa, avisos). Conferir depois, em consulta SEPARADA,
-- que nada sobrou:
--   select count(*) from pg_proc where proname in ('confirmar_recebimento_pedido','s15_confirmar_recebimento','concluir_entregas_sem_resposta','s15_guard_conferencia');  -> 0
--   select count(*) from information_schema.columns where table_name='purchase_orders' and column_name='awaiting_since';  -> 0
--   select count(*) from purchase_orders where notes = 'S15 TESTE';  -> 0
-- Usa a unidade de teste franquiaararaquarasp (is_test, ui_v2 LIGADA) e 2 itens do catálogo dela.
-- Esperado: RESULT ok=... com todas as checagens "true" (qualquer "false" = não aplicar).

do $t$
declare
  v_evo    text := 'franquiaararaquarasp';
  v_admin  uuid;
  v_frq    uuid;
  v_outra  uuid;
  v_i1     record;
  v_i2     record;
  v_po     uuid := gen_random_uuid();
  v_off    uuid := gen_random_uuid();
  v_cli    uuid := gen_random_uuid();
  v_p1     uuid;
  v_p2     uuid;
  v_q1     integer;
  v_q2     integer;
  v_r      jsonb;
  v_r2     jsonb;
  v_st     text;
  v_err    text;
  v_res    text := '';
  v_n      integer;
  v_desp   numeric;
  v_frete  numeric;
  v_evo_off text;
  v_io     record;
  v_qo     integer;
begin
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  select id into v_frq from profiles where role = 'franchisee' and v_evo = any(managed_franchise_ids) limit 1;
  select id into v_outra from profiles where role = 'franchisee' and not (v_evo = any(managed_franchise_ids)) and cardinality(managed_franchise_ids) > 0 limit 1;
  select id, quantity into v_i1 from inventory_items where franchise_id = v_evo and created_by_franchisee is not true and cost_price > 0 order by product_name limit 1;
  select id, quantity into v_i2 from inventory_items where franchise_id = v_evo and created_by_franchisee is not true and cost_price > 0 and id <> v_i1.id order by product_name limit 1;

  -- pedido de teste: 10 + 4 unidades, frete 250, já confirmado pela fábrica
  insert into purchase_orders (id, franchise_id, status, total_amount, freight_cost, notes, confirmed_by, confirmed_at)
  values (v_po, v_evo, 'confirmado', 0, 250, 'S15 TESTE', v_admin, now());
  insert into purchase_order_items (order_id, inventory_item_id, product_name, quantity, unit_price)
  select v_po, ii.id, ii.product_name, case when ii.id = v_i1.id then 10 else 4 end, ii.cost_price
    from inventory_items ii where ii.id in (v_i1.id, v_i2.id);
  update purchase_orders set total_amount = (select sum(quantity * unit_price) from purchase_order_items where order_id = v_po) where id = v_po;
  select id into v_p1 from purchase_order_items where order_id = v_po and inventory_item_id = v_i1.id;
  select id into v_p2 from purchase_order_items where order_id = v_po and inventory_item_id = v_i2.id;

  -- 1) admin marca entregue (papel authenticated + claims do admin)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update purchase_orders set status = 'entregue', delivered_at = now() - interval '1 hour' where id = v_po returning status into v_st;
  perform set_config('role', 'postgres', true);
  select quantity into v_q1 from inventory_items where id = v_i1.id;
  v_res := v_res || ' em_rota=' || (v_st = 'em_rota')
                 || ' estoque_parado=' || (v_q1 = v_i1.quantity)
                 || ' sem_despesa=' || (not exists (select 1 from expenses where source_id = v_po));

  -- 2) UPDATE direto em_rota -> entregue barrado
  begin
    perform set_config('role', 'authenticated', true);
    update purchase_orders set status = 'entregue' where id = v_po;
    v_err := 'passou';
  exception when others then v_err := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  v_res := v_res || ' barra_direto=' || (v_err like 'Pedido: este pedido espera%');

  -- 3) outra unidade não confirma
  if v_outra is not null then
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_outra, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform confirmar_recebimento_pedido(v_po, null, gen_random_uuid());
      v_err := 'passou';
    exception when others then v_err := sqlerrm;
    end;
    perform set_config('role', 'postgres', true);
    v_res := v_res || ' outra_unidade_barrada=' || (v_err like 'Pedido: não encontrado%');
  end if;

  -- 4) franqueada (ou admin, se a unidade de teste não tiver franqueada) confere: faltou 3 do item 1 e 4 do item 2
  perform set_config('request.jwt.claims', json_build_object('sub', coalesce(v_frq, v_admin), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_r := confirmar_recebimento_pedido(v_po,
           jsonb_build_array(jsonb_build_object('item_id', v_p1, 'received_quantity', 7),
                             jsonb_build_object('item_id', v_p2, 'received_quantity', 0)),
           v_cli);
  -- 5) repetido (resposta perdida)
  v_r2 := confirmar_recebimento_pedido(v_po,
           jsonb_build_array(jsonb_build_object('item_id', v_p1, 'received_quantity', 7),
                             jsonb_build_object('item_id', v_p2, 'received_quantity', 0)),
           v_cli);
  perform set_config('role', 'postgres', true);
  select quantity into v_q1 from inventory_items where id = v_i1.id;
  select quantity into v_q2 from inventory_items where id = v_i2.id;
  select sum(amount) filter (where category = 'compra_produto'), sum(amount) filter (where category = 'transporte'), count(*)
    into v_desp, v_frete, v_n from expenses where source_id = v_po;
  v_res := v_res || ' modo_divergente=' || (v_r->>'modo' = 'divergente')
                 || ' estoque_mais7=' || (v_q1 = v_i1.quantity + 7)
                 || ' estoque_mais0=' || (v_q2 = v_i2.quantity)
                 || ' despesa_recebido=' || (v_desp = (select sum(received_quantity * unit_price) from purchase_order_items where order_id = v_po))
                 || ' frete_cobrado=' || (v_frete = 250)
                 || ' duas_despesas=' || (v_n = 2)
                 || ' total_corrigido=' || ((select total_amount from purchase_orders where id = v_po) = v_desp)
                 || ' repetido_idempotente=' || ((v_r2->>'ja_confirmado')::boolean and (v_r2->>'mesmo_envio')::boolean)
                 || ' admin_avisado=' || exists (select 1 from notifications where title = 'Entrega com diferença' and created_at > now() - interval '1 minute');

  -- 5b) P3: entregue é terminal e o total do que chegou não se sobrescreve (admin)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update purchase_orders set status = 'confirmado' where id = v_po;
    v_err := 'passou';
  exception when others then v_err := sqlerrm;
  end;
  update purchase_orders set total_amount = 999999, freight_cost = 0, expenses_generated_at = null where id = v_po;
  perform set_config('role', 'postgres', true);
  v_res := v_res || ' entregue_terminal=' || (v_err like 'Pedido: pedido entregue não muda%')
                 || ' total_travado=' || ((select total_amount from purchase_orders where id = v_po) = v_desp)
                 || ' frete_travado=' || ((select freight_cost from purchase_orders where id = v_po) = 250)
                 || ' carimbo_travado=' || ((select expenses_generated_at from purchase_orders where id = v_po) is not null)
                 || ' sem_despesa_nova=' || ((select count(*) from expenses where source_id = v_po) = 2);

  -- 6) cron: um 2º pedido parado há 49 h fecha sozinho com o pedido inteiro
  insert into purchase_orders (id, franchise_id, status, total_amount, freight_cost, notes, confirmed_by, confirmed_at)
  values (v_off, v_evo, 'confirmado', 0, 0, 'S15 TESTE', v_admin, now());
  insert into purchase_order_items (order_id, inventory_item_id, product_name, quantity, unit_price)
  select v_off, ii.id, ii.product_name, 2, ii.cost_price from inventory_items ii where ii.id = v_i1.id;
  update purchase_orders set status = 'entregue' where id = v_off;  -- postgres sem claims: flag da unidade -> em_rota
  perform set_config('s15.confirmando', 'on', true);
  update purchase_orders set awaiting_since = now() - interval '49 hours' where id = v_off;
  perform set_config('s15.confirmando', 'off', true);
  perform set_config('request.jwt.claims', '', true);
  select concluir_entregas_sem_resposta(48) into v_n;
  select quantity into v_q2 from inventory_items where id = v_i1.id;
  v_res := v_res || ' cron_fechou=' || ((select received_mode from purchase_orders where id = v_off) = 'automatico')
                 || ' cron_estoque=' || (v_q2 = v_i1.quantity + 7 + 2);

  -- 7) unidade SEM a chave: segue entregue direto (pega uma unidade real com ui_v2 desligada e reverte no fim junto)
  select f.evolution_instance_id into v_evo_off from franchises f
   where not coalesce(f.is_test, false) and f.status = 'active' and not public.feature_flag_enabled('ui_v2', f.evolution_instance_id) limit 1;
  select id, quantity into v_io from inventory_items where franchise_id = v_evo_off and created_by_franchisee is not true and cost_price > 0 limit 1;
  v_po := gen_random_uuid();
  insert into purchase_orders (id, franchise_id, status, total_amount, freight_cost, notes, confirmed_by, confirmed_at)
  values (v_po, v_evo_off, 'confirmado', 0, 0, 'S15 TESTE', v_admin, now());
  insert into purchase_order_items (order_id, inventory_item_id, product_name, quantity, unit_price)
  select v_po, ii.id, ii.product_name, 3, ii.cost_price from inventory_items ii where ii.id = v_io.id;
  update purchase_orders set status = 'entregue' where id = v_po returning status into v_st;
  select quantity into v_qo from inventory_items where id = v_io.id;
  v_res := v_res || ' sem_chave_entregue=' || (v_st = 'entregue') || ' sem_chave_estoque=' || (v_qo = v_io.quantity + 3);

  -- 8) grants
  v_res := v_res || ' anon_sem_exec=' || (not (has_function_privilege('anon', 'public.confirmar_recebimento_pedido(uuid, jsonb, uuid)', 'execute')
                                             or has_function_privilege('anon', 'public.s15_confirmar_recebimento(uuid, jsonb, uuid, boolean, uuid)', 'execute')
                                             or has_function_privilege('anon', 'public.concluir_entregas_sem_resposta(integer)', 'execute')))
                 || ' auth_so_rpc=' || (has_function_privilege('authenticated', 'public.confirmar_recebimento_pedido(uuid, jsonb, uuid)', 'execute')
                                        and not has_function_privilege('authenticated', 'public.s15_confirmar_recebimento(uuid, jsonb, uuid, boolean, uuid)', 'execute')
                                        and not has_function_privilege('authenticated', 'public.concluir_entregas_sem_resposta(integer)', 'execute'));

  raise exception 'RESULT%', v_res;
end
$t$;
