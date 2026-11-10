-- backup do corpo vivo (medidor_replay(p_sessao text), md5 prosrc 77c7941ff229e2053277f95fa0ffdd02); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.medidor_replay(p_sessao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- admin do dashboard (is_admin) ou o backend (service_role, usado pela prova automática; nunca vai ao navegador)
  if not (public.is_admin() or coalesce(auth.jwt()->>'role', '') = 'service_role') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('t', t, 'tipo', tipo, 'alvo', alvo, 'passo', passo, 'massa', massa, 'dado', dado) order by id)
                           from medidor_eventos where sessao = p_sessao), '[]'),
    'lotes', coalesce((select jsonb_agg(jsonb_build_object('seq', seq, 'f', formato, 'd', dados) order by seq)
                         from medidor_gravacao where sessao = p_sessao), '[]'));
end;
$function$
;
