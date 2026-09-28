-- 2026-09-28 — S1.3 · Vigia de vendas na sentinela_diaria (3 verificações novas: 6, 7 e 8)
--
-- Base: corpo LIVE de 28/09 (md5 prosrc cbf35f2000a7fe1a363d526c88be847e, 5490 bytes) = seg-06 +
-- links da Fase 2 nos blocos 3 e 5. Os blocos 1-5 abaixo são cópia fiel dele.
-- ROLLBACK: recriar a função com o corpo de docs/db-backups/sentinela_diaria.2026-09-28-antes.sql.
--
-- Medido antes de ligar (90 dias, sem is_test):
--   6) venda do robô com valor ≠ soma dos itens: 8 (máx 2 no mesmo dia) + 1 sem itens.
--   7) robô + manual, mesma unidade, mesmo dia, mesmo cliente, valor igual (±R$1): 20.
--      Sem a trava do valor seriam 35 (recompra no mesmo dia é legítima → fica fora).
--   8) entrega do robô sem endereço (nem na venda nem no contato): 517 em 30 dias (~17/dia).
--      Vai avisar TODO DIA até a S4.2 (robô gravar o endereço) — é o termômetro dela.
--      Entrega manual sem endereço (853/30d) fica de fora: a franqueada entrega sem anotar.
-- Janela: vendas CRIADAS nas últimas 24h (cron 1x/dia; se o cron atrasar/perder um dia, o intervalo
-- fica sem vigia — aceito: a S4 mede por 7 dias seguidos). Erro num bloco novo vira achado (P3).

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
  n2 int;
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
      -- FASE 2: 1 unidade só -> manda direto pra Ficha; senão fica na lista do CS.
      links   := links   || case when n = 1 and v_evo is not null
                                 then '/Unidade?id=' || v_evo
                                 else '/CustomerSuccess' end;
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
      -- FASE 2: 1 unidade só -> manda direto pra Ficha; senão fica na tela de mensalidades.
      links   := links   || case when n = 1 and v_evo is not null
                                 then '/Unidade?id=' || v_evo
                                 else '/Financeiro?tab=mensalidades' end;
    end if;
  exception when others then null;
  end;

  -- 6) venda do robô com valor diferente da soma dos itens (ou sem item nenhum) — S1.3/S4.1
  begin
    with itens as (
      select si.sale_id, sum(si.quantity * si.unit_price) as soma
      from sale_items si
      join sales s on s.id = si.sale_id
      where s.created_at > now() - interval '24 hours'
      group by si.sale_id
    ), div as (
      select s.id, s.franchise_id, s.sale_number, s.value, i.soma
      from sales s
      join franchises f on f.evolution_instance_id = s.franchise_id
      left join itens i on i.sale_id = s.id
      where s.created_at > now() - interval '24 hours'
        and s.source is distinct from 'manual'
        and not f.is_test
        and (i.sale_id is null or s.value is null or abs(s.value - i.soma) > 0.05)
    )
    select count(*),
           string_agg(f.name || ' #' || coalesce(d.sale_number::text, '?') || ' (venda R$ ' || coalesce(d.value::text, 'vazio')
                      || ', itens R$ ' || coalesce(d.soma::text, 'nenhum') || ')', ', ' order by f.name),
           min(d.franchise_id), count(distinct d.franchise_id)
      into n, detalhe, v_evo, n2
    from div d join franchises f on f.evolution_instance_id = d.franchise_id;
    if n > 0 then
      titulos := titulos || 'Sentinela: venda do robô com valor diferente dos itens'::text;
      achados := achados || format('%s venda(s) do robô nas últimas 24h com valor ≠ soma dos itens: %s', n, detalhe);
      links   := links   || case when n2 = 1 and v_evo is not null
                                 then '/Unidade?id=' || v_evo
                                 else '/Dashboard' end;
    end if;
  exception when others then
    titulos := titulos || 'Sentinela: verificação 6 falhou'::text;
    achados := achados || format('verificação 6 da sentinela deu erro %s: %s', sqlstate, left(sqlerrm, 200));
    links   := links   || '/Dashboard'::text;
  end;

  -- 7) mesma venda lançada 2x: robô + manual, mesma unidade, mesmo dia, mesmo cliente e
  --    mesmo valor líquido (±R$1). Recompra no mesmo dia com outro valor fica de fora.
  begin
    with dup as (
      select a.franchise_id, a.sale_number as n_robo, m.sale_number as n_manual
      from sales a
      join sales m on m.franchise_id = a.franchise_id
                  and m.sale_date = a.sale_date
                  and m.source = 'manual'
                  and (m.contact_id = a.contact_id
                       or nullif(m.contact_phone, '') = nullif(a.contact_phone, ''))
                  and abs((a.value - coalesce(a.discount_amount, 0)) - (m.value - coalesce(m.discount_amount, 0))) <= 1
      join franchises f on f.evolution_instance_id = a.franchise_id
      where a.source is distinct from 'manual'
        and not f.is_test
        and (a.created_at > now() - interval '24 hours' or m.created_at > now() - interval '24 hours')
    )
    select count(*),
           string_agg(f.name || ' #' || coalesce(d.n_robo::text, '?') || ' e #' || coalesce(d.n_manual::text, '?'), ', ' order by f.name),
           min(d.franchise_id), count(distinct d.franchise_id)
      into n, detalhe, v_evo, n2
    from dup d join franchises f on f.evolution_instance_id = d.franchise_id;
    if n > 0 then
      titulos := titulos || 'Sentinela: possível venda lançada duas vezes'::text;
      achados := achados || format('%s par(es) robô + manual com o mesmo cliente, dia e valor (pode ser recompra, conferir): %s', n, detalhe);
      links   := links   || case when n2 = 1 and v_evo is not null
                                 then '/Unidade?id=' || v_evo
                                 else '/Dashboard' end;
    end if;
  exception when others then
    titulos := titulos || 'Sentinela: verificação 7 falhou'::text;
    achados := achados || format('verificação 7 da sentinela deu erro %s: %s', sqlstate, left(sqlerrm, 200));
    links   := links   || '/Dashboard'::text;
  end;

  -- 8) entrega do robô sem endereço (nem na venda nem no contato) — termômetro da S4.2
  begin
    with sem as (
      select s.franchise_id
      from sales s
      join franchises f on f.evolution_instance_id = s.franchise_id
      left join contacts c on c.id = s.contact_id and c.franchise_id = s.franchise_id
      where s.created_at > now() - interval '24 hours'
        and s.source is distinct from 'manual'
        and s.delivery_method = 'delivery'
        and not f.is_test
        and coalesce(trim(s.customer_address), '') = ''
        and coalesce(trim(c.endereco), '') = ''
    )
    select count(*),
           (select string_agg(x.name || ' (' || x.c || ')', ', ' order by x.c desc, x.name)
              from (select f.name, count(*) c from sem join franchises f on f.evolution_instance_id = sem.franchise_id group by f.name) x),
           min(franchise_id), count(distinct franchise_id)
      into n, detalhe, v_evo, n2
    from sem;
    if n > 0 then
      select count(*) into i
      from sales s join franchises f on f.evolution_instance_id = s.franchise_id
      where s.created_at > now() - interval '24 hours' and s.source is distinct from 'manual'
        and s.delivery_method = 'delivery' and not f.is_test;
      titulos := titulos || 'Sentinela: entrega do robô sem endereço'::text;
      achados := achados || format('%s de %s entrega(s) do robô nas últimas 24h sem endereço: %s', n, i, detalhe);
      links   := links   || case when n2 = 1 and v_evo is not null
                                 then '/Unidade?id=' || v_evo
                                 else '/Dashboard' end;
    end if;
  exception when others then
    titulos := titulos || 'Sentinela: verificação 8 falhou'::text;
    achados := achados || format('verificação 8 da sentinela deu erro %s: %s', sqlstate, left(sqlerrm, 200));
    links   := links   || '/Dashboard'::text;
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

revoke all on function public.sentinela_diaria() from public, anon, authenticated;
grant execute on function public.sentinela_diaria() to service_role;
