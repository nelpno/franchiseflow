CREATE OR REPLACE FUNCTION public.cupom_contexto(p_franchise_id text, p_phone text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r jsonb;
  v_cod text;
  v_key text := public.normalize_phone_key(p_phone);
  v_pat text;
  v_usou boolean := false;
  v_citado boolean := false;
begin
  select fc.cupom_regras into r from franchise_configurations fc where fc.franchise_evolution_instance_id = p_franchise_id;
  if r is null or coalesce((r->>'ativo')::boolean, false) is not true
     or not public.feature_flag_enabled('cardapio_cupom', p_franchise_id) then
    return null;
  end if;
  v_cod := upper(coalesce(r->>'codigo', ''));
  if v_cod = '' then return null; end if;
  if v_key is not null then
    v_usou := exists (select 1 from sales s
                       where s.franchise_id = p_franchise_id and s.desconto_origem = 'cupom' and upper(s.desconto_codigo) = v_cod
                         and public.normalize_phone_key(s.contact_phone) = v_key);
    v_pat := '(^|[^a-z0-9])' || regexp_replace(lower(v_cod), '([a-z])(?=[0-9])|([0-9])(?=[a-z])', '\1\2[^a-z0-9]*', 'g') || '($|[^a-z0-9])';
    v_citado := exists (select 1 from conversation_messages m
                         where m.franchise_id = p_franchise_id
                           and public.normalize_phone_key(m.contact_phone) = v_key
                           and m.direction = 'in'
                           and m.created_at >= now() - interval '6 hours'
                           and translate(lower(m.content), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ~ v_pat
                           and not exists (select 1 from sales s2
                                            where s2.franchise_id = p_franchise_id and s2.created_at > m.created_at
                                              and public.normalize_phone_key(s2.contact_phone) = v_key));
  end if;
  return json_build_object('codigo', v_cod, 'pct', (r->>'pct')::int, 'vale_ate', nullif(r->>'vale_ate', ''),
                           'vigente', public.cupom_vigente(r), 'ja_usou', v_usou, 'citado_antes', v_citado);
end;
$function$;
