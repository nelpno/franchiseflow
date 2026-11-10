-- Corpo vivo de public.cardapio_frete_consumir(p_evo text) ANTES do 2026-11-10k (lido em 10/11/2026 por pg_get_functiondef).
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
  select coalesce((select n from g) <= 400 and (select n from u) <= 100, false)
$function$;
revoke all on function public.cardapio_frete_consumir(text) from public, anon, authenticated;
grant execute on function public.cardapio_frete_consumir(text) to service_role;
