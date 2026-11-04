-- "Estoque baixo": no máximo 1 aviso por UNIDADE a cada 20 h, com a lista (04/11/2026).
-- Antes: 1 aviso por produto que cruzava o mínimo = 1.562 avisos em 30 dias para 63
-- franqueados (~25 por pessoa), 28% lidos (docs/revisao-uso-2026-11-04.md, item 2).
-- Agora: gatilho POR COMANDO (vê todas as linhas de uma venda/contagem de uma vez). Se algum
-- produto cruzou o mínimo e a unidade não foi avisada nas últimas 20 h, manda UM aviso com
-- quantos estão no mínimo e os 3 primeiros nomes. O controle é por unidade
-- (`estoque_baixo_aviso`), não por pessoa: quem cuida de 2 unidades recebe o de cada uma.
--
-- ROLLBACK: rodar o bloco "versão anterior" no fim deste arquivo.

create table if not exists public.estoque_baixo_aviso (
  franchise_id text primary key,       -- evolution_instance_id
  avisado_em   timestamptz not null
);
alter table public.estoque_baixo_aviso enable row level security;
revoke all on table public.estoque_baixo_aviso from anon, authenticated, public;
grant select, insert, update, delete on table public.estoque_baixo_aviso to service_role;

create or replace function public.on_inventory_low_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r        record;
  v_fid    uuid;
  v_total  int;
  v_nomes  text;
  v_um     text;
begin
  for r in
    select distinct n.franchise_id
      from novas n join antigas o on o.id = n.id
     where n.quantity <= n.min_stock
       and (o.quantity > o.min_stock or o.quantity is null)
  loop
    -- Avisada nas últimas 20 h: não repete (a tela Estoque já mostra a lista).
    if exists (select 1 from estoque_baixo_aviso a
                where a.franchise_id = r.franchise_id and a.avisado_em > now() - interval '20 hours') then
      continue;
    end if;

    select id into v_fid from franchises where evolution_instance_id = r.franchise_id;
    if v_fid is null then
      continue;
    end if;

    select count(*),
           string_agg(product_name, ', ' order by product_name) filter (where rn <= 3),
           max(rotulo)
      into v_total, v_nomes, v_um
    from (
      select i.product_name, row_number() over (order by i.product_name) rn,
             i.product_name || ' chegou ao estoque mínimo (' || i.quantity || '/' || i.min_stock || ').' rotulo
      from inventory_items i
      where i.franchise_id = r.franchise_id
        and coalesce(i.active, true)
        and coalesce(i.min_stock, 0) > 0
        and i.quantity <= i.min_stock
    ) x;

    if coalesce(v_total, 0) = 0 then
      continue;
    end if;

    perform notify_franchise_users(
      v_fid,
      'Estoque baixo',
      case when v_total = 1 then v_um
        else v_total || ' produtos no estoque mínimo: ' || v_nomes
             || case when v_total > 3 then ' e mais ' || (v_total - 3) else '' end || '.'
      end,
      'warning',
      'inventory_2',
      '/Gestao?tab=estoque'
    );

    insert into estoque_baixo_aviso (franchise_id, avisado_em) values (r.franchise_id, now())
    on conflict (franchise_id) do update set avisado_em = excluded.avisado_em;
  end loop;
  return null;
end;
$function$;

create or replace trigger on_inventory_low_stock
after update on public.inventory_items
referencing old table as antigas new table as novas
for each statement execute function public.on_inventory_low_stock();

-- ---------------------------------------------------------------------------
-- Versão anterior (rollback):
-- drop trigger if exists on_inventory_low_stock on public.inventory_items;
-- create or replace function public.on_inventory_low_stock() returns trigger
-- language plpgsql security definer set search_path to 'public' as $function$
-- declare franchise_record record;
-- begin
--   if new.quantity <= new.min_stock and (old.quantity > old.min_stock or old.quantity is null) then
--     select id into franchise_record from franchises where evolution_instance_id = new.franchise_id;
--     if franchise_record.id is not null then
--       perform notify_franchise_users(franchise_record.id, 'Estoque baixo',
--         new.product_name || ' atingiu o estoque mínimo (' || new.quantity || '/' || new.min_stock || ').',
--         'warning', 'inventory_2', '/Gestao?tab=estoque');
--     end if;
--   end if;
--   return new;
-- end; $function$;
-- create trigger on_inventory_low_stock after update on public.inventory_items
--   for each row execute function public.on_inventory_low_stock();
-- drop table if exists public.estoque_baixo_aviso;
