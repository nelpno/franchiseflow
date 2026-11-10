-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_robo_numero(p_evo text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3) else d end
    from (select regexp_replace(coalesce(t.telefone_publico, ''), '\D', '', 'g') d
            from vw_dadosunidade v join unidade_telefone_publico t on t.zuck_instance_name = v.zuck_instance_name
           where v.franchise_evolution_instance_id = p_evo and coalesce(t.logged_in, false)
             and t.sincronizado_em > now() - interval '3 days'
           limit 1) x
$function$
;
