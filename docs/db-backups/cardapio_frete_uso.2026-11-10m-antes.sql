-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_frete_uso(p_evo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', v_dia)::date;
begin
  if not public.cardapio_pode(p_evo, false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'),
    'unidade', (select jsonb_build_object(
        'google_mes', coalesce(sum(n), 0), 'reserva_mes', coalesce(sum(n_reserva), 0),
        'google_hoje', coalesce(sum(n) filter (where dia = v_dia), 0),
        'reserva_hoje', coalesce(sum(n_reserva) filter (where dia = v_dia), 0),
        'teto_dia', 100)
      from cardapio_frete_cota_unidade where franchise_id = p_evo and dia >= v_mes),
    'rede', jsonb_build_object(
        'google_hoje', coalesce((select n from cardapio_frete_cota where dia = v_dia), 0), 'teto_dia', 1200,
        'alerta_dia', coalesce((select n from cardapio_frete_cota where dia = v_dia), 0) >= 0.7 * 1200,
        'skus', (select coalesce(jsonb_agg(jsonb_build_object('sku', s.sku, 'usado', coalesce(u.n, 0), 'teto', public.cardapio_maps_teto(s.sku),
                                  'alerta', coalesce(u.n, 0) >= 0.7 * public.cardapio_maps_teto(s.sku)) order by s.sku), '[]'::jsonb)
                   from (values ('geocode'), ('routes'), ('rota')) s(sku)
                   left join cardapio_maps_uso u on u.mes = v_mes and u.sku = s.sku)),
    'aviso', 'Acima da cota, o frete continua aparecendo: vem de um cálculo aproximado (sem Google) e o robô confere no WhatsApp.'
  );
end;
$function$
;
