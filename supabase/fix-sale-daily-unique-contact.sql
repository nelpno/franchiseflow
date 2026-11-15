-- Fix: Venda com contact_id também registra em daily_unique_contacts
-- Motivo: conversão no dashboard precisa incluir contatos manuais (não só bot)
-- O trigger on_sale_created já existe — vamos estender update_contact_on_sale()

CREATE OR REPLACE FUNCTION update_contact_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
  v_name TEXT;
BEGIN
  -- Atualizar status/compras do contato (lógica original)
  UPDATE contacts SET
    status = CASE
      WHEN purchase_count >= 2 THEN 'recorrente'
      ELSE 'cliente'
    END,
    purchase_count = purchase_count + 1,
    total_spent = total_spent + COALESCE(NEW.value, 0),
    last_purchase_at = COALESCE(NEW.sale_date::TIMESTAMPTZ, now()),
    updated_at = now()
  WHERE id = NEW.contact_id;

  -- Registrar contato em daily_unique_contacts para métrica de conversão
  SELECT telefone, nome INTO v_phone, v_name
  FROM contacts WHERE id = NEW.contact_id;

  IF v_phone IS NOT NULL THEN
    INSERT INTO daily_unique_contacts (franchise_id, date, contact_phone, contact_name)
    VALUES (
      NEW.franchise_id,
      COALESCE(NEW.sale_date, CURRENT_DATE),
      v_phone,
      v_name
    )
    ON CONFLICT (franchise_id, date, contact_phone) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
