-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_frete_uso_rede()
 RETURNS TABLE(franchise_id text, google_mes integer, reserva_mes integer, google_hoje integer, reserva_hoje integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'role', '') = 'service_role'
          or coalesce((select public.is_admin_or_manager()), false) or coalesce((select public.is_cs_or_admin()), false)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return query
    select c.franchise_id, sum(c.n)::integer, sum(c.n_reserva)::integer,
           (sum(c.n) filter (where c.dia = v_dia))::integer, (sum(c.n_reserva) filter (where c.dia = v_dia))::integer
      from cardapio_frete_cota_unidade c
     where c.dia >= date_trunc('month', v_dia)::date
     group by c.franchise_id order by 2 desc;
end;
$function$
;
