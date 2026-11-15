-- Ranking de funil por franquia (conversão + recompra) para o painel ADMIN.
-- Irmã de get-franchise-funnel-stats.sql (que é a versão franchisee-scoped).
--
-- Guard is_cs_or_admin() com RAISE (padrão get-bot-conversation-summary.sql), não o
-- filtro-por-id: aqui o objetivo É ver a rede inteira. Usa is_cs_or_admin (e NÃO
-- is_admin_or_manager) porque o Celso é `customer_success` e precisa ver o funil no
-- Mural — é o mesmo helper que as demais RPCs do cockpit de CS já usam.
-- Testar via MCP exige simular o papel — service_role tem auth.uid() nulo e cai no 42501:
--   select set_config('request.jwt.claims', json_build_object('sub','<uuid admin>')::text, true);
--
-- `bot_share_pct` = converted/customers: quanto das vendas veio de quem passou pelo robô.
-- Sem essa coluna a leitura engana — Vila Maria converte 12,4% mas tem 149 clientes contra
-- 53 convertidos, ou seja a maior parte do negócio dela não passa pelo robô e a taxa
-- sozinha faria parecer que está mal.
--
-- Custo ~230ms: o CROSS JOIN LATERAL por franquia força index-only scan em
-- bot_conversations_lookup_idx. A versão sem LATERAL fazia seq scan em 152k linhas (2,5s).
-- Por isso é lazy-load (CollapsibleSection), nunca no load do AdminDashboard.

CREATE OR REPLACE FUNCTION public.get_network_funnel_ranking(
  p_start date,
  p_end date
)
RETURNS TABLE (
  franchise_id text,
  franchise_name text,
  reached integer,
  converted integer,
  conversion_pct numeric,
  customers integer,
  repeat_customers integer,
  purchases_per_customer numeric,
  bot_share_pct numeric,
  has_bot_data boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT is_cs_or_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH fr AS (
    SELECT DISTINCT f.evolution_instance_id AS fid, f.name AS fname
    FROM franchises f
    WHERE f.status = 'active' AND f.evolution_instance_id IS NOT NULL
  ),
  per AS (
    SELECT fr.fid, fr.fname, x.reached AS rc, x.converted AS cv,
           y.customers AS cu, y.purchases AS pu, y.repeats AS rp
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
      SELECT COUNT(*) AS customers,
             COALESCE(SUM(q.n), 0) AS purchases,
             COUNT(*) FILTER (WHERE q.n >= 2) AS repeats
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
    per.fid,
    per.fname,
    per.rc::int,
    per.cv::int,
    ROUND(100.0 * per.cv / NULLIF(per.rc, 0), 1),
    per.cu::int,
    per.rp::int,
    ROUND(per.pu::numeric / NULLIF(per.cu, 0), 2),
    ROUND(100.0 * per.cv / NULLIF(per.cu, 0), 1),
    (per.rc >= 20)
  FROM per
  WHERE per.rc > 0 OR per.cu > 0
  ORDER BY (per.rc >= 20) DESC, ROUND(100.0 * per.cv / NULLIF(per.rc, 0), 1) ASC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_network_funnel_ranking(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_funnel_ranking(date, date) TO authenticated;

COMMENT ON FUNCTION public.get_network_funnel_ranking(date, date) IS
  'Ranking de funil por franquia (conversao + recompra) para admin E customer_success. Guard is_cs_or_admin. bot_share_pct = quanto das vendas veio de quem passou pelo robo.';
