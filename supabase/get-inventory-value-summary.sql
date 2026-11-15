-- RPC: get_inventory_value_summary
-- Retorna agregado financeiro do estoque ativo de uma franquia.
-- Usado pelo Card "Em Estoque" do TabResultado novo.

CREATE OR REPLACE FUNCTION public.get_inventory_value_summary(p_franchise_id TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER  -- usa RLS do user
SET search_path = 'public'
AS $$
  SELECT json_build_object(
    'custo_total', COALESCE(SUM(quantity * COALESCE(cost_price, 0)), 0),
    'venda_potencial', COALESCE(SUM(quantity * COALESCE(sale_price, 0)), 0),
    'qtd_produtos_ativos', COUNT(*),
    'markup_medio_pct', CASE
      WHEN SUM(quantity * COALESCE(cost_price, 0)) > 0 THEN
        ROUND(((SUM(quantity * COALESCE(sale_price, 0))
              - SUM(quantity * COALESCE(cost_price, 0)))
              / SUM(quantity * COALESCE(cost_price, 0))) * 100, 1)
      ELSE 0
    END
  )
  FROM public.inventory_items
  WHERE franchise_id = p_franchise_id
    AND active = true
    AND quantity > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_value_summary(TEXT) TO authenticated;
