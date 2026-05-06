-- Ranking mensal entre franquias para card de competição no FranchiseeDashboard.
-- Retorna posição da franquia, total de franquias com vendas no mês, receita do mês
-- e posição no mês anterior (para delta "subiu/caiu").
--
-- Receita = value - discount_amount + delivery_fee (mesma fórmula do frontend
-- getSaleNetValue em src/lib/financialCalcs.js).
--
-- SECURITY DEFINER bypassa RLS de sales — por isso o filtro
-- WHERE p_franchise_id IS NOT NULL AND r.franchise_id = p_franchise_id
-- é OBRIGATÓRIO. Sem p_franchise_id, retorna 0 rows (não vaza dados).

CREATE OR REPLACE FUNCTION public.get_franchise_ranking_monthly(
  p_year_month text,
  p_franchise_id text DEFAULT NULL
)
RETURNS TABLE (
  rank_position integer,
  total_franchises integer,
  revenue_month numeric,
  prev_rank_position integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH bounds AS (
    SELECT
      to_date(p_year_month || '-01', 'YYYY-MM-DD') AS m_start,
      (to_date(p_year_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date AS m_end,
      (to_date(p_year_month || '-01', 'YYYY-MM-DD') - interval '1 month')::date AS prev_start,
      (to_date(p_year_month || '-01', 'YYYY-MM-DD') - interval '1 day')::date AS prev_end
  ),
  per_franchise AS (
    SELECT
      s.franchise_id,
      SUM(COALESCE(s.value, 0) - COALESCE(s.discount_amount, 0) + COALESCE(s.delivery_fee, 0)) AS revenue
    FROM sales s, bounds b
    WHERE s.sale_date BETWEEN b.m_start AND b.m_end
    GROUP BY s.franchise_id
  ),
  ranked AS (
    SELECT
      franchise_id,
      revenue,
      RANK() OVER (ORDER BY revenue DESC) AS rk
    FROM per_franchise
  ),
  prev_per AS (
    SELECT
      s.franchise_id,
      SUM(COALESCE(s.value, 0) - COALESCE(s.discount_amount, 0) + COALESCE(s.delivery_fee, 0)) AS revenue
    FROM sales s, bounds b
    WHERE s.sale_date BETWEEN b.prev_start AND b.prev_end
    GROUP BY s.franchise_id
  ),
  prev_ranked AS (
    SELECT
      franchise_id,
      RANK() OVER (ORDER BY revenue DESC) AS rk
    FROM prev_per
  )
  SELECT
    r.rk::int AS rank_position,
    (SELECT COUNT(*)::int FROM ranked) AS total_franchises,
    r.revenue AS revenue_month,
    pr.rk::int AS prev_rank_position
  FROM ranked r
  LEFT JOIN prev_ranked pr USING (franchise_id)
  WHERE p_franchise_id IS NOT NULL
    AND r.franchise_id = p_franchise_id;
$$;

REVOKE ALL ON FUNCTION public.get_franchise_ranking_monthly(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_franchise_ranking_monthly(text, text) TO authenticated;

COMMENT ON FUNCTION public.get_franchise_ranking_monthly(text, text) IS
  'Ranking mensal entre franquias. Recebe YYYY-MM e franchise_id (evolution_instance_id). SECURITY DEFINER + filtro obrigatório por franchise_id.';
