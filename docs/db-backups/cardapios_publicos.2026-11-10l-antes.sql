-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapios_publicos()
 RETURNS TABLE(evo text, url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select fc.franchise_evolution_instance_id::text,
         'https://pedido.maximassas.com.br/' || fc.cardapio_digital_slug || '/'
    from franchise_configurations fc
    join franchises f on f.evolution_instance_id = fc.franchise_evolution_instance_id
   where f.status = 'active' and coalesce(f.is_test, false) = false
     and coalesce(fc.cardapio_digital_slug, '') <> ''
     and public.cardapio_aberto(fc.franchise_evolution_instance_id)
   order by 1
$function$
;
