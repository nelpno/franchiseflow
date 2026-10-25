-- Corpo vivo antes de supabase/2026-10-24-venda-troca-cliente-snapshot.sql. Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.sales_fill_customer_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.contact_id is not null
     and (NEW.customer_name is null
          or NEW.contact_phone is null
          or NEW.customer_address is null
          or NEW.customer_neighborhood is null) then
    select coalesce(NEW.customer_name,         nome),
           coalesce(NEW.contact_phone,         telefone),
           coalesce(NEW.customer_address,      endereco),
           coalesce(NEW.customer_neighborhood, bairro)
      into NEW.customer_name, NEW.contact_phone,
           NEW.customer_address, NEW.customer_neighborhood
    from public.contacts
    where id = NEW.contact_id;
  end if;
  return NEW;
end;
$function$;
