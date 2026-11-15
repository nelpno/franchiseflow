-- Corpo LIVE em 28/09/2026 antes da troca de nome (md5(prosrc)=6463ab2c1ed6d7202b677f09040c7902). Voltar = aplicar este arquivo.

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
      'Maxi Massas (Pacote Tecnologia)',
      'Pacote Tecnologia + Marketing - vencimento ' || to_char(v_due_date, 'DD/MM/YYYY'),
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
