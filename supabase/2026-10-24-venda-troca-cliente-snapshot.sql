-- 24/10/2026: trocar a cliente de uma venda no app deixava o nome e o telefone da cliente ANTIGA na venda.
-- Caso real: Guarulhos, venda 87 (robô, Rosemeire) editada para a Maria Piedade em 23/10. A lista mostrava
-- "Maria Piedade" (cadastro), a busca e o aviso de venda repetida achavam "Rosemeire" (snapshot).
-- Causa: save_sale_with_items não manda customer_name/contact_phone, e este gatilho só preenchia o que
-- estava vazio. Agora, quando o contact_id muda, o que veio igual ao antigo é relido do cadastro novo
-- (o que o app mandou de propósito, como o endereço da entrega, fica).
-- ROLLBACK: node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/sales_fill_customer_snapshot.2026-10-24-antes.sql
create or replace function public.sales_fill_customer_snapshot()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if TG_OP = 'UPDATE' and NEW.contact_id is not null
     and NEW.contact_id is distinct from OLD.contact_id then
    if NEW.customer_name         is not distinct from OLD.customer_name         then NEW.customer_name := null;         end if;
    if NEW.contact_phone         is not distinct from OLD.contact_phone         then NEW.contact_phone := null;         end if;
    if NEW.customer_address      is not distinct from OLD.customer_address      then NEW.customer_address := null;      end if;
    if NEW.customer_neighborhood is not distinct from OLD.customer_neighborhood then NEW.customer_neighborhood := null; end if;
  end if;

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
