-- S14.7 (Onda 7, 28/09/2026): pedido à fábrica precificado pela TABELA (catalog_products).
-- Gerado a partir do corpo VIVO (.tmp/onda7/s147-gera2.mjs); na RPC só muda o 3º passo.
-- Medido 28/09: 1.890 itens padrão com custo; 1.839 casam com a tabela pelo nome (0 com custo
-- diferente hoje) + 39 "Molho de Tomate Mariolla - 250g" pelo alias; ~12 nomes tortos seguem no custo.
-- ROLLBACK (nesta ordem):
--   node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/create_purchase_order_with_items.2026-09-28-antes.sql
--   drop function if exists public.get_precos_pedido_fabrica(text); drop function if exists public.preco_tabela_fabrica(text);
--   (o front cai no cost_price se get_precos_pedido_fabrica não existir)
-- Preço da TABELA da fábrica para um nome de produto do estoque (nome exato; o molho padrão
-- "Molho de Tomate Mariolla - 250g" das unidades = "Molho de Tomate Sugo - 250g" do catálogo).
-- Produto desativado no catálogo mantém o preço da tabela (P3: não cair no custo da unidade).
-- NULL = nome fora da tabela (variantes de molho, massa de pastel "(rolo)"): quem chama usa o custo.
create or replace function public.preco_tabela_fabrica(p_nome text)
returns numeric language sql stable set search_path = public as $f$
  select c.price
    from catalog_products c
   where c.name = case p_nome when 'Molho de Tomate Mariolla - 250g' then 'Molho de Tomate Sugo - 250g' else p_nome end
     and c.price > 0
   order by c.active desc, c.price desc
   limit 1
$f$;
revoke all on function public.preco_tabela_fabrica(text) from public, anon;
grant execute on function public.preco_tabela_fabrica(text) to authenticated, service_role;

-- Preços que o formulário do pedido mostra = os que a RPC grava (mesma função). INVOKER:
-- a RLS de inventory_items limita à unidade de quem pede.
create or replace function public.get_precos_pedido_fabrica(p_franchise_id text)
returns table(inventory_item_id uuid, unit_price numeric) language sql stable set search_path = public as $f$
  select ii.id, coalesce(public.preco_tabela_fabrica(ii.product_name), ii.cost_price)
    from inventory_items ii
   where ii.franchise_id = p_franchise_id
     and ii.created_by_franchisee is not true
     and ii.cost_price > 0
