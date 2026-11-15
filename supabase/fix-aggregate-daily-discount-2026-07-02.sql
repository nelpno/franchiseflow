-- =====================================================================
-- Fase 1 — aggregate_daily_data: subtrair desconto + data BRT correta
-- =====================================================================
-- Auditoria 2026-07-02 confirmou no banco VIVO que a versão ativa somava
-- `value + delivery_fee` SEM subtrair `discount_amount` → daily_summaries.sales_value
-- inflado pelos descontos, o que infla a META DIÁRIA (média 30d + 10%).
-- Também: `(CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::DATE - 1 day` é no-op;
-- correto é `(now() AT TIME ZONE 'America/Sao_Paulo')::date - 1` (BRT real).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.aggregate_daily_data(p_target_date date DEFAULT NULL::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_date DATE;
BEGIN
  IF p_target_date IS NULL THEN
    target_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;  -- ontem, BRT
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
    SELECT franchise_id, COUNT(DISTINCT contact_phone) AS cnt
    FROM daily_unique_contacts WHERE date = target_date GROUP BY franchise_id
  ) c ON c.franchise_id = f.evolution_instance_id
  LEFT JOIN (
    SELECT franchise_id, COUNT(*) AS cnt,
           -- Fórmula canônica do projeto: value - discount + delivery_fee
           SUM(value - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0)) AS total
    FROM sales WHERE sale_date = target_date GROUP BY franchise_id
  ) s ON s.franchise_id = f.evolution_instance_id
  WHERE f.status = 'active'
  ON CONFLICT (franchise_id, date) DO UPDATE SET
    unique_contacts = EXCLUDED.unique_contacts,
    sales_count     = EXCLUDED.sales_count,
    sales_value     = EXCLUDED.sales_value,
    conversion_rate = EXCLUDED.conversion_rate,
    updated_at      = now();
END;
$function$;

-- Backfill 90 dias: corrige APENAS sales_value (o que estava errado).
-- NÃO reprocessa via aggregate_daily_data pra não zerar unique_contacts se
-- daily_unique_contacts não retiver 90 dias de histórico.
UPDATE daily_summaries ds
SET sales_value = sub.total, updated_at = now()
FROM (
  SELECT franchise_id, sale_date,
         SUM(value - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0)) AS total
  FROM sales
  WHERE sale_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 90
  GROUP BY franchise_id, sale_date
) sub
WHERE ds.franchise_id = sub.franchise_id
  AND ds.date = sub.sale_date
  AND ds.sales_value IS DISTINCT FROM sub.total;
