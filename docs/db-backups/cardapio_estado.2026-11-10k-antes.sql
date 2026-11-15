-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_estado(p_evo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case when public.cardapio_pode(p_evo, false) then
    (select jsonb_build_object('ativo', coalesce(fc.cardapio_digital_ativo, false),
                               'ja_ligou', fc.cardapio_primeira_vez_em is not null,
                               'chave_ligada', public.feature_flag_enabled('cardapio_digital', p_evo))
       from franchise_configurations fc where fc.franchise_evolution_instance_id = p_evo)
  end
$function$
;
