-- 2026-09-07 — get_fechamento_mensal: fechar o mes em UMA tela
--
-- POR QUE
--   Fechar o mes exigia tres telas que nao se cruzam: Financeiro (faturamento e DRE),
--   Marketing > Investimento (quem pagou a verba) e Financeiro > Mensalidades (quem pagou
--   o ASAAS). Nenhuma respondia "esta unidade faturou X, deve a verba e esta com a
--   mensalidade vencida" numa linha so — e essa e a pergunta do fechamento.
--
-- A CONTA DO LUCRO E A MESMA DO FRANQUEADO
--   Copia fiel de calculatePnL (src/lib/financialCalcs.js), inclusive a parte que engana:
--   taxa de cartao so e custo quando a franquia ABSORVEU. Quando ela e repassada
--   (fee_passed_to_customer), quem pagou foi o cliente e ela NAO reduz o lucro. Se o admin
--   visse um lucro diferente do que a franqueada ve na tela dela, a conversa de fechamento
--   comecaria discutindo qual numero esta certo.
--     total_recebido = valor + frete - desconto
--     lucro_caixa    = total_recebido - taxa_absorvida - despesas
--
-- O COMPARATIVO E CORTADO NO MESMO DIA
--   No mes CORRENTE, o mes anterior e cortado no mesmo dia do mes. Sem isso, todo dia 2 a
--   rede inteira aparece "em queda" — comparar 2 dias contra 31.
--
-- ROLLBACK
--   drop function if exists public.get_fechamento_mensal(text);
create or replace function public.get_fechamento_mensal(p_month text)
returns table (
  franchise_id           text,
  franchise_name         text,
  faturamento            numeric,
  faturamento_anterior   numeric,
  vendas                 integer,
  vendas_nao_confirmadas integer,
  valor_nao_confirmado   numeric,
  taxa_absorvida         numeric,
  despesas               numeric,
  lucro_caixa            numeric,
  marketing_status       text,     -- confirmed | rejected | pending | sem_registro
  marketing_valor        numeric,
  mensalidade_status     text,     -- PAID | PENDING | OVERDUE | CANCELLED | sem_cobranca
  mensalidade_valor      numeric,
  mensalidade_vencimento date
)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_ini date;
  v_fim date;      -- exclusivo
  v_ant_ini date;
  v_ant_fim date;  -- exclusivo, cortado no mesmo dia quando o mes e o corrente
begin
  if not is_admin_or_manager() then
    return;
  end if;

  begin
    v_ini := to_date(p_month || '-01', 'YYYY-MM-DD');
  exception when others then
    return;
  end;
  v_fim := (v_ini + interval '1 month')::date;
  v_ant_ini := (v_ini - interval '1 month')::date;

  if v_ini = date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date then
    -- mes corrente: corta o anterior no mesmo dia do mes
    v_ant_fim := least(
      (v_ant_ini + ((now() at time zone 'America/Sao_Paulo')::date - v_ini))::date,
      v_ini
    );
  else
    v_ant_fim := v_ini;
  end if;

  return query
  with unidades as (
    select f.evolution_instance_id as fid, f.name as fnome
    from franchises f
    where f.evolution_instance_id is not null
      -- unidade de teste polui o fechamento (aparecia no topo de "com pendencia", sempre
      -- sem verba e sem mensalidade, empurrando a franquia de verdade para baixo)
      and f.name !~* 'teste'
  ),
  v as (
    select s.franchise_id as fid,
      coalesce(sum(s.value + coalesce(s.delivery_fee,0) - coalesce(s.discount_amount,0)), 0) as fat,
      count(*)::int as n,
      count(*) filter (where s.payment_confirmed is not true)::int as n_nc,
      coalesce(sum(s.value + coalesce(s.delivery_fee,0) - coalesce(s.discount_amount,0))
               filter (where s.payment_confirmed is not true), 0) as v_nc,
      coalesce(sum(coalesce(s.card_fee_amount,0)) filter (where s.fee_passed_to_customer is not true), 0) as taxa
    from sales s
    where s.sale_date >= v_ini and s.sale_date < v_fim
    group by 1
  ),
  v_ant as (
    select s.franchise_id as fid,
      coalesce(sum(s.value + coalesce(s.delivery_fee,0) - coalesce(s.discount_amount,0)), 0) as fat
    from sales s
    where s.sale_date >= v_ant_ini and s.sale_date < v_ant_fim
    group by 1
  ),
  d as (
    select e.franchise_id as fid, coalesce(sum(e.amount), 0) as total
    from expenses e
    where e.expense_date >= v_ini and e.expense_date < v_fim
    group by 1
  ),
  mkt as (
    select mp.franchise_id as fid, mp.status, mp.amount
    from marketing_payments mp
    where mp.reference_month = p_month
  ),
  sub as (
    select ss.franchise_id as fid, ss.subscription_status, ss.current_payment_status,
           ss.current_payment_value, ss.current_payment_due_date
    from system_subscriptions ss
  )
  select
    u.fid, u.fnome,
    coalesce(v.fat, 0)::numeric,
    coalesce(v_ant.fat, 0)::numeric,
    coalesce(v.n, 0), coalesce(v.n_nc, 0), coalesce(v.v_nc, 0)::numeric,
    coalesce(v.taxa, 0)::numeric,
    coalesce(d.total, 0)::numeric,
    (coalesce(v.fat, 0) - coalesce(v.taxa, 0) - coalesce(d.total, 0))::numeric,
    coalesce(mkt.status, 'sem_registro')::text,
    coalesce(mkt.amount, 0)::numeric,
    (case
       when sub.fid is null then 'sem_cobranca'
       when sub.subscription_status = 'CANCELLED' then 'CANCELLED'
       else coalesce(sub.current_payment_status, 'sem_cobranca')
     end)::text,
    coalesce(sub.current_payment_value, 0)::numeric,
    sub.current_payment_due_date
  from unidades u
  left join v      on v.fid      = u.fid
  left join v_ant  on v_ant.fid  = u.fid
  left join d      on d.fid      = u.fid
  left join mkt    on mkt.fid    = u.fid
  left join sub    on sub.fid    = u.fid
  where coalesce(v.n, 0) > 0 or mkt.fid is not null or sub.fid is not null
  order by coalesce(v.fat, 0) desc;
end;
$$;

revoke all on function public.get_fechamento_mensal(text) from public;
grant execute on function public.get_fechamento_mensal(text) to authenticated;
