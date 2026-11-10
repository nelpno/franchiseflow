-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_robo_e_responsavel(p_evo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select x.n <> '' and right(x.n, 11) = right(regexp_replace(coalesce(fc.personal_phone_for_summary, ''), '\D', '', 'g'), 11)
                     from (select public.cardapio_robo_numero(p_evo) n) x, franchise_configurations fc
                    where fc.franchise_evolution_instance_id = p_evo), false)
$function$
;
