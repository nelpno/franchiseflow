-- backup do corpo vivo (promocao_regras_erro(p_regras jsonb, p_evo text), md5 prosrc be22fa87fe3dca4e3bc60b0f92b05f55); reaplicar = voltar
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
    select i.sale_price into v_preco_item from inventory_items i
     where i.franchise_id = p_evo and i.product_name = it->>'product_name' and coalesce(i.active, true) and i.sale_price > 0 limit 1;
    if v_preco_item is null then return 'O produto "' || left(coalesce(it->>'product_name', ''), 60) || '" não está no seu estoque.'; end if;
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
$function$
;
