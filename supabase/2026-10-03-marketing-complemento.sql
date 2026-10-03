-- Verba de marketing: valor ADICIONAL no mesmo mês (03/10/2026).
-- Caso real: Tatuapé pagou R$ 500 de outubro e manda mais R$ 200 (Ribeirão Preto teve o mesmo em 01/10).
--
-- Modelo: a mesma tabela, com kind = 'mensal' (o de sempre, um por mês) ou 'complemento' (quantos
-- precisar). Cada complemento é uma linha própria: confirma, gera despesa e sobe campanha sozinho.
-- Os relatórios que somam por reference_month já incluem o complemento sem mudança.
--
-- ROLLBACK (só depois de apagar os complementos: delete from marketing_payments where kind='complemento'):
--   drop index if exists public.marketing_payments_mensal_unico;
--   alter table public.marketing_payments drop constraint if exists marketing_payments_amount_check;
--   alter table public.marketing_payments add constraint marketing_payments_amount_check check (amount >= 200);
--   alter table public.marketing_payments add constraint marketing_payments_franchise_id_reference_month_key unique (franchise_id, reference_month);
--   alter table public.marketing_payments drop column kind;
--   + reaplicar docs/db-backups/guard_marketing_payment_approval.2026-10-03-antes.sql
--   + reaplicar docs/db-backups/generate_expense_from_marketing_payment.2026-10-03-antes.sql

alter table public.marketing_payments
  add column if not exists kind text not null default 'mensal'
  check (kind in ('mensal', 'complemento'));

-- Um MENSAL por unidade e mês continua garantido; complemento fica livre.
alter table public.marketing_payments drop constraint if exists marketing_payments_franchise_id_reference_month_key;
create unique index if not exists marketing_payments_mensal_unico
  on public.marketing_payments (franchise_id, reference_month) where kind = 'mensal';

-- Mínimo de R$ 200 vale para o mensal; o complemento só precisa ser positivo.
alter table public.marketing_payments drop constraint if exists marketing_payments_amount_check;
alter table public.marketing_payments add constraint marketing_payments_amount_check
  check (amount > 0 and (kind = 'complemento' or amount >= 200));

-- Guard: a franqueada também não troca o tipo depois do registro.
create or replace function public.guard_marketing_payment_approval()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null or public.is_admin_or_manager() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'Pagamento de marketing entra como pendente; a confirmacao e da franqueadora'
        using errcode = '42501';
    end if;
    if new.campaign_raised_at is not null or new.campaign_raised_by is not null then
      raise exception 'Marcar campanha como subida e exclusivo da franqueadora'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Confirmar ou recusar pagamento de marketing e exclusivo da franqueadora'
      using errcode = '42501';
  end if;

  if new.campaign_raised_at is distinct from old.campaign_raised_at
     or new.campaign_raised_by is distinct from old.campaign_raised_by then
    raise exception 'Marcar campanha como subida e exclusivo da franqueadora'
      using errcode = '42501';
  end if;

  if new.amount is distinct from old.amount
     or new.franchise_id is distinct from old.franchise_id
     or new.reference_month is distinct from old.reference_month
     or new.kind is distinct from old.kind then
    raise exception 'Valor, unidade e mes de referencia nao podem ser alterados apos o registro'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- Despesa: o "já existe" por valor no mês só olha despesa lançada À MÃO (source_id nulo).
-- Sem isto, um complemento com o MESMO valor do mensal (500 + 500) casava com a despesa do
-- mensal e ficava sem despesa no DRE.
create or replace function public.generate_expense_from_marketing_payment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
         -- 03/10/2026: so a despesa A MAO (source_id nulo) — a gerada pelo mensal nao pode
         -- "cobrir" um complemento de mesmo valor.
         OR (e.source_id IS NULL
             AND e.franchise_id = NEW.franchise_id
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
        CASE WHEN NEW.kind = 'complemento' THEN 'Marketing (adicional) - ' ELSE 'Marketing - ' END
          || COALESCE(NEW.reference_month, 'mes nao informado'),
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
$function$;
