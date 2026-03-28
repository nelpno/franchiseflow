-- Fix: aggregate_daily_data agora subtrai discount_amount e soma delivery_fee
-- Antes: SUM(value) — ignorava desconto e frete
-- Depois: SUM(value - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0))

CREATE OR REPLACE FUNCTION public.aggregate_daily_data(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
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
    SELECT franchise_id, COUNT(*) as cnt, SUM(value - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0)) as total
    FROM sales WHERE sale_date = target_date GROUP BY franchise_id
  ) s ON s.franchise_id = f.evolution_instance_id
  WHERE f.status = 'active'
  ON CONFLICT (franchise_id, date) DO UPDATE SET
    unique_contacts = EXCLUDED.unique_contacts,
    sales_count = EXCLUDED.sales_count,
    sales_value = EXCLUDED.sales_value,
    conversion_rate = EXCLUDED.conversion_rate,
    updated_at = now();
$$ LANGUAGE sql;

-- Reagregar os últimos 30 dias para corrigir dados históricos
DO $$
DECLARE
  d DATE;
BEGIN
  FOR d IN SELECT generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day'::interval)::date
  LOOP
    PERFORM aggregate_daily_data(d);
  END LOOP;
END $$;
