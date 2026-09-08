-- 2026-09-08 — marcar no dashboard qual campanha ja foi subida no Meta
--
-- POR QUE
-- "Confirmar o pagamento" e "subir a campanha no Meta" viraram dois momentos diferentes, e o
-- banco so tinha um campo para os dois. A skill subir-orcamento-meta-mensal documenta
-- `pending` = ainda nao subiu / `confirmed` = ja subiu — e a tela do dashboard usa o MESMO
-- campo com outro sentido: `confirmed` = recebi o pagamento.
--
-- Enquanto as duas coisas andavam juntas ninguem via o conflito. Hoje nao andam. Medido em
-- 08/09/2026, olhando quantas confirmacoes caem no MESMO minuto que outra (assinatura de
-- confirmacao em lote — subir campanha no Meta nao leva segundos):
--
--   julho    21 de 48
--   agosto   31 de 54
--   setembro 39 de 55
--
-- Ou seja, `confirmed` hoje significa "recebi o pagamento". Setembro fechou com 55
-- confirmados e ZERO pendentes: pela leitura da skill, tudo ja teria subido — e nao e o caso.
-- Sem um segundo marcador, depois de confirmar todas ficam iguais e nao da para saber quem
-- falta subir.
--
-- O QUE MUDA
-- Duas colunas em marketing_payments. Nenhuma tabela nova, nenhum valor a digitar: o quanto
-- subir ja esta na coluna "Campanha" da tela (o liquido). O que faltava era so o "ja fiz".
--
--   campaign_raised_at  timestamptz  quando a campanha foi subida no Meta (null = falta subir)
--   campaign_raised_by  uuid         quem marcou
--
-- E o guard ganha as duas colunas: marcar campanha como subida e da franqueadora, igual a
-- confirmar pagamento. Sem isso o franqueado poderia marcar (o guard so protege status,
-- amount, franchise_id e reference_month, e deixa passar coluna nova).
--
-- NAO retroage: todo pagamento existente nasce com campaign_raised_at nulo, ou seja "falta
-- subir". Para setembro isso e verdade util (a fila reaparece); para meses fechados o Nelson
-- pode ignorar, porque a tela so mostra a fila do mes selecionado.
--
-- ROLLBACK
--   alter table public.marketing_payments
--     drop column if exists campaign_raised_at,
--     drop column if exists campaign_raised_by;
--   e reaplicar o guard sem as duas colunas (versao anterior em
--   docs/db-backups/guard_marketing_payment_approval.antes-2026-09-08.sql).

alter table public.marketing_payments
  add column if not exists campaign_raised_at timestamptz,
  add column if not exists campaign_raised_by uuid references auth.users(id) on delete set null;

comment on column public.marketing_payments.campaign_raised_at is
  'Quando o orcamento foi subido na campanha do Meta. NULL = pago mas ainda nao subido. Nao confundir com status=confirmed, que e o recebimento do pagamento.';

-- a fila do mes ("pago e falta subir") e a leitura mais frequente da tela
create index if not exists idx_mkt_pay_falta_subir
  on public.marketing_payments (reference_month)
  where status = 'confirmed' and campaign_raised_at is null;

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
     or new.reference_month is distinct from old.reference_month then
    raise exception 'Valor, unidade e mes de referencia nao podem ser alterados apos o registro'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
