-- 1. Audit trigger: log who deleted a sale
CREATE OR REPLACE FUNCTION audit_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, franchise_id, action, entity_type, entity_id, details)
  SELECT
    auth.uid(),
    COALESCE(p.full_name, 'unknown'),
    OLD.franchise_id,
    'delete',
    'sale',
    OLD.id,
    jsonb_build_object(
      'value', OLD.value,
      'source', OLD.source,
      'sale_date', OLD.sale_date,
      'payment_method', OLD.payment_method,
      'contact_id', OLD.contact_id,
      'net_value', OLD.net_value
    )
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Fallback for service_role / no auth context
  IF NOT FOUND THEN
    INSERT INTO audit_logs (franchise_id, action, entity_type, entity_id, details)
    VALUES (
      OLD.franchise_id,
      'delete',
      'sale',
      OLD.id,
      jsonb_build_object(
        'value', OLD.value,
        'source', OLD.source,
        'sale_date', OLD.sale_date,
        'payment_method', OLD.payment_method,
        'contact_id', OLD.contact_id,
        'net_value', OLD.net_value
      )
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_on_sale_delete
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION audit_sale_delete();

-- 2. Revert contact counts on sale delete
CREATE OR REPLACE FUNCTION revert_contact_on_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.contact_id IS NOT NULL THEN
    UPDATE contacts SET
      purchase_count = GREATEST(purchase_count - 1, 0),
      total_spent = GREATEST(total_spent - COALESCE(OLD.value, 0), 0),
      updated_at = now()
    WHERE id = OLD.contact_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER revert_contact_on_sale_delete
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION revert_contact_on_sale_delete();
