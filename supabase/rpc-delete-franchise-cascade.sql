-- RPC: Atomic franchise deletion cascade
-- Replaces client-side multi-step deletion in src/entities/all.js
-- PL/pgSQL runs in implicit transaction = ROLLBACK on any failure
-- SECURITY DEFINER with is_admin() guard (P1 fix from Codex review)
CREATE OR REPLACE FUNCTION delete_franchise_cascade(
  p_franchise_id UUID,
  p_evolution_instance_id TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_ids UUID[];
  v_order_ids UUID[];
  v_user RECORD;
  v_remaining TEXT[];
BEGIN
  -- Admin-only guard: SECURITY DEFINER bypasses RLS, so enforce manually
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir franquias';
  END IF;

  -- Collect IDs for deep FK cleanup
  SELECT ARRAY_AGG(id) INTO v_sale_ids FROM sales WHERE franchise_id = p_evolution_instance_id;
  SELECT ARRAY_AGG(id) INTO v_order_ids FROM purchase_orders WHERE franchise_id = p_evolution_instance_id;

  -- Child items first
  IF v_sale_ids IS NOT NULL THEN
    DELETE FROM sale_items WHERE sale_id = ANY(v_sale_ids);
  END IF;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM purchase_order_items WHERE order_id = ANY(v_order_ids);
  END IF;

  -- Operational tables (all use evolution_instance_id)
  DELETE FROM contacts WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM sales WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM purchase_orders WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM expenses WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM daily_unique_contacts WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM daily_checklists WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM inventory_items WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM onboarding_checklists WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM daily_summaries WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM marketing_files WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM audit_logs WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM sales_goals WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM marketing_payments WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM marketing_meta_deposits WHERE franchise_id = p_evolution_instance_id;
  DELETE FROM franchise_configurations WHERE franchise_evolution_instance_id = p_evolution_instance_id;
  DELETE FROM franchise_invites WHERE franchise_id = p_evolution_instance_id;

  -- Linked franchisees
  FOR v_user IN
    SELECT id, managed_franchise_ids, role FROM profiles
    WHERE managed_franchise_ids @> ARRAY[p_franchise_id::TEXT]
       OR managed_franchise_ids @> ARRAY[p_evolution_instance_id]
  LOOP
    IF v_user.role = 'franchisee' THEN
      SELECT ARRAY(
        SELECT unnest(v_user.managed_franchise_ids)
        EXCEPT SELECT p_franchise_id::TEXT
        EXCEPT SELECT p_evolution_instance_id
      ) INTO v_remaining;

      IF array_length(v_remaining, 1) IS NULL OR array_length(v_remaining, 1) = 0 THEN
        PERFORM delete_user_complete(v_user.id);
      ELSE
        UPDATE profiles SET managed_franchise_ids = v_remaining WHERE id = v_user.id;
      END IF;
    END IF;
  END LOOP;

  -- Finally delete the franchise record
  DELETE FROM franchises WHERE id = p_franchise_id;
END;
$$;
