-- 28/09/2026 — S14.3 · Pedido à fábrica gravado de uma vez só (cabeçalho + itens na MESMA transação)
--
-- Por quê: o PurchaseOrderForm gravava o cabeçalho (PurchaseOrder.create) e DEPOIS os itens
-- (PurchaseOrderItem.createMany), em duas chamadas. Se a segunda falhava, o front tentava
-- apagar o cabeçalho — mas a policy de DELETE de purchase_orders é só admin (is_admin()), então
-- para a franqueada a limpeza falhava CALADA e sobrava pedido sem item (e R$ no total_amount).
-- Clique repetido / resposta perdida também podia gravar o pedido duas vezes.
--
-- Agora: RPC única, idempotente pelo id que o aparelho gera ANTES da 1ª tentativa (p_client_id,
-- mesmo modelo do save_sale_with_items da S0.1): o id do pedido É o client_id; a nova tentativa cai
-- no ON CONFLICT (id) DO NOTHING e devolve o pedido já gravado, sem duplicar nada. Duas chamadas
-- simultâneas: a 2ª espera a 1ª no índice único e não insere.
--
-- Preço e nome vêm do SERVIDOR (inventory_items da própria unidade), não do aparelho: unit_price
-- = cost_price, só catálogo padrão (created_by_franchisee is not true) com custo > 0 — a mesma regra
-- do formulário (bug Santos 28/06). total_amount = soma dos itens, calculada aqui.
-- total_weight_kg continua vindo do aparelho (snapshot de logística, não é dinheiro; o peso
-- tem fallback no parser do nome que só existe no front).
--
-- SECURITY INVOKER (não precisa de DEFINER): a franqueada já pode INSERT em purchase_orders e
-- purchase_order_items da própria unidade pelas policies po_insert/poi_insert, e LER
-- inventory_items da própria unidade. A RLS continua valendo dentro da função: unidade alheia
-- -> 42501 (insert) ou "Pedido: produto ... não é do catálogo" (select não enxerga o item).
-- Nenhum guard por current_user (ver CLAUDE.md: guard de DEFINER) — aqui quem protege é a RLS.
--
-- O front convive com o banco velho: se esta função não existir (PGRST202/42883), ele cai no
-- caminho antigo (2 chamadas). Logo, DROP desta função = voltar atrás sem deploy.
--
-- Só aditivo (1 função nova). Triggers de purchase_orders: on_new_purchase_order (AFTER INSERT,
-- corpo vazio) dispara igual ao caminho antigo; nenhum trigger em purchase_order_items.
--
-- ROLLBACK:
--   drop function if exists public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric);
--
-- NÃO APLICADO (entregue na S14 da Onda 4; o orquestrador aplica depois da P3, ANTES do front).
-- Aplicar: node supabase/cs-cockpit/_aplica-lf.mjs supabase/2026-09-28-s14-purchase-order-atomica.sql
-- Conferir (consulta separada):
--   select p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon_exec,
--          has_function_privilege('authenticated', p.oid, 'execute') auth_exec
--   from pg_proc p where p.proname = 'create_purchase_order_with_items';
--   -> prosecdef=false, proconfig={search_path=public}, anon_exec=false, auth_exec=true
--   + chamada com a chave anon tem de dar 401/permission denied.

