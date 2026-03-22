-- Função para adicionar um produto padrão a TODAS as franquias existentes
-- Uso: SELECT add_default_product('Nhoque Quatro Queijos', 'massas', 'un', 12.50, 5);

CREATE OR REPLACE FUNCTION add_default_product(
  p_name text,
  p_category text,
  p_unit text DEFAULT 'un',
  p_cost_price numeric DEFAULT 0,
  p_min_stock integer DEFAULT 5
)
RETURNS integer -- retorna quantidade de franquias atualizadas
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_evo_id text;
BEGIN
  -- Insere em todas as franquias que já possuem estoque
  FOR v_evo_id IN
    SELECT DISTINCT franchise_id FROM inventory_items
  LOOP
    -- ON CONFLICT evita duplicatas (mesmo nome + mesma franquia)
    INSERT INTO inventory_items (franchise_id, name, category, unit, cost_price, sale_price, min_stock, quantity)
    VALUES (v_evo_id, p_name, p_category, p_unit, p_cost_price, p_cost_price * 2, p_min_stock, 0)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
