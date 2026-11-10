-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_produtos_visiveis(p_evo text, p_ids uuid[], p_visivel boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n int;
begin
  if not public.cardapio_pode(p_evo, true) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if not coalesce((select public.is_admin_or_manager()), false) and not public.feature_flag_enabled('cardapio_digital', p_evo) then
    raise exception 'O cardápio digital ainda não está liberado para a sua unidade.' using errcode = '42501';
  end if;
  if p_visivel is null or p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200 then
    raise exception 'pedido inválido' using errcode = '22023';
  end if;
  update inventory_items
     set cardapio_visivel = p_visivel,
         zerado_desde = case when quantity is not null and quantity <= 0 then coalesce(zerado_desde, updated_at) else zerado_desde end
   where franchise_id = p_evo and id = any(p_ids) and cardapio_visivel is distinct from p_visivel;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
;
