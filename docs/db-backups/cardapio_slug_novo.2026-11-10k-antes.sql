-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_slug_novo(p_evo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_atual text;
  v_base text;
  v_slug text;
  n int := 1;
  reservados text[] := array['painel', 'privacidade', 'assets', 'img', 'imagens', 'p', 'cardapio', 'modelo', 'api', 'admin',
                             'teste', 'pedido', 'unidades', 'www', 'favicon', 'robots', 'maxi', 'maximassas'];
begin
  select fc.cardapio_digital_slug, public.cardapio_slug_base(f.name) into v_atual, v_base
    from franchise_configurations fc join franchises f on f.evolution_instance_id = fc.franchise_evolution_instance_id
   where fc.franchise_evolution_instance_id = p_evo;
  if v_atual is not null then return v_atual; end if;
  if v_base is null then return null; end if;
  v_slug := v_base;
  while v_slug = any(reservados)
        or exists (select 1 from franchise_configurations x where x.cardapio_digital_slug = v_slug and x.franchise_evolution_instance_id <> p_evo) loop
    n := n + 1;
    v_slug := left(v_base, 37) || '-' || n;
  end loop;
  return v_slug;
end;
$function$
;
