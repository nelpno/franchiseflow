-- Fix: aggregate_daily_data duplicada causando falha no pg_cron desde 25/mar/2026
-- Erro: "function aggregate_daily_data() is not unique"
-- Duas versões existiam: uma com param DEFAULT, outra sem params
-- Solução: dropar ambas, criar versão única com param opcional

DROP FUNCTION IF EXISTS aggregate_daily_data(date);
DROP FUNCTION IF EXISTS aggregate_daily_data();

CREATE OR REPLACE FUNCTION aggregate_daily_data(p_target_date DATE DEFAULT NULL)
RETURNS void AS $fn$
DECLARE
  target_date DATE;
BEGIN
  -- Se não passou data, usa "ontem" no fuso BR
  IF p_target_date IS NULL THEN
    target_date := (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::DATE - INTERVAL '1 day';
  ELSE
    target_date := p_target_date;
  END IF;

  INSERT INTO daily_summaries (franchise_id, date, unique_contacts, sales_count, sales_value, conversion_rate)
  SELECT
    f.evolution_instance_id,
    target_date,
    COALESCE(c.cnt, 0),
    COALESCE(s.cnt, 0),
    COALESCE(s.total, 0),
    CASE WHEN COALESCE(c.cnt, 0) > 0
      THEN ROUND((COALESCE(s.cnt, 0)::NUMERIC / c.cnt) * 100, 2)
      ELSE 0
    END
  FROM franchises f
  LEFT JOIN (
    SELECT franchise_id, COUNT(DISTINCT contact_phone) as cnt
    FROM daily_unique_contacts WHERE date = target_date GROUP BY franchise_id
  ) c ON c.franchise_id = f.evolution_instance_id
  LEFT JOIN (
    SELECT franchise_id, COUNT(*) as cnt, SUM(value + COALESCE(delivery_fee, 0)) as total
    FROM sales WHERE sale_date = target_date GROUP BY franchise_id
  ) s ON s.franchise_id = f.evolution_instance_id
  WHERE f.status = 'active'
  ON CONFLICT (franchise_id, date) DO UPDATE SET
    unique_contacts = EXCLUDED.unique_contacts,
    sales_count = EXCLUDED.sales_count,
    sales_value = EXCLUDED.sales_value,
    conversion_rate = EXCLUDED.conversion_rate,
    updated_at = now();
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron schedule (já existente, job 1): 0 5 * * * → SELECT aggregate_daily_data()
-- Backfill manual (se necessário):
-- SELECT aggregate_daily_data('2026-03-28'::date);
