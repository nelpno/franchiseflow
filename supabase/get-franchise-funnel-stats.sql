-- Funil do franqueado: quantas pessoas chegaram no período e quantas compraram,
-- mais o comportamento de recompra. Alimenta o card "Conversão" do FranchiseeDashboard.
--
-- DENOMINADOR = pessoas distintas que falaram com o robô (bot_conversations.contact_phone).
-- É o único denominador honesto que existe: contato criado na mão é criado PELA venda
-- (SaleForm.resolveContactId), então daria 100% por construção.
-- Por isso franquia sem robô ativo recebe has_bot_data = false e o front esconde o número.
--
-- converted ⊆ reached por construção → a taxa nunca passa de 100%
-- (sem isso, Santos apareceria com 4400%: 4 pessoas no robô, 193 vendas manuais).
--
-- SECURITY DEFINER bypassa RLS de sales/contacts/bot_conversations — por isso todo CTE
-- filtra por p_franchise_id e o HAVING garante 0 rows quando ele vem nulo.
--
-- Custo medido (Suzano, julho/2026): ~18ms, index-only scan em bot_conversations_lookup_idx.

CREATE OR REPLACE FUNCTION public.get_franchise_funnel_stats(
  p_franchise_id text,
  p_start date,
  p_end date
)
RETURNS TABLE (
  reached integer,
  converted integer,
  new_reached integer,
  new_converted integer,
  returning_reached integer,
  returning_converted integer,
  customers integer,
  repeat_customers integer,
  purchases_per_customer numeric,
  prev_reached integer,
  prev_converted integer,
  has_bot_data boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH bounds AS (
    SELECT
      p_start AS cur_start,
      p_end   AS cur_end,
      (p_start - (p_end - p_start + 1))::date AS prev_start,
      (p_start - 1)::date                     AS prev_end
  ),
  cur_reached AS (
    SELECT DISTINCT b.contact_phone AS phone
    FROM bot_conversations b, bounds bo
    WHERE b.franchise_id = p_franchise_id
      AND b.started_at >= (bo.cur_start::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND b.started_at <  ((bo.cur_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND b.contact_phone IS NOT NULL
      AND b.contact_phone <> ''
  ),
  cur_bought AS (
    SELECT s.contact_id, COUNT(*) AS n
    FROM sales s, bounds bo
    WHERE s.franchise_id = p_franchise_id
      AND s.sale_date BETWEEN bo.cur_start AND bo.cur_end
      AND s.contact_id IS NOT NULL
    GROUP BY s.contact_id
  ),
  cur_people AS (
    SELECT
      -- sem contato cadastrado = gente que chamou pela primeira vez e nunca comprou
      (c.id IS NULL
        OR (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (SELECT cur_start FROM bounds)) AS is_new,
      EXISTS (SELECT 1 FROM cur_bought cb WHERE cb.contact_id = c.id) AS did_buy
    FROM cur_reached r
    LEFT JOIN contacts c
      ON c.franchise_id = p_franchise_id
     AND c.telefone = r.phone
  ),
  prev_people AS (
    SELECT
      EXISTS (
        SELECT 1 FROM sales s2, bounds bo2
        WHERE s2.franchise_id = p_franchise_id
          AND s2.sale_date BETWEEN bo2.prev_start AND bo2.prev_end
          AND s2.contact_id = c2.id
      ) AS did_buy
    FROM (
      SELECT DISTINCT b.contact_phone AS phone
      FROM bot_conversations b, bounds bo
      WHERE b.franchise_id = p_franchise_id
        AND b.started_at >= (bo.prev_start::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND b.started_at <  ((bo.prev_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND b.contact_phone IS NOT NULL
        AND b.contact_phone <> ''
    ) pr
    LEFT JOIN contacts c2
      ON c2.franchise_id = p_franchise_id
     AND c2.telefone = pr.phone
  )
  SELECT
    COUNT(*)::int                                                          AS reached,
    COUNT(*) FILTER (WHERE cp.did_buy)::int                                AS converted,
    COUNT(*) FILTER (WHERE cp.is_new)::int                                 AS new_reached,
    COUNT(*) FILTER (WHERE cp.is_new AND cp.did_buy)::int                  AS new_converted,
    COUNT(*) FILTER (WHERE NOT cp.is_new)::int                             AS returning_reached,
    COUNT(*) FILTER (WHERE NOT cp.is_new AND cp.did_buy)::int              AS returning_converted,
    (SELECT COUNT(*)::int FROM cur_bought)                                 AS customers,
    (SELECT COUNT(*)::int FROM cur_bought WHERE n >= 2)                    AS repeat_customers,
    (SELECT ROUND(AVG(n), 2) FROM cur_bought)                              AS purchases_per_customer,
    (SELECT COUNT(*)::int FROM prev_people)                                AS prev_reached,
    (SELECT COUNT(*) FILTER (WHERE pp.did_buy)::int FROM prev_people pp)   AS prev_converted,
    (COUNT(*) >= 20)                                                       AS has_bot_data
  FROM cur_people cp
  HAVING p_franchise_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_franchise_funnel_stats(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_franchise_funnel_stats(text, date, date) TO authenticated;

COMMENT ON FUNCTION public.get_franchise_funnel_stats(text, date, date) IS
  'Funil da franquia no período: alcancados pelo robo x quantos compraram, novos x recorrentes, e recompra. SECURITY DEFINER + filtro obrigatorio por franchise_id. has_bot_data=false quando reached<20 (robo parado/inexistente).';


-- Benchmark anônimo da rede. Só agregado — nunca expõe franquia individual.
-- Roda em ~230ms (LATERAL por franquia força index-only scan; a versão sem LATERAL
-- fazia seq scan em 152k conversas e levava 2,5s). Por isso é RPC separada, chamada
-- só quando o franqueado ABRE o detalhe — o load do dashboard não paga esse custo.
-- Corte reached>=50 exclui franquias de teste e robôs parados, que puxariam a média.

CREATE OR REPLACE FUNCTION public.get_network_funnel_benchmark(
  p_start date,
  p_end date
)
RETURNS TABLE (
  network_conversion_pct numeric,
  network_purchases_per_customer numeric,
  franchises_counted integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH fr AS (
    SELECT DISTINCT evolution_instance_id AS fid
    FROM franchises
    WHERE status = 'active' AND evolution_instance_id IS NOT NULL
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
$$;

REVOKE ALL ON FUNCTION public.get_network_funnel_benchmark(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_funnel_benchmark(date, date) TO authenticated;

COMMENT ON FUNCTION public.get_network_funnel_benchmark(date, date) IS
  'Media anonima da rede (conversao e compras por cliente) para comparacao no detalhe do card. So agregado, nunca franquia individual. Considera apenas franquias com >=50 pessoas alcancadas no periodo.';
