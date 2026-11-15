CREATE OR REPLACE FUNCTION public.cupom_validar(p_slug text, p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_evo text;
  r jsonb;
  v_in text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_n integer;
begin
  v_evo := public.cardapio_evo_do_slug(p_slug);
  if v_evo is null or not public.cardapio_aberto(v_evo) then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  insert into cupom_validar_uso (franchise_id, minuto, n) values (v_evo, date_trunc('minute', now()), 1)
    on conflict (franchise_id, minuto) do update set n = cupom_validar_uso.n + 1
    returning n into v_n;
  if v_n = 1 then
    delete from cupom_validar_uso where minuto < now() - interval '1 day';
  end if;
  if v_n > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas');
  end if;
  select fc.cupom_regras into r from franchise_configurations fc where fc.franchise_evolution_instance_id = v_evo;
  if v_in = '' or r is null or not public.cupom_vigente(r) or not public.feature_flag_enabled('cardapio_cupom', v_evo)
     or upper(coalesce(r->>'codigo', '')) <> v_in then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  return jsonb_build_object('ok', true, 'codigo', upper(r->>'codigo'), 'pct', (r->>'pct')::int);
end;
$function$;
