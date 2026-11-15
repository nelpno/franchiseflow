-- 2026-09-28 · pendência da S5.5: a despesa automática da mensalidade (ASAAS PAID) passa a se chamar
-- "Mensalidade Equipe Digital Maxi" (fornecedor "Maxi Massas (Equipe Digital Maxi)"), como todas as telas
-- desde 1c4076f. Só texto das despesas NOVAS: a idempotência é por source_id/expense_date, não pela
-- descrição; as 252 despesas antigas continuam com o nome antigo (histórico).
-- Gerado a partir do corpo LIVE (md5 antes = 6463ab2c1ed6d7202b677f09040c7902).
-- ROLLBACK: aplicar docs/db-backups/generate_expense_from_subscription_payment.2026-09-28-antes.sql

CREATE OR REPLACE FUNCTION public.generate_expense_from_subscription_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_due_date DATE;
BEGIN
  -- Edge function asaas-billing normaliza status para 'PAID'.
  -- Idempotência: só gera expense se este payment_id ainda não foi processado.
  -- Não dependemos de transição OLD→NEW: ASAAS pode trocar current_payment_id
  -- mantendo current_payment_status='PAID' no rollover mensal.
  IF NEW.current_payment_status = 'PAID'
     AND NEW.current_payment_id IS NOT NULL
     AND NEW.last_paid_payment_id IS DISTINCT FROM NEW.current_payment_id THEN

    v_due_date := COALESCE(NEW.current_payment_due_date, CURRENT_DATE);

    INSERT INTO public.expenses (
      franchise_id, category, supplier, description,
      amount, expense_date, source, source_id, created_by
    ) VALUES (
      NEW.franchise_id,
      'pacote_sistema',
      'Maxi Massas (Equipe Digital Maxi)',
      'Mensalidade Equipe Digital Maxi - vencimento ' || to_char(v_due_date, 'DD/MM/YYYY'),
      COALESCE(NEW.current_payment_value, 150),
      v_due_date,
      'asaas_subscription',
      NEW.id,
      NULL  -- ASAAS é automatizado, não tem usuário criador
    )
    ON CONFLICT (source_id, expense_date) WHERE source = 'asaas_subscription' DO NOTHING;

    -- Marca como gerado (idempotência forward)
    NEW.last_paid_payment_id := NEW.current_payment_id;
  END IF;

  RETURN NEW;
END;
$function$
;
