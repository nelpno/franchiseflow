-- Retorna catálogo de produtos padrão da rede (cross-franchise)
-- Usado pelo autocomplete no TabEstoque para franqueados re-adicionarem itens padrão
-- SECURITY DEFINER bypassa RLS para agregar entre franquias

CREATE OR REPLACE FUNCTION get_standard_product_catalog()
RETURNS TABLE(product_name text, category text, unit text, cost_price numeric, sale_price numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT ON (ii.product_name)
    ii.product_name, ii.category, ii.unit, ii.cost_price, ii.sale_price
  FROM inventory_items ii
  WHERE ii.created_by_franchisee = false
    AND ii.active IS DISTINCT FROM false
  ORDER BY ii.product_name, ii.updated_at DESC NULLS LAST;
$$;