create or replace function public.create_purchase_order_with_items(
  p_client_id       uuid,
  p_franchise_id    text,
  p_items           jsonb,
  p_notes           text    default null,
  p_total_weight_kg numeric default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_order_id  uuid;
  v_existing  record;
  v_item      jsonb;
  v_inv       record;
  v_qty       integer;
  v_inv_id    uuid;
  v_ids       uuid[] := '{}';
  v_total     numeric := 0;
  v_count     integer := 0;
begin
  if p_client_id is null then
    raise exception 'Pedido: identificador do envio ausente. Atualize a página e tente de novo.'
      using errcode = 'P0001';
  end if;
  if coalesce(trim(p_franchise_id), '') = '' then
    raise exception 'Pedido: unidade não identificada. Atualize a página.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pedido: escolha pelo menos um produto.' using errcode = 'P0001';
  end if;
  if p_total_weight_kg is not null and p_total_weight_kg < 0 then
    raise exception 'Pedido: peso total inválido.' using errcode = 'P0001';
  end if;

  -- Nova tentativa do MESMO envio: devolve o que já foi gravado, sem mexer em nada.
  -- (Checado antes de validar os itens: a 2ª tentativa pode vir com a tela já mudada.)
  select id, franchise_id into v_existing from purchase_orders where id = p_client_id;
  if found then
    if v_existing.franchise_id is distinct from p_franchise_id then
      raise exception 'Pedido: este envio pertence a outra unidade.' using errcode = 'P0001';
    end if;
    return jsonb_build_object('id', v_existing.id, 'ja_existia', true);
  end if;

  -- 1º passo: validar TODOS os itens e somar o total pelo preço do servidor.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_inv_id := (v_item->>'inventory_item_id')::uuid;
      v_qty    := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Pedido: item com produto ou quantidade inválida.' using errcode = 'P0001';
    end;
    if v_inv_id is null or v_qty is null or v_qty <= 0 or v_qty > 10000 then
      raise exception 'Pedido: item com produto ou quantidade inválida.' using errcode = 'P0001';
    end if;
    if v_inv_id = any(v_ids) then
      raise exception 'Pedido: o mesmo produto veio duas vezes.' using errcode = 'P0001';
    end if;
    v_ids := v_ids || v_inv_id;

    select ii.id, ii.product_name, ii.cost_price into v_inv
      from inventory_items ii
     where ii.id = v_inv_id
       and ii.franchise_id = p_franchise_id
       and ii.created_by_franchisee is not true
       and ii.cost_price > 0;
    if not found then
      raise exception 'Pedido: um dos produtos não é do catálogo da fábrica desta unidade. Atualize a página.'
        using errcode = 'P0001';
    end if;
    v_total := v_total + v_qty * v_inv.cost_price;
    v_count := v_count + 1;
  end loop;

  -- 2º passo: cabeçalho. ON CONFLICT cobre duas chamadas simultâneas com o mesmo id.
  insert into purchase_orders (id, franchise_id, status, total_amount, total_weight_kg, notes, ordered_at)
  values (p_client_id, p_franchise_id, 'pendente', round(v_total, 2),
          case when p_total_weight_kg is null then null else round(p_total_weight_kg, 3) end,
          nullif(trim(coalesce(p_notes, '')), ''), now())
  on conflict (id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id, franchise_id into v_existing from purchase_orders where id = p_client_id;
    if not found or v_existing.franchise_id is distinct from p_franchise_id then
      raise exception 'Pedido: não foi possível conferir o envio anterior. Veja o histórico antes de enviar de novo.'
        using errcode = 'P0001';
    end if;
    return jsonb_build_object('id', v_existing.id, 'ja_existia', true);
  end if;

  -- 3º passo: itens (mesma transação — se algo falhar aqui, o cabeçalho some junto).
  insert into purchase_order_items (order_id, inventory_item_id, product_name, quantity, unit_price)
  select v_order_id, ii.id, ii.product_name, (x->>'quantity')::integer, ii.cost_price
    from jsonb_array_elements(p_items) x
    join inventory_items ii on ii.id = (x->>'inventory_item_id')::uuid;

  return jsonb_build_object('id', v_order_id, 'ja_existia', false,
                            'total_amount', round(v_total, 2), 'itens', v_count);
end;
$function$;

revoke all on function public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric) from public;
revoke all on function public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric) from anon;
grant execute on function public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric) to authenticated;
grant execute on function public.create_purchase_order_with_items(uuid, text, jsonb, text, numeric) to service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ROTEIRO DE TESTE (tudo dentro de uma transação DESFEITA: begin ... rollback).
-- Rodar pelo MCP execute_sql DEPOIS de aplicar. Troque <evo_teste> por uma unidade is_test
-- (ex.: franquiaararaquarasp) e <franqueado_uuid> por um profile que gerencia essa unidade.
-- `set local role authenticated` + claims = roda como a franqueada (RLS valendo; o
-- session_user do MCP continua postgres, por isso o role explícito).
--
-- begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub','<franqueado_uuid>','role','authenticated')::text, true);
--   set local role authenticated;
--
--   -- dois itens do catálogo padrão da unidade de teste
--   create temp table _t on commit drop as
--     select id from public.inventory_items
--      where franchise_id = '<evo_teste>' and created_by_franchisee is not true and cost_price > 0
--      order by product_name limit 2;
--
--   -- (1) 1ª chamada grava: ja_existia=false, itens=2
--   select public.create_purchase_order_with_items(
--     '11111111-1111-4111-8111-111111111111', '<evo_teste>',
--     (select jsonb_agg(jsonb_build_object('inventory_item_id', id, 'quantity', 3)) from _t),
--     'teste S14', 1.5);
--   -- (2) clique repetido / nova tentativa: MESMO id, ja_existia=true, nada novo
--   select public.create_purchase_order_with_items(
--     '11111111-1111-4111-8111-111111111111', '<evo_teste>',
--     (select jsonb_agg(jsonb_build_object('inventory_item_id', id, 'quantity', 99)) from _t),
--     'outra tela', 9);
--   -- (3) conferência: 1 pedido, 2 itens, qtd 3 (não 99), total = soma pelo custo do servidor
--   select po.total_amount, po.total_weight_kg, po.notes, count(i.*) itens, sum(i.quantity) un,
--          sum(i.quantity * i.unit_price) soma_itens
--     from public.purchase_orders po join public.purchase_order_items i on i.order_id = po.id
--    where po.id = '11111111-1111-4111-8111-111111111111'
--    group by po.id;   -- esperado: total_amount = soma_itens, itens=2, un=6, notes='teste S14'
--   -- (4) atomicidade: 2º item inválido -> erro e NENHUM cabeçalho gravado
--   savepoint s4;
--   select public.create_purchase_order_with_items(
--     '22222222-2222-4222-8222-222222222222', '<evo_teste>',
--     jsonb_build_array(
--       jsonb_build_object('inventory_item_id', (select id from _t limit 1), 'quantity', 1),
--       jsonb_build_object('inventory_item_id', gen_random_uuid(), 'quantity', 1)));
--   -- -> ERRO "Pedido: um dos produtos não é do catálogo..."
--   rollback to savepoint s4;
--   select count(*) from public.purchase_orders where id = '22222222-2222-4222-8222-222222222222'; -- 0
--   -- (5) item EXTRA da unidade (created_by_franchisee=true) é recusado (se a unidade tiver um)
--   -- (6) outra unidade: trocar '<evo_teste>' por uma unidade que o perfil NÃO gerencia -> erro
--   --     ("não é do catálogo" pela RLS do select, ou 42501 no insert)
--   -- (7) quantidade 0 / negativa / texto -> "Pedido: item com produto ou quantidade inválida."
-- rollback;
--
-- anon (fora da transação, pela API com a chave pública): POST /rest/v1/rpc/create_purchase_order_with_items
--   -> 401/42501 (execute revogado de anon).
