-- 2026-09-07 — get_marketing_attribution: o retorno da verba de marketing, por unidade
--
-- POR QUE
--   O banco ja sabe quem chegou por anuncio: contacts.ctwa_clid (click id do Clique-para-WhatsApp)
--   e contacts.meta_ad_id sao gravados pelo robo desde o primeiro contato. Medido em 07/09/2026:
--   38.612 dos 57.096 contatos tem um dos dois, e em agosto/2026 as vendas ligadas a eles somam
--   R$ 119.264,93 de R$ 390.429,48 — 30,5% da receita da rede. `grep -r ctwa_clid src/` = 0:
--   NENHUMA tela lia isso. O admin decidia verba no escuro e o franqueado pagava sem ver retorno.
--
-- O QUE ELA NAO FAZ, DE PROPOSITO
--   1. Nao devolve liquido nem ROAS. A taxa do Meta (14%) NAO existe no banco — vive na constante
--      MARKETING_TAX_RATE do front (src/lib/franchiseUtils.js), e e de la que todo o resto do app
--      deriva o liquido. Se a RPC calculasse, passariam a existir duas verdades e um reajuste de
--      taxa consertaria so uma. A RPC devolve fato bruto; quem divide e o front.
--   2. Nao diz de QUAL campanha. campaign_name esta vazio em 100% dos contatos dos ultimos 30 dias
--      (0 de 11.885). Da para dizer "veio de anuncio", nao "veio do anuncio X" — e a UI tem de
--      dizer isso, senao alguem vai otimizar campanha com um dado que nao existe.
--
-- COMO A ATRIBUICAO FUNCIONA (e por que vem em duas reguas)
--   E last-touch POR CONTATO: se o contato tem origem de anuncio, toda venda dele conta, inclusive
--   a recompra de um ano depois. Isso superestima o mes. Por isso a funcao devolve TAMBEM o recorte
--   estreito — so os contatos CRIADOS no mes — que e o mais perto de "cliente novo que o anuncio
--   trouxe". As duas colunas existem para a UI mostrar as duas e nao esconder a diferenca.
--
-- ROLLBACK
--   drop function if exists public.get_marketing_attribution(text, text);
create or replace function public.get_marketing_attribution(
  p_month text,                      -- 'AAAA-MM'
  p_franchise_id text default null   -- nulo = a rede toda (so admin/manager)
)
returns table (
  franchise_id            text,
  franchise_name          text,
  verba_bruta             numeric,  -- marketing_payments confirmados do reference_month
  vendas_total            integer,
  receita_total           numeric,
  vendas_anuncio          integer,  -- contato com origem de anuncio, criado quando for
  receita_anuncio         numeric,
  clientes_novos_anuncio  integer,  -- contatos de anuncio criados DENTRO do mes
  vendas_novos_anuncio    integer,  -- vendas desses contatos novos
  receita_novos_anuncio   numeric
)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_ini date;
  v_fim date;  -- exclusivo
begin
  -- quem pode ver o que
  if not is_admin_or_manager() then
    if p_franchise_id is null or not (p_franchise_id = any (managed_franchise_ids())) then
      return;  -- sem linha nenhuma, nunca a rede inteira
    end if;
  end if;

  begin
    v_ini := to_date(p_month || '-01', 'YYYY-MM-DD');
  exception when others then
    return;
  end;
  v_fim := (v_ini + interval '1 month')::date;

  return query
  with alvo as (
    select f.evolution_instance_id as fid, f.name as fnome
    from franchises f
    where f.evolution_instance_id is not null
      and (p_franchise_id is null or f.evolution_instance_id = p_franchise_id)
  ),
  verba as (
    select mp.franchise_id as fid, sum(mp.amount) as bruto
    from marketing_payments mp
    where mp.reference_month = p_month and mp.status = 'confirmed'
    group by 1
  ),
  vendas as (
    select
      s.franchise_id as fid,
      count(*)::int as n_total,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)), 0) as r_total,
      count(*) filter (where c.id is not null)::int as n_anuncio,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where c.id is not null), 0) as r_anuncio,
      count(*) filter (where c.created_at >= v_ini and c.created_at < v_fim)::int as n_novos,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0))
               filter (where c.created_at >= v_ini and c.created_at < v_fim), 0) as r_novos
    from sales s
    left join contacts c
      on c.id = s.contact_id
     and (c.ctwa_clid is not null or c.meta_ad_id is not null)
    where s.sale_date >= v_ini and s.sale_date < v_fim
    group by 1
  ),
  novos as (
    select c.franchise_id as fid, count(*)::int as n
    from contacts c
    where c.created_at >= v_ini and c.created_at < v_fim
      and (c.ctwa_clid is not null or c.meta_ad_id is not null)
    group by 1
  )
  select
    a.fid, a.fnome,
    coalesce(vb.bruto, 0)::numeric,
    coalesce(v.n_total, 0), coalesce(v.r_total, 0)::numeric,
    coalesce(v.n_anuncio, 0), coalesce(v.r_anuncio, 0)::numeric,
    coalesce(nv.n, 0),
    coalesce(v.n_novos, 0), coalesce(v.r_novos, 0)::numeric
  from alvo a
  left join verba  vb on vb.fid = a.fid
  left join vendas v  on v.fid  = a.fid
  left join novos  nv on nv.fid = a.fid
  where coalesce(vb.bruto, 0) > 0 or coalesce(v.n_total, 0) > 0
  order by coalesce(v.r_anuncio, 0) desc;
end;
$$;

revoke all on function public.get_marketing_attribution(text, text) from public;
grant execute on function public.get_marketing_attribution(text, text) to authenticated;
