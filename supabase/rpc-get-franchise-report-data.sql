
CREATE OR REPLACE FUNCTION get_franchise_report_data(
  p_franchise_id TEXT,
  p_start_date DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $fn$
DECLARE
  result JSON;
BEGIN
  -- Security: caller must own this franchise or be admin/manager
  IF NOT (
    is_admin_or_manager()
    OR p_franchise_id = ANY(managed_franchise_ids())
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'botConversations', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, outcome, quality_score, started_at, llm_abandon_reason, topics, status
        FROM bot_conversations WHERE franchise_id = p_franchise_id AND started_at >= p_start_date
      ) t
    ), '[]'::json),
    
    'humanMessages', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, conversation_id FROM conversation_messages 
        WHERE franchise_id = p_franchise_id AND direction = 'human' AND created_at >= p_start_date
      ) t
    ), '[]'::json),
    
    'botSales', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, value, delivery_fee, sale_date, contact_id FROM sales 
        WHERE franchise_id = p_franchise_id AND source = 'bot' 
        AND sale_date >= p_start_date AND sale_date <= p_end_date
      ) t
    ), '[]'::json),
    
    'manualSales', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, value, delivery_fee FROM sales 
        WHERE franchise_id = p_franchise_id AND source != 'bot'
        AND sale_date >= p_start_date AND sale_date <= p_end_date
      ) t
    ), '[]'::json),
    
    'inventory', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, product_name, quantity, cost_price, sale_price 
        FROM inventory_items WHERE franchise_id = p_franchise_id
      ) t
    ), '[]'::json),
    
    'contacts', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, status, created_at, updated_at, purchase_count, source 
        FROM contacts WHERE franchise_id = p_franchise_id LIMIT 500
      ) t
    ), '[]'::json),
    
    'purchaseOrders', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, status, ordered_at, delivered_at, created_at 
        FROM purchase_orders WHERE franchise_id = p_franchise_id 
        AND created_at >= p_start_date LIMIT 100
      ) t
    ), '[]'::json),
    
    'expenses', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT amount FROM expenses 
        WHERE franchise_id = p_franchise_id AND expense_date >= p_start_date
      ) t
    ), '[]'::json),
    
    'previousReport', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, report_text, metrics, autonomy_rate, profile_tier, report_period_end
        FROM bot_reports WHERE franchise_id = p_franchise_id 
        ORDER BY report_period_end DESC LIMIT 1
      ) t
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$fn$;
