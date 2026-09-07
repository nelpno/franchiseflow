-- 2026-09-07 — Auditoria, Onda 3 — VIGILANCIA
--
-- O problema que isto resolve nao e nenhum bug especifico: e o fato de que NADA vigia.
-- Todos os incidentes recentes foram descobertos por reclamacao de franqueada, dias
-- depois: o QR PIX morto (01/09), a assinatura da Americana que falhava calada
-- (19/08), a ficha de separacao sem endereco (26/08). E na propria auditoria de hoje
-- havia TRES problemas ativos que ninguem sabia: o cron do ranking parado desde 05/09,
-- as 3 RPCs de bot em HTTP 500 ha 24h, e a unidade sem nenhuma assinatura.
--
-- Roda 1x/dia as 08:10 BRT (logo depois do sync do ASAAS, que e 08:05) e escreve no
-- sino do admin via notify_admins(). Cada verificacao e independente: uma que falhe
-- nao impede as outras (BEGIN/EXCEPTION por bloco).
--
-- Desligar:  select cron.unschedule('sentinela-diaria');
-- Rodar na mao para ver:  select public.sentinela_diaria();

create or replace function public.sentinela_diaria()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  achados text[] := '{}';
  n int;
  detalhe text;
  ontem date := (now() at time zone 'America/Sao_Paulo')::date - 1;
begin
  -- 1) algum cron falhou nas ultimas 24h?
  begin
    select count(*), string_agg(distinct j.jobname, ', ')
      into n, detalhe
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where d.status = 'failed' and d.start_time > now() - interval '24 hours';
    if n > 0 then
      achados := achados || format('%s execucao(oes) de cron falharam: %s', n, detalhe);
    end if;
  exception when others then
    achados := achados || 'nao consegui ler cron.job_run_details';
  end;

  -- 2) o fechamento de ontem entrou? (foi assim que o ranking ficou 2 dias errado)
  begin
    select count(*) into n from daily_summaries where date = ontem;
    if n = 0 then
      achados := achados || format('daily_summaries SEM NENHUMA linha de %s — o ranking de 7/30 dias esta errado', to_char(ontem, 'DD/MM'));
    end if;
  exception when others then null;
  end;

  -- 3) franquia que vende todo dia e parou (media >= 3 vendas/dia em 30d, 0 ha 2 dias)
  begin
    with media as (
      select s.franchise_id, count(*)::numeric / 30 as por_dia, max(s.sale_date) as ultima
      from sales s
      where s.sale_date >= ontem - 30
      group by s.franchise_id
      having count(*)::numeric / 30 >= 3
    )
    select count(*), string_agg(f.name, ', ' order by f.name)
      into n, detalhe
    from media m
    join franchises f on f.evolution_instance_id = m.franchise_id
    where m.ultima < ontem - 1;
    if n > 0 then
      achados := achados || format('%s franquia(s) que vendem todo dia estao sem vender ha 2+ dias: %s', n, detalhe);
    end if;
  exception when others then null;
  end;

  -- 4) despesa de marketing duplicada no mes (3 casos ja aconteceram: R$ 1.200 em dobro)
  begin
    with dup as (
      select e.franchise_id, date_trunc('month', e.expense_date) as mes, count(*) as qtd
      from expenses e
      where e.category = 'marketing'
        and e.expense_date >= date_trunc('month', now() - interval '1 month')
      group by 1, 2
      having count(*) > 1
    )
    select count(*), string_agg(coalesce(f.name, d.franchise_id) || ' (' || to_char(d.mes, 'MM/YYYY') || ')', ', ')
      into n, detalhe
    from dup d
    left join franchises f on f.evolution_instance_id = d.franchise_id;
    if n > 0 then
      achados := achados || format('despesa de marketing DUPLICADA em %s caso(s): %s', n, detalhe);
    end if;
  exception when others then null;
  end;

  -- 5) unidade ativa sem nenhuma assinatura (o buraco que custou 4 meses na Americana)
  begin
    select count(*), string_agg(f.name, ', ' order by f.name)
      into n, detalhe
    from franchises f
    left join system_subscriptions ss
      on ss.franchise_id = f.id::text or ss.franchise_id = f.evolution_instance_id
    where f.status = 'active'
      and coalesce(f.cpf_cnpj, '') <> ''
      and (ss.franchise_id is null or ss.asaas_subscription_id is null)
      and coalesce(ss.subscription_status, '') <> 'CANCELLED';
    if n > 0 then
      achados := achados || format('%s unidade(s) ativa(s) SEM COBRANCA criada: %s', n, detalhe);
    end if;
  exception when others then null;
  end;

  -- 6) pedido a fabrica confirmado/entregue com frete zero (regra de 30/08)
  begin
    select count(*), string_agg(coalesce(f.name, po.franchise_id), ', ')
      into n, detalhe
    from purchase_orders po
    left join franchises f on f.evolution_instance_id = po.franchise_id
    where po.status in ('confirmado', 'entregue')
      and coalesce(po.freight_cost, 0) = 0
      and po.ordered_at > now() - interval '7 days';
    if n > 0 then
      achados := achados || format('%s pedido(s) da ultima semana sem frete lancado: %s', n, detalhe);
    end if;
  exception when others then null;
  end;

  if array_length(achados, 1) is null then
    return 'sentinela: nada a relatar';
  end if;

  perform notify_admins(
    format('Sentinela: %s ponto(s) para olhar', array_length(achados, 1)),
    array_to_string(achados, E'\n'),
    'warning',
    'health_and_safety',
    '/Dashboard'
  );

  return array_to_string(achados, E'\n');
end;
$function$;

revoke all on function public.sentinela_diaria() from public, anon;
grant execute on function public.sentinela_diaria() to service_role;

-- 08:10 BRT = 11:10 UTC (o container do Postgres roda em UTC)
select cron.schedule('sentinela-diaria', '10 11 * * *', $$select public.sentinela_diaria();$$);

-- ── REFINO aplicado no mesmo dia ─────────────────────────────────────────────
-- A verificacao 4 acima ("2+ despesas de marketing no mes") era ERRADA e teria dado
-- alarme falso todo dia: a verba do Meta (automatica) MAIS uma despesa avulsa de
-- marketing ("Panfletos", "Flyer de divulgacao", "Trafego pago" com valor diferente)
-- e o caso normal. Ela acusou 3 franquias legitimas na primeira execucao.
--
-- A assinatura de duplicata de verdade e MESMO VALOR + mesma franquia + mesmo mes +
-- um lancamento manual e outro do marketing_payment. Isso acha os 3 casos reais
-- (Cajamar 07 R$ 600, Santana 08 R$ 400, Cotia 04 R$ 200 = os R$ 1.200 do relatorio)
-- e NAO acusa a Americana 04/2026, que tem duas verbas de meses de REFERENCIA
-- diferentes pagas no mesmo mes — normal, e ate documentado no CLAUDE.md
-- (getMarketingTargetMonth mira o mes seguinte nos ultimos 5 dias).
--
-- A regra virou a funcao `sentinela_marketing_duplicado()`, e a `sentinela_diaria()`
-- passou a chama-la. Ver a migration `sentinela_regra_duplicata_precisa_2026_09_07`.
