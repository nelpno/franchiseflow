-- 2026-09-26 admin 12 — get_network_funnel_benchmark() ganha network_reached
--
-- NAO APLICADO (regra do orquestrador: SQL novo fica pronto, nunca aplicado por este agente).
-- Partiu do pg_get_functiondef() ATUAL lido por SELECT via MCP em 26/09/2026
-- (md5 da11ec70e04c91dfbf45b37c0021ed1e; a copia em supabase/get-franchise-funnel-stats.sql
-- esta DESATUALIZADA: falta o "AND NOT is_test" no CTE `fr`, que o banco ja tem).
--
-- O QUE MUDA (mudanca 40 do padrao visual, prioridade baixa)
-- O cartao "Quem fala com o robo e compra" (Hoje) mostra a conversao mas nao a base
-- (quantas pessoas). Acrescenta `network_reached` (soma de `reached` das franquias que
-- entraram no calculo, ou seja o `SUM(reached)` do mesmo FILTRO `reached >= 50` que ja
-- decide quem entra na media) ao RETURNS TABLE. So SOMA, nada de novo exposto por franquia
-- (o benchmark ja e agregado; ver comentario original "Só agregado — nunca expõe franquia
-- individual").
--
-- FRENTE: ResumoRedeCards.jsx le funilAtualQuery.data?.network_reached com optional
-- chaining — ENQUANTO nao aplicado, o campo vem undefined e o texto "· N pessoas" so
-- some (front tolerante a coluna ausente; decisao 4 do orquestrador).
--
-- Mudar o RETURNS TABLE exige DROP antes (CREATE OR REPLACE nao troca colunas de saida).
-- DROP e CREATE na MESMA transacao: nenhum instante sem a funcao para o painel.

begin;

drop function if exists public.get_network_funnel_benchmark(date, date);

CREATE FUNCTION public.get_network_funnel_benchmark(p_start date, p_end date)
 RETURNS TABLE(network_conversion_pct numeric, network_purchases_per_customer numeric, franchises_counted integer, network_reached integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH fr AS (
    SELECT DISTINCT evolution_instance_id AS fid
    FROM franchises
    WHERE status = 'active' AND evolution_instance_id IS NOT NULL AND NOT is_test
  ),
  per AS (
    SELECT x.reached, x.converted, y.customers, y.purchases
    FROM fr
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) AS reached,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM sales s
          WHERE s.contact_id = c.id AND s.sale_date BETWEEN p_start AND p_end
        )) AS converted
      FROM (
        SELECT DISTINCT b.contact_phone AS ph
        FROM bot_conversations b
        WHERE b.franchise_id = fr.fid
          AND b.started_at >= (p_start::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND b.started_at <  ((p_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND b.contact_phone IS NOT NULL
          AND b.contact_phone <> ''
      ) p
      LEFT JOIN contacts c ON c.franchise_id = fr.fid AND c.telefone = p.ph
    ) x
    CROSS JOIN LATERAL (
      SELECT COUNT(*) AS customers, COALESCE(SUM(q.n), 0) AS purchases
      FROM (
        SELECT s.contact_id, COUNT(*) AS n
        FROM sales s
        WHERE s.franchise_id = fr.fid
          AND s.sale_date BETWEEN p_start AND p_end
          AND s.contact_id IS NOT NULL
        GROUP BY s.contact_id
      ) q
    ) y
  )
  SELECT
    ROUND(100.0 * SUM(converted) / NULLIF(SUM(reached), 0), 1),
    ROUND(SUM(purchases)::numeric / NULLIF(SUM(customers), 0), 2),
    COUNT(*)::int,
    SUM(reached)::int
  FROM per
  WHERE reached >= 50;
$function$;

revoke execute on function public.get_network_funnel_benchmark(date, date) from public, anon;
grant execute on function public.get_network_funnel_benchmark(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- CONFERENCIA (rodar DEPOIS, em query separada; os dois `materialized` sao obrigatorios)
-- with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true)),
--      f as materialized (select r.* from ctx, lateral public.get_network_funnel_benchmark(date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date) r)
-- select * from f;
-- network_reached deve bater com a mesma soma calculada à mão:
-- with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub',(select id from profiles where role='admin' order by created_at limit 1))::text, true))
-- select sum(x.reached) from ctx, (select 1) dummy,
--   lateral (select count(*) as reached from (select distinct b.contact_phone from bot_conversations b
--     join franchises f2 on f2.evolution_instance_id = b.franchise_id and f2.status='active' and not f2.is_test
--     where b.started_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
--       and b.started_at < (((now() at time zone 'America/Sao_Paulo')::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
--       and b.contact_phone is not null and b.contact_phone <> '') p) x;

-- ROLLBACK (volta exatamente à versão sem network_reached, md5 da11ec70e04c91dfbf45b37c0021ed1e):
/*
begin;

drop function if exists public.get_network_funnel_benchmark(date, date);

CREATE FUNCTION public.get_network_funnel_benchmark(p_start date, p_end date)
 RETURNS TABLE(network_conversion_pct numeric, network_purchases_per_customer numeric, franchises_counted integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH fr AS (
    SELECT DISTINCT evolution_instance_id AS fid
    FROM franchises
    WHERE status = 'active' AND evolution_instance_id IS NOT NULL AND NOT is_test
  ),
  per AS (
    SELECT x.reached, x.converted, y.customers, y.purchases
    FROM fr
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) AS reached,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM sales s
          WHERE s.contact_id = c.id AND s.sale_date BETWEEN p_start AND p_end
        )) AS converted
      FROM (
        SELECT DISTINCT b.contact_phone AS ph
        FROM bot_conversations b
        WHERE b.franchise_id = fr.fid
          AND b.started_at >= (p_start::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND b.started_at <  ((p_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND b.contact_phone IS NOT NULL
          AND b.contact_phone <> ''
      ) p
      LEFT JOIN contacts c ON c.franchise_id = fr.fid AND c.telefone = p.ph
    ) x
    CROSS JOIN LATERAL (
      SELECT COUNT(*) AS customers, COALESCE(SUM(q.n), 0) AS purchases
      FROM (
        SELECT s.contact_id, COUNT(*) AS n
        FROM sales s
        WHERE s.franchise_id = fr.fid
          AND s.sale_date BETWEEN p_start AND p_end
          AND s.contact_id IS NOT NULL
        GROUP BY s.contact_id
      ) q
    ) y
  )
  SELECT
    ROUND(100.0 * SUM(converted) / NULLIF(SUM(reached), 0), 1),
    ROUND(SUM(purchases)::numeric / NULLIF(SUM(customers), 0), 2),
    COUNT(*)::int
  FROM per
  WHERE reached >= 50;
$function$;

revoke execute on function public.get_network_funnel_benchmark(date, date) from public, anon;
grant execute on function public.get_network_funnel_benchmark(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
*/
