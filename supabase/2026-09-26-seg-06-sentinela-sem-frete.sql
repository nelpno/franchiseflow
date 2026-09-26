-- 2026-09-26 — Sentinela: sai a verificacao 6 ("pedido sem frete")
-- Por que (Nelson, 26/09): frete zero no pedido a fabrica e legitimo quando o pedido e ACRESCIMO
-- de outro (frete ja cobrado no principal) ou RETIRADA na fabrica. O achado acusou Limeira e
-- Ribeirao Preto no 1o ensaio — falso positivo. O frete ja e conferido ao confirmar o pedido.
-- Base: corpo aplicado de 2026-09-26-seg-04-sentinela-links.sql (md5 a48ecfdce39a307a69ae9b8c51107969),
-- so sem o bloco 6. ROLLBACK: reaplicar o seg-04.

create or replace function public.sentinela_diaria()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  titulos text[] := '{}';
  achados text[] := '{}';
  links   text[] := '{}';
  n int;
  detalhe text;
  v_evo text;
  i int;
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
      titulos := titulos || 'Sentinela: rotina automática falhou'::text;
      achados := achados || format('%s execucao(oes) de cron falharam: %s', n, detalhe);
      links   := links   || '/Dashboard'::text;  -- tecnico: nao ha tela
    end if;
  exception when others then
    titulos := titulos || 'Sentinela: rotina automática falhou'::text;
    achados := achados || 'nao consegui ler cron.job_run_details'::text;
    links   := links   || '/Dashboard'::text;
  end;

  -- 2) o fechamento de ontem entrou? (foi assim que o ranking ficou 2 dias errado)
  begin
    select count(*) into n from daily_summaries where date = ontem;
    if n = 0 then
      titulos := titulos || 'Sentinela: fechamento de ontem não entrou'::text;
      achados := achados || format('daily_summaries SEM NENHUMA linha de %s — o ranking de 7/30 dias esta errado', to_char(ontem, 'DD/MM'));
      links   := links   || '/Dashboard'::text;  -- tecnico: nao ha tela
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
    select count(*), string_agg(f.name, ', ' order by f.name), min(f.evolution_instance_id)
      into n, detalhe, v_evo
    from media m
    join franchises f on f.evolution_instance_id = m.franchise_id
    where m.ultima < ontem - 1
      and not f.is_test;
    if n > 0 then
      titulos := titulos || 'Sentinela: unidade parou de vender'::text;
      achados := achados || format('%s franquia(s) que vendem todo dia estao sem vender ha 2+ dias: %s', n, detalhe);
      -- TODO Fase 2: se n = 1, '/Unidade?id=' || v_evo
      links   := links   || '/CustomerSuccess'::text;
    end if;
  exception when others then null;
  end;

  -- 4) despesa de marketing duplicada de verdade (mesmo valor, uma manual + uma automatica,
  --    mesmo mes) — regra de sentinela_marketing_duplicado(), mes atual e anterior.
  begin
    select count(*), string_agg(d.franquia || ' (' || d.mes || ', R$ ' || d.valor::text || ')', ', ')
      into n, detalhe
    from public.sentinela_marketing_duplicado() d
    where to_date(d.mes, 'MM/YYYY') >= date_trunc('month', (now() at time zone 'America/Sao_Paulo') - interval '1 month')::date;
    if n > 0 then
      -- a funcao devolve o NOME; so da para aprofundar o link quando ha 1 caso
      select min(f.evolution_instance_id) into v_evo
      from public.sentinela_marketing_duplicado() d
      join franchises f on f.name = d.franquia
      where to_date(d.mes, 'MM/YYYY') >= date_trunc('month', (now() at time zone 'America/Sao_Paulo') - interval '1 month')::date;
      titulos := titulos || 'Sentinela: despesa de marketing duplicada'::text;
      achados := achados || format('despesa de marketing DUPLICADA em %s caso(s): %s', n, detalhe);
      links   := links   || case when n = 1 and v_evo is not null
                                 then '/Financeiro?tab=porunidade&franchise=' || v_evo
                                 else '/Financeiro?tab=porunidade' end;
    end if;
  exception when others then null;
  end;

  -- 5) unidade ativa sem nenhuma assinatura (o buraco que custou 4 meses na Americana)
  begin
    select count(*), string_agg(f.name, ', ' order by f.name), min(f.evolution_instance_id)
      into n, detalhe, v_evo
    from franchises f
    left join system_subscriptions ss
      on ss.franchise_id = f.id::text or ss.franchise_id = f.evolution_instance_id
    where f.status = 'active'
      and not f.is_test
      and coalesce(f.cpf_cnpj, '') <> ''
      and (ss.franchise_id is null or ss.asaas_subscription_id is null)
      and coalesce(ss.subscription_status, '') <> 'CANCELLED';
    if n > 0 then
      titulos := titulos || 'Sentinela: unidade sem cobrança'::text;
      achados := achados || format('%s unidade(s) ativa(s) SEM COBRANCA criada: %s', n, detalhe);
      -- TODO Fase 2: se n = 1, '/Unidade?id=' || v_evo
      links   := links   || '/Financeiro?tab=mensalidades'::text;
    end if;
  exception when others then null;
  end;


  if array_length(achados, 1) is null then
    return 'sentinela: nada a relatar';
  end if;

  -- um aviso por achado, cada um levando para onde se resolve
  for i in 1 .. array_length(achados, 1) loop
    perform notify_admins(
      titulos[i],
      achados[i],
      'warning',
      'monitor_heart',
      links[i]
    );
  end loop;

  return array_to_string(achados, E'\n');
end;
$function$;

-- ACL igual a de hoje (o arquivo de 07/09 revogou de public/anon e deu a service_role).
revoke all on function public.sentinela_diaria() from public, anon;
grant execute on function public.sentinela_diaria() to service_role;
