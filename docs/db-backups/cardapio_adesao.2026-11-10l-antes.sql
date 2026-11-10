-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_adesao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb;
begin
  -- SQL direto (sem claims: MCP, cron) também lê
  if not coalesce(nullif(current_setting('request.jwt.claims', true), '') is null
                  or (select public.is_admin_or_manager()) or (select public.is_cs_or_admin())
                  or nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role', false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  with u as (
    select f.id, f.evolution_instance_id evo, f.name, fc.cardapio_digital_slug slug, coalesce(fc.cardapio_digital_ativo, false) ativo,
           fc.cardapio_primeira_vez_em, fc.cardapio_ativo_mudou_em, public.feature_flag_enabled('cardapio_digital', f.evolution_instance_id) chave,
           coalesce(public.cardapio_checklist(f.evolution_instance_id), '[]'::jsonb) ck
      from franchises f join franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
     where f.status = 'active' and not coalesce(f.is_test, false)
  ), x as (
    select u.*,
           (select min(a.criado_em) from app_eventos a where a.franquia_id = u.id and a.evento = 'cardapio_tela_aberta' and a.papel = 'franchisee') abriu_em,
           (select count(*) from cardapio_eventos e where u.slug is not null and e.unidade = u.slug and e.evento = 'enviou'
                                                     and e.criado_em > now() - interval '7 days') pedidos_7d,
           coalesce((select jsonb_agg(c->>'titulo') from jsonb_array_elements(u.ck) c where c->>'nivel' = 'trava' and not coalesce((c->>'ok')::boolean, false)), '[]'::jsonb) faltando,
           coalesce((select jsonb_agg(c->>'titulo') from jsonb_array_elements(u.ck) c where c->>'nivel' = 'aviso' and not coalesce((c->>'ok')::boolean, false)), '[]'::jsonb) avisos,
           public.cardapio_robo_e_responsavel(u.evo) robo_e_responsavel
      from u
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'evo', evo, 'nome', name, 'slug', slug,
           'estado', case when not chave then 'pausado_maxi'
                          when ativo then 'ligado'
                          when cardapio_primeira_vez_em is not null then 'pausado'
                          when jsonb_array_length(faltando) = 0 then 'pronto'
                          when abriu_em is not null then 'falta'
                          else 'nao_abriu' end,
           'desde', case when ativo or cardapio_primeira_vez_em is not null then cardapio_ativo_mudou_em end,
           'primeira_vez_em', cardapio_primeira_vez_em,
           'abriu_em', abriu_em, 'pedidos_7d', pedidos_7d, 'faltando', faltando, 'avisos', avisos,
           -- 10i: número do robô = celular do responsável (ex.: Santos): a tela não oferece usar; a Maxi decide o número público
           'robo_e_responsavel', robo_e_responsavel)
         order by name), '[]'::jsonb)
    into v from x;
  return v;
end;
$function$
;
