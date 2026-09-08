CREATE OR REPLACE FUNCTION public.guard_marketing_payment_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or public.is_admin_or_manager() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'Pagamento de marketing entra como pendente; a confirmacao e da franqueadora'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Confirmar ou recusar pagamento de marketing e exclusivo da franqueadora'
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
$function$
;
