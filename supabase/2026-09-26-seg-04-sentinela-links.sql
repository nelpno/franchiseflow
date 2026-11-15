-- 2026-09-26 — Redesenho do admin, Fase 0 (B4) — Sentinela: um aviso POR ACHADO, cada um com o link certo
--
-- Por que: hoje a sentinela-diaria (cron jobid 5, 11:10 UTC = 08:10 BRT) grava UM aviso com
-- todos os achados juntos e link fixo '/Dashboard' — clicar leva a home, que nao mostra
-- nenhum deles (principio 1 do redesenho: todo clique diz para onde vai).
--
-- PARIDADE (provada 26/09): md5(prosrc) de producao = de1e6b9aa27b740030d848990520de16 =
-- md5 do corpo do arquivo supabase/2026-09-07-sentinela-diaria.sql (linhas 28-142, com o
-- "\n" inicial que o Postgres guarda). Sem CR. Esta versao parte do corpo de PRODUCAO.
--
-- MUDANCA 1 — link por tipo de achado (rotas conferidas em src/pages.config.js e App.jsx;
-- Financeiro aceita ?tab=porunidade|mensalidades|fechamento):
--   1 cron falhou .................... /Dashboard                (tecnico, nao ha tela)
--   2 fechamento de ontem nao entrou . /Dashboard                (tecnico, nao ha tela)
--   3 unidade que vendia parou ....... /CustomerSuccess
--   4 marketing duplicado ............ /Financeiro?tab=porunidade (+ &franchise=<evo> se for 1 so)
--   5 unidade sem cobranca ........... /Financeiro?tab=mensalidades
--   6 pedido sem frete ............... /PurchaseOrders
--   TODO Fase 2: quando o achado for de UMA unidade, trocar por /Unidade?id=<evo> (a rota
--   ainda nao existe; itens 3, 4 e 5 ja carregam o evo em `v_evo` para isso).
--   Volume: de 1 aviso/dia para ~1-3/dia (hoje 3 tipos disparam todo dia; com a Mudanca 2 cai
--   para ~2). So o papel 'admin' recebe (notify_admins); gerente/CS nao.
--
-- MUDANCA 2 (recomendada; separavel) — a verificacao 4 de producao e a versao ERRADA:
--   o proprio arquivo de 07/09 diz que ela foi trocada por sentinela_marketing_duplicado()
--   ("verba automatica + despesa avulsa de marketing e o caso normal"), mas a troca NUNCA foi
--   aplicada na sentinela_diaria. Resultado: de 09/09 a 26/09 TODO aviso trouxe "despesa de
--   marketing DUPLICADA em 3-5 casos" (Vila Formosa, Jaragua, Guarulhos Jd. Rosa de Franca,
--   Leme, Ubatuba); sentinela_marketing_duplicado() nos 2 ultimos meses devolve 0 linhas.
--   Alarme falso diario ensina a ignorar o sino. Aqui a verificacao 4 passa a usar a regra
--   precisa (mesmo valor + manual E automatica no mesmo mes), limitada ao mes atual e anterior.
--
-- MUDANCA 3 — unidades de teste (franchises.is_test) fora das verificacoes 3, 5 e 6
--   (principio 5 do plano).

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

  -- 6) pedido a fabrica confirmado/entregue com frete zero (regra de 30/08)
  begin
    select count(*), string_agg(coalesce(f.name, po.franchise_id), ', ')
      into n, detalhe
    from purchase_orders po
    left join franchises f on f.evolution_instance_id = po.franchise_id
    where po.status in ('confirmado', 'entregue')
      and coalesce(po.freight_cost, 0) = 0
      and po.ordered_at > now() - interval '7 days'
      and not coalesce(f.is_test, false);
    if n > 0 then
      titulos := titulos || 'Sentinela: pedido sem frete'::text;
      achados := achados || format('%s pedido(s) da ultima semana sem frete lancado: %s', n, detalhe);
      links   := links   || '/PurchaseOrders'::text;
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


-- CONFERÊNCIA (rodar em query separada)
-- a) corpo novo gravado, sem CR:
--    select md5(prosrc), prosrc like E'%\r%' as tem_cr, proconfig from pg_proc where proname = 'sentinela_diaria';
-- b) ensaio SEM gravar aviso (roda e desfaz; a excecao devolve o texto dos achados e os links):
--    do $$ declare r text; begin
--      r := public.sentinela_diaria();
--      raise exception 'ENSAIO: % || links: %', r,
--        (select string_agg(title || ' -> ' || link, ' | ') from notifications
--          where title like 'Sentinela:%' and created_at > now() - interval '1 minute');
--    end $$;
--    Esperado hoje (26/09): SEM "despesa de marketing duplicada"; "unidade sem cobrança" ->
--    /Financeiro?tab=mensalidades; "pedido sem frete" -> /PurchaseOrders.
-- c) depois das 08:10 BRT do dia seguinte:
--    select title, link, count(*) from notifications where title like 'Sentinela:%'
--      and created_at > now() - interval '1 day' group by 1,2;

-- ROLLBACK: reaplicar a funcao do arquivo supabase/2026-09-07-sentinela-diaria.sql (linhas
-- 22-146; e identica a producao de 26/09, md5 de1e6b9aa27b740030d848990520de16).
