-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_robo_whatsapp(p_evo text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select x.n from (select public.cardapio_robo_numero(p_evo) n) x
   where x.n ~ '^[1-9][1-9](9[0-9]{8}|[2-5][0-9]{7})$' and not public.cardapio_robo_e_responsavel(p_evo)
$function$
;
