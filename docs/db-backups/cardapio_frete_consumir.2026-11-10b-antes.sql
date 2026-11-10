-- backup do corpo vivo (cardapio_frete_consumir(), md5 prosrc 6708224ef1a85bfe3e4c59bb609f535c); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.cardapio_frete_consumir()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into cardapio_frete_cota as c (dia, n)
  values ((now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (dia) do update set n = c.n + 1
  returning n <= 300;
$function$
;
