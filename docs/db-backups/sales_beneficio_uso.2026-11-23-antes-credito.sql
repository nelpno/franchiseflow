CREATE OR REPLACE FUNCTION public.sales_beneficio_uso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_canal text;
begin
  if tg_op = 'DELETE' then
    update beneficio_usos set venda_apagada_em = now() where sale_id = old.id and venda_apagada_em is null;
    return old;
  end if;
  if new.desconto_origem is null or coalesce(new.discount_amount, 0) <= 0 then
    delete from beneficio_usos where sale_id = new.id;
    return new;
  end if;
  v_canal := case when new.source = 'bot' then
               case when exists (select 1 from conversation_messages m
                                  where m.franchise_id = new.franchise_id and m.direction = 'in'
                                    and m.created_at between new.created_at - interval '24 hours' and new.created_at
                                    and public.normalize_phone_key(m.contact_phone) = public.normalize_phone_key(new.contact_phone)
                                    and m.content like '%#PED-%') then 'cardapio' else 'conversa' end
             else 'manual' end;
  insert into beneficio_usos (franchise_id, tipo, codigo, sale_id, telefone, valor, canal, criado_em)
  values (new.franchise_id, new.desconto_origem, new.desconto_codigo, new.id, public.normalize_phone_br(new.contact_phone),
          new.discount_amount, v_canal, coalesce(new.created_at, now()))
  on conflict (sale_id) do update set tipo = excluded.tipo, codigo = excluded.codigo, valor = excluded.valor, telefone = excluded.telefone;
  return new;
end;
$function$
;
