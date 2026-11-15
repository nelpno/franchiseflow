CREATE OR REPLACE FUNCTION public.generate_expense_from_marketing_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expense_date DATE;
  v_ja_existe    BOOLEAN;
BEGIN
  IF NEW.status = 'confirmed'
     AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN

    BEGIN
      v_expense_date := (NEW.reference_month || '-01')::date;
    EXCEPTION WHEN OTHERS THEN
      v_expense_date := NULL;
    END;

    v_expense_date := COALESCE(v_expense_date, NEW.updated_at::date, CURRENT_DATE);

    -- A guarda e a EXISTENCIA da despesa, NAO o carimbo expense_generated_at.
    -- Antes (ate 19/08/2026) a condicao era "NEW.expense_generated_at IS NULL": quando o UPDATE
    -- que confirma o pagamento setava o carimbo no MESMO statement, o INSERT era barrado e o
    -- pagamento ficava marcado como processado sem despesa nenhuma. Como o carimbo era a propria
    -- condicao, reconfirmar nunca consertava. 3 casos na base.
    SELECT EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.source_id = NEW.id
         -- reconhece TAMBEM a despesa lancada A MAO (source_id nulo, descricao livre como
         -- "Marketing" ou "TRAFEGO PAGO"): mesma franquia, categoria marketing, mesmo valor,
         -- dentro do mes de referencia. Sem isto, reconfirmar um pagamento ja compensado a mao
         -- duplicaria o gasto no DRE da franqueada (Campo Limpo ago/26, Santos abr/26).
         OR (e.franchise_id = NEW.franchise_id
             AND e.category = 'marketing'
             AND e.amount   = NEW.amount
             AND e.expense_date >= date_trunc('month', v_expense_date)::date
             AND e.expense_date <  (date_trunc('month', v_expense_date) + interval '1 month')::date)
    ) INTO v_ja_existe;

    IF NOT v_ja_existe THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id, 'marketing', 'Maxi Massas Marketing',
        'Marketing - ' || COALESCE(NEW.reference_month, 'mes nao informado'),
        NEW.amount, v_expense_date,
        'marketing_payment', NEW.id, NEW.created_by
      );
    END IF;

    -- carimbo passa a significar "passou pelo processamento", nao "eu inseri":
    -- preserva o valor antigo se ja houver, e nunca mais governa a decisao de inserir.
    NEW.expense_generated_at := COALESCE(NEW.expense_generated_at, NOW());
  END IF;

  RETURN NEW;
END;
$function$
;
