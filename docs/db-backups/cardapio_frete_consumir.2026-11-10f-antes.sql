-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
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

CREATE OR REPLACE FUNCTION public.cardapio_frete_consumir(p_evo text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with d as (select (now() at time zone 'America/Sao_Paulo')::date dia),
  g as (insert into cardapio_frete_cota as c (dia, n) select dia, 1 from d
        on conflict (dia) do update set n = c.n + 1 returning n),
  u as (insert into cardapio_frete_cota_unidade as c (dia, franchise_id, n) select dia, p_evo, 1 from d
        on conflict (dia, franchise_id) do update set n = c.n + 1 returning n)
  select coalesce((select n from g) <= 3000 and (select n from u) <= 300, false)
$function$
;