$f$;
revoke all on function public.get_precos_pedido_fabrica(text) from public, anon;
grant execute on function public.get_precos_pedido_fabrica(text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_purchase_order_with_items(p_client_id uuid, p_franchise_id text, p_items jsonb, p_notes text DEFAULT NULL::text, p_total_weight_kg numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order_id  uuid;
  v_existing  record;
  v_item      jsonb;
  v_qty       integer;
  v_inv_id    uuid;
  v_ids       uuid[]    := '{}';
  v_qtys      integer[] := '{}';
  v_linhas    jsonb;
  v_count     integer;
  v_total     numeric;
  v_igual     boolean;
  v_notes     text := nullif(trim(coalesce(p_notes, '')), '');  -- observação normalizada (vazio = null)
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

  -- 1º passo: formato dos itens (sem ler preço ainda): id válido, quantidade 1..10000, sem repetir.
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
    v_ids  := v_ids  || v_inv_id;
    v_qtys := v_qtys || v_qty;
  end loop;

  -- 2º passo: o MESMO envio já foi gravado? Igual -> devolve; diferente -> erro de regra.
  select id, franchise_id, status, notes into v_existing from purchase_orders where id = p_client_id;
  if found then
    if v_existing.franchise_id is distinct from p_franchise_id then
      raise exception 'Pedido: este envio pertence a outra unidade.' using errcode = 'P0001';
    end if;
    select not exists (
      (select inventory_item_id, quantity from purchase_order_items where order_id = p_client_id
       except
       select * from unnest(v_ids, v_qtys))
      union all
      (select * from unnest(v_ids, v_qtys)
       except
       select inventory_item_id, quantity from purchase_order_items where order_id = p_client_id)
    ) into v_igual;
    -- P3 2ª passada: mudar só a observação também é outro pedido (senão o rascunho sumia sem gravar).
    v_igual := v_igual and (nullif(trim(coalesce(v_existing.notes, '')), '') is not distinct from v_notes);
    if not v_igual then
      raise exception 'Pedido: um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo.'
        using errcode = 'P0001', detail = 'S14_ENVIO_DIFERENTE';
    end if;
    return jsonb_build_object('id', v_existing.id, 'ja_existia', true, 'status', v_existing.status);
  end if;

  -- S14.7: preço = tabela da fábrica (preco_tabela_fabrica), não o custo da unidade (compra
  -- externa puxa o custo médio). Nome fora da tabela segue no custo da unidade, como antes.
  -- 3º passo: lê os preços UMA vez só (um SELECT = um snapshot) e materializa a lista validada.
  -- Total e INSERT dos itens usam exatamente este conjunto.
  select coalesce(jsonb_agg(jsonb_build_object(
           'inventory_item_id', ii.id,
           'product_name',      ii.product_name,
           'unit_price',        coalesce(public.preco_tabela_fabrica(ii.product_name), ii.cost_price),
           'quantity',          p.qty)), '[]'::jsonb),
         count(*),
         coalesce(sum(p.qty * coalesce(public.preco_tabela_fabrica(ii.product_name), ii.cost_price)), 0)
    into v_linhas, v_count, v_total
    from unnest(v_ids, v_qtys) as p(inv_id, qty)
    join inventory_items ii
      on ii.id = p.inv_id
     and ii.franchise_id = p_franchise_id
     and ii.created_by_franchisee is not true
     and ii.cost_price > 0;

  if v_count <> array_length(v_ids, 1) then
    raise exception 'Pedido: um dos produtos não é do catálogo da fábrica desta unidade. Atualize a página.'
      using errcode = 'P0001';
  end if;

  -- 4º passo: cabeçalho. ON CONFLICT cobre duas chamadas simultâneas com o mesmo id.
  insert into purchase_orders (id, franchise_id, status, total_amount, total_weight_kg, notes, ordered_at)
  values (p_client_id, p_franchise_id, 'pendente', round(v_total, 2),
          case when p_total_weight_kg is null then null else round(p_total_weight_kg, 3) end,
          v_notes, now())
  on conflict (id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    -- A outra chamada simultânea gravou primeiro: mesma comparação do 2º passo.
    select id, franchise_id, status, notes into v_existing from purchase_orders where id = p_client_id;
    if not found or v_existing.franchise_id is distinct from p_franchise_id then
      raise exception 'Pedido: não foi possível conferir o envio anterior. Veja o histórico antes de enviar de novo.'
        using errcode = 'P0001';
    end if;
    select not exists (
      (select inventory_item_id, quantity from purchase_order_items where order_id = p_client_id
       except
       select * from unnest(v_ids, v_qtys))
      union all
      (select * from unnest(v_ids, v_qtys)
       except
       select inventory_item_id, quantity from purchase_order_items where order_id = p_client_id)
    ) into v_igual;
    -- P3 2ª passada: mudar só a observação também é outro pedido (senão o rascunho sumia sem gravar).
    v_igual := v_igual and (nullif(trim(coalesce(v_existing.notes, '')), '') is not distinct from v_notes);
    if not v_igual then
      raise exception 'Pedido: um pedido anterior deste formulário já chegou à fábrica. Confira no histórico antes de enviar de novo.'
        using errcode = 'P0001', detail = 'S14_ENVIO_DIFERENTE';
    end if;
    return jsonb_build_object('id', v_existing.id, 'ja_existia', true, 'status', v_existing.status);
  end if;

  -- 5º passo: itens, do MESMO conjunto materializado (mesma transação: falhou aqui, o cabeçalho some junto).
  insert into purchase_order_items (order_id, inventory_item_id, product_name, quantity, unit_price)
  select v_order_id,
         (l->>'inventory_item_id')::uuid,
         l->>'product_name',
         (l->>'quantity')::integer,
         (l->>'unit_price')::numeric
    from jsonb_array_elements(v_linhas) l;

  return jsonb_build_object('id', v_order_id, 'ja_existia', false,
                            'total_amount', round(v_total, 2), 'itens', v_count);
end;
$function$;
ALTER FUNCTION public.create_purchase_order_with_items(uuid,text,jsonb,text,numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_purchase_order_with_items(uuid,text,jsonb,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order_with_items(uuid,text,jsonb,text,numeric) TO authenticated, service_role;
