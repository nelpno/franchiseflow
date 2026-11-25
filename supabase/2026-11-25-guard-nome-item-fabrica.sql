-- 25/11/2026: a unidade não cria (nem renomeia) produto PRÓPRIO com o nome de um produto da fábrica.
-- Por quê: Jaraguá renomeou uma torta para "SOFIOLI 4 QUEIJOS" e passou 3 un do Sofioli da fábrica para ela;
-- 6 unidades tinham "Pão de queijo tradicional" à mão ao lado do da fábrica (estoque em dobro, cardápio repetido).
-- O app já barrava o nome IGUAL; aqui pega a variação (maiúscula, acento, "de/com/e", sem o tamanho).
-- Outro tamanho passa se o nome trouxer o tamanho (ex.: "Pão de queijo tradicional 400g", "Molho Sugo 500ml").
-- Só o papel `authenticated` comum (franqueada); admin/gerente, service_role e postgres passam.
--
-- ROLLBACK:
--   drop trigger if exists trg_guard_inventory_nome on public.inventory_items;
--   drop function if exists public.guard_inventory_nome();
--   drop function if exists public.inventario_nome_chave(text);
--   drop function if exists public.inventario_nome_tamanho(text);

create or replace function public.inventario_nome_chave(p text)
returns text language sql immutable set search_path to 'public' as $$
  select regexp_replace(
           regexp_replace(
             ' ' || translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') || ' ',
             '\y(com|de|do|da|e|c|rolo|fatiado|un|unid|unidade|pacote|pct|massa|mucarela|mussarela|muzzarela|mozarela|[0-9]+([.,][0-9]+)? ?(g|gr|grs|gramas|kg|kgs|ml|l|lt|litro|litros))\y',
             ' ', 'g'),
           '[^a-z0-9]', '', 'g')
$$;

-- tamanho em g (ou ml) quando o nome traz; null quando não traz
create or replace function public.inventario_nome_tamanho(p text)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when m is null then null
              when m[2] in ('kg','kgs','l','lt','litro','litros') then replace(m[1], ',', '.')::numeric * 1000
              else replace(m[1], ',', '.')::numeric end
    from (select regexp_match(lower(coalesce(p, '')), '([0-9]+(?:[.,][0-9]+)?) ?(kgs|kg|gramas|grs|gr|g|ml|litros|litro|lt|l)\y') m) x
$$;

create or replace function public.guard_inventory_nome()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_fab text;
begin
  if current_user = 'authenticated'
     and coalesce(new.created_by_franchisee, false) = true
     and (tg_op = 'INSERT' or new.product_name is distinct from old.product_name)
     and not coalesce((select public.is_admin_or_manager()), false) then
    select f.product_name into v_fab
      from inventory_items f
     where f.franchise_id = new.franchise_id
       and coalesce(f.created_by_franchisee, false) = false
       and f.id is distinct from new.id
       and public.inventario_nome_chave(f.product_name) = public.inventario_nome_chave(new.product_name)
       and (public.inventario_nome_tamanho(new.product_name) is null
            or public.inventario_nome_tamanho(f.product_name) is null
            or public.inventario_nome_tamanho(f.product_name) = public.inventario_nome_tamanho(new.product_name))
     limit 1;
    if v_fab is not null then
      raise exception 'Estoque: esse produto já existe como produto da fábrica (%). Procure na lista ou em produtos ocultos. Se for outro tamanho, escreva o tamanho no nome.', v_fab
        using errcode = 'P0001', hint = 'item_fabrica_nome';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_inventory_nome on public.inventory_items;
create trigger trg_guard_inventory_nome
  before insert or update of product_name on public.inventory_items
  for each row execute function public.guard_inventory_nome();
