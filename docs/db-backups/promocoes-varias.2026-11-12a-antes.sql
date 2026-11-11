-- ROLLBACK de site/pedido/supabase/2026-11-12a-promocoes-varias.sql (corpos de ANTES, tirados do banco em 12/11/2026).
-- Antes: toda unidade precisa ficar com no máximo 1 promoção (update franchise_configurations set promocao_regras = promocao_regras->0 where jsonb_array_length(promocao_regras) > 1).
-- Depois: drop function public.promocao_aplicar(text, jsonb), public.promocao_aplicar_cardapio(text, jsonb), public.promocao_regra_erro(jsonb, text), public.promocao_regra_itens_ok(jsonb, text), public.promocao_texto_um(jsonb, text);
begin;
update public.franchise_configurations set promocao_regras = promocao_regras->0 where jsonb_array_length(promocao_regras) > 1;
alter table public.franchise_configurations drop constraint if exists franchise_configurations_promocao_regras_check;
alter table public.franchise_configurations add constraint franchise_configurations_promocao_regras_check check (jsonb_typeof(promocao_regras) = 'array' and jsonb_array_length(promocao_regras) <= 1);
drop function if exists public.promocao_regras_erro(jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION public.promocao_regras_erro(p_regras jsonb, p_evo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r jsonb;
  it jsonb;
  v_tipo text;
  v_nome text;
  v_normal numeric := 0;
  v_preco numeric;
  v_qtd_total int := 0;
  v_preco_item numeric;
  v_visivel boolean;
  v_q int;
  v_pct numeric;
  v_min int;
begin
  if p_regras is null or jsonb_typeof(p_regras) <> 'array' then return 'Promoção em formato inválido.'; end if;
  if jsonb_array_length(p_regras) = 0 then return null; end if;
  if jsonb_array_length(p_regras) > 1 then return 'Uma promoção por vez.'; end if;
  r := p_regras->0;
  if jsonb_typeof(r) <> 'object' then return 'Promoção em formato inválido.'; end if;
  v_tipo := r->>'tipo';
  if coalesce(v_tipo, '') not in ('kit', 'percentual') then return 'Escolha o tipo da promoção.'; end if;
  v_nome := btrim(coalesce(r->>'nome', ''));
  if length(v_nome) < 3 or length(v_nome) > 40 then return 'O nome da promoção precisa ter de 3 a 40 letras.'; end if;
  if jsonb_typeof(r->'itens') <> 'array' or jsonb_array_length(r->'itens') = 0 then return 'Escolha pelo menos um produto.'; end if;
  if jsonb_array_length(r->'itens') > 6 then return 'No máximo 6 produtos na promoção.'; end if;
  if (select count(distinct x->>'product_name') from jsonb_array_elements(r->'itens') x) <> jsonb_array_length(r->'itens') then
    return 'O mesmo produto aparece duas vezes.';
  end if;
  for it in select * from jsonb_array_elements(r->'itens') loop
    if coalesce(it->>'qtd', '') !~ '^[0-9]{1,2}$' or (it->>'qtd')::int not between 1 and 20 then return 'Quantidade de cada produto: de 1 a 20.'; end if;
    v_q := (it->>'qtd')::int;
    v_preco_item := null; v_visivel := null;
    select i.sale_price, coalesce(i.cardapio_visivel, true) into v_preco_item, v_visivel from inventory_items i
     where i.franchise_id = p_evo and i.product_name = it->>'product_name' and coalesce(i.active, true) and i.sale_price > 0
     order by coalesce(i.cardapio_visivel, true) desc limit 1;
    if v_preco_item is null then return 'O produto "' || left(coalesce(it->>'product_name', ''), 60) || '" não está no seu estoque.'; end if;
    if not v_visivel then return 'O produto "' || left(coalesce(it->>'product_name', ''), 60) || '" está escondido do cardápio.'; end if;
    v_normal := v_normal + v_preco_item * v_q;
    v_qtd_total := v_qtd_total + v_q;
  end loop;
  if r ? 'vale_ate' and r->>'vale_ate' is not null then
    if r->>'vale_ate' !~ '^\d{4}-\d{2}-\d{2}$' then return 'Data de validade inválida.'; end if;
    if (r->>'vale_ate')::date < (now() at time zone 'America/Sao_Paulo')::date then return 'A data de validade já passou.'; end if;
  end if;
  if v_tipo = 'kit' then
    if v_qtd_total < 2 then return 'O kit precisa de pelo menos 2 itens.'; end if;
    begin v_preco := round((r->>'preco')::numeric, 2); exception when others then v_preco := null; end;
    if v_preco is null or v_preco <= 0 then return 'Digite o preço do kit.'; end if;
    if v_preco >= v_normal then return 'O preço do kit precisa ser menor que o preço normal.'; end if;
    if (v_normal - v_preco) / v_normal > 0.35 then return 'O desconto passou de 35%.'; end if;
  else
    begin v_pct := (r->>'pct')::numeric; v_min := (r->>'min_qtd')::int; exception when others then return 'Preencha quantas e o desconto.'; end;
    if v_min is null or v_min not between 2 and 10 then return 'Quantas: de 2 a 10.'; end if;
    if v_pct is null or v_pct <> round(v_pct) or v_pct not between 1 and 35 then return 'Desconto: de 1% a 35%, número inteiro.'; end if;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.promocao_texto(p_regras jsonb, p_evo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r jsonb := case when jsonb_typeof(p_regras) = 'array' then p_regras->0 end;
  v_itens text;
  v_normal numeric;
  v_ate text := '';
  v_preco numeric;
  v_n int;
begin
  if r is null or jsonb_typeof(r) <> 'object' then return null; end if;
  if r->>'vale_ate' ~ '^\d{4}-\d{2}-\d{2}$' then
    v_ate := ' Válido até ' || to_char((r->>'vale_ate')::date, 'DD/MM/YYYY') || '.';
  end if;
  select count(*) into v_n from jsonb_array_elements(r->'itens');
  if r->>'tipo' = 'kit' then
    select string_agg((x->>'qtd') || ' ' || (x->>'product_name'), ' + ' order by o),
           sum(i.sale_price * (x->>'qtd')::int)
      into v_itens, v_normal
      from jsonb_array_elements(r->'itens') with ordinality as t(x, o)
      left join lateral (select sale_price from inventory_items
                          where franchise_id = p_evo and product_name = x->>'product_name' and coalesce(active, true) limit 1) i on true;
    v_preco := round((r->>'preco')::numeric, 2);
    return btrim(r->>'nome') || ': ' || v_itens || ' por R$ ' || replace(to_char(v_preco, 'FM999990.00'), '.', ',')
           || case when v_normal is not null and v_normal > v_preco then ' (de R$ ' || replace(to_char(v_normal, 'FM999990.00'), '.', ',') || ')' else '' end
           || '.' || v_ate;
  elsif r->>'tipo' = 'percentual' then
    select case when v_n = 1 then min(x->>'product_name')
                else string_agg(x->>'product_name', ' e ' order by o) end
      into v_itens
      from jsonb_array_elements(r->'itens') with ordinality as t(x, o);
    return 'Leve ' || (r->>'min_qtd') || case when v_n = 1 then ' ' || v_itens || ' ou mais e ganhe '
                                              else ' ou mais, somando ' || v_itens || ', e ganhe ' end
           || (r->>'pct') || '% de desconto.' || v_ate;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.franchise_configurations_promocao_texto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_erro text;
  v_tinha boolean := tg_op = 'UPDATE' and jsonb_array_length(coalesce(old.promocao_regras, '[]'::jsonb)) > 0;
  v_tem boolean := jsonb_array_length(coalesce(new.promocao_regras, '[]'::jsonb)) > 0;
begin
  if tg_op = 'INSERT' or new.promocao_regras is distinct from old.promocao_regras then
    v_erro := public.promocao_regras_erro(new.promocao_regras, new.franchise_evolution_instance_id);
    if v_erro is not null then
      raise exception '%', v_erro using errcode = '22023';
    end if;
  end if;
  if v_tem then
    if not v_tinha and new.promotions_combo_manual is null then
      new.promotions_combo_manual := case when tg_op = 'UPDATE' then old.promotions_combo end;
    end if;
    -- item que saiu do estoque/cardápio depois de salvar: o robô para de oferecer (volta quando consertar)
    new.promotions_combo := case when public.promocao_itens_ok(new.promocao_regras, new.franchise_evolution_instance_id)
                                 then public.promocao_texto(new.promocao_regras, new.franchise_evolution_instance_id) end;
  elsif v_tinha then
    new.promotions_combo := null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_items_promocao_regera()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update franchise_configurations fc set promotions_combo = fc.promotions_combo -- o trigger da promoção refaz o texto
   where fc.franchise_evolution_instance_id = new.franchise_id
     and jsonb_array_length(fc.promocao_regras) > 0
     and exists (select 1 from jsonb_array_elements(fc.promocao_regras->0->'itens') x
                  where x->>'product_name' in (old.product_name, new.product_name));
  return null;
end;
$function$;

select cron.schedule('cardapio-promocao-vencida', '50 3 * * *', $cron$
  update public.franchise_configurations set promocao_regras = '[]'::jsonb
   where jsonb_array_length(promocao_regras) > 0
     and promocao_regras->0->>'vale_ate' ~ '^d{4}-d{2}-d{2}$'
     and (promocao_regras->0->>'vale_ate')::date < (now() at time zone 'America/Sao_Paulo')::date
$cron$);
commit;
