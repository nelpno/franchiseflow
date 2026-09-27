-- 2026-09-27 admin 16 — get_faturamento_por_dia(p_franchise_id): faturamento dia a dia do mês
--
-- NAO APLICADO. Subir antes do deploy do front que traz a faixa de dias (Hoje e Ficha):
--   src/entities/faturamentoDia.js, src/components/shared/FaixaDias.jsx,
--   src/components/shared/FaturamentoDiaSheet.jsx, src/lib/faturamentoDia.js.
-- Sem a função no banco, a faixa some sozinha (o cartão fica como estava).
--
-- O QUE DEVOLVE (jsonb):
--   { hoje: 'YYYY-MM-DD', mes: 'YYYY-MM',
--     dias: [{dia:'YYYY-MM-DD', rev, rev_4_semanas}],             -- dia 1 até hoje (SP)
--     unidades_por_dia: {'YYYY-MM-DD': [{franchise_id, franchise_name, rev}]} }  -- só rede inteira
-- Régua = a da get_admin_network_overview (admin-08): receita = value − desconto + frete,
-- por sale_date; hoje = (now() at time zone 'America/Sao_Paulo')::date; só unidades
-- status='active' e não-teste. Comparação do DIA = mesmo dia da semana 4 semanas antes
-- (dia − 28): comparar 26/09 (sábado) com 26/08 (quarta) misturava dia da semana e todo
-- sábado parecia "+R$ 10 mil". Todo dia tem par (29-31 inclusive). O total do mês contra o
-- mesmo trecho do mês anterior continua na overview (cartão do topo), não aqui.
-- sum(dias.rev) = sum(overview.rev_mtd) (conferido por SELECT em 26/09).
-- unidades_por_dia: só quem teve receita > 0 no dia, da maior para a menor.
--
-- SEGURANCA: tela admin. SECURITY DEFINER, search_path=public, guard fail-closed
-- (admin/gerente/CS, inclusive com p_franchise_id — o franqueado NÃO usa esta função).
-- Sem acesso: devolve null. revoke de public/anon, grant a authenticated.
--
-- CUSTO (26/09, corpo rodado inline com EXPLAIN ANALYZE via MCP): ver resposta do agente;
-- usa idx_sales_sale_date (janela de ~2 meses).

create or replace function public.get_faturamento_por_dia(p_franchise_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $fn$
declare
  v jsonb;
begin
  if not (coalesce((select public.is_admin_or_manager()), false)
          or coalesce((select public.is_cs_or_admin()), false)) then
    return null;
  end if;

  with
  d as (
    select x.hoje,
           date_trunc('month', x.hoje)::date as mes_ini,
           (date_trunc('month', x.hoje)::date - 28) as ant_ini
    from (select (now() at time zone 'America/Sao_Paulo')::date as hoje) x
  ),
  fr as (
    select f.evolution_instance_id as fid, f.name
    from public.franchises f
    where f.status = 'active' and not coalesce(f.is_test, false)
      and f.evolution_instance_id is not null
      and (p_franchise_id is null or f.evolution_instance_id = p_franchise_id)
  ),
  vd as (
    select s.franchise_id as fid, s.sale_date as dia,
           sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)) as rev
    from public.sales s
    join fr on fr.fid = s.franchise_id
    cross join d
    where s.sale_date >= d.ant_ini and s.sale_date <= d.hoje
    group by 1, 2
  ),
  tot as (
    select dia, sum(rev) as rev from vd group by dia
  ),
  dias as (
    select g::date as dia
    from d, generate_series(d.mes_ini, d.hoje, interval '1 day') g
  ),
  serie as (
    select dias.dia,
           coalesce(t.rev, 0) as rev,
           coalesce(t4.rev, 0) as rev_4_semanas
    from dias
    left join tot t on t.dia = dias.dia
    left join tot t4 on t4.dia = dias.dia - 28
  )
  select jsonb_build_object(
    'hoje', to_char(d.hoje, 'YYYY-MM-DD'),
    'mes', to_char(d.hoje, 'YYYY-MM'),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', to_char(serie.dia, 'YYYY-MM-DD'),
               'rev', round(serie.rev, 2),
               'rev_4_semanas', round(serie.rev_4_semanas, 2))
             order by serie.dia)
      from serie), '[]'::jsonb),
    'unidades_por_dia', case when p_franchise_id is null then coalesce((
      select jsonb_object_agg(u.dia, u.lista)
      from (
        select to_char(vd.dia, 'YYYY-MM-DD') as dia,
               jsonb_agg(jsonb_build_object(
                 'franchise_id', vd.fid,
                 'franchise_name', fr.name,
                 'rev', round(vd.rev, 2))
               order by vd.rev desc, fr.name) as lista
        from vd
        join fr on fr.fid = vd.fid
        where vd.dia >= d.mes_ini and vd.rev > 0
        group by vd.dia
      ) u), '{}'::jsonb) end
  )
  into v
  from d;

  return v;
end
$fn$;

revoke execute on function public.get_faturamento_por_dia(text) from public, anon;
grant execute on function public.get_faturamento_por_dia(text) to authenticated, service_role;
