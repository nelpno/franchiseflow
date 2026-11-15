-- Primeiros passos, Fase 2 (16/09/2026): fatos que a trilha usa para marcar sozinha.
-- "Agora" (pode voltar atrás): estoque positivo, cardápio cadastrado.
-- "Marcos" (com data): 1º pedido, 1ª entrega, 1ª resposta do robô, 1ª venda (e com cliente).
-- Filtro obrigatório por unidade: sem acesso devolve null (não vaza entre unidades).

create or replace function public.get_onboarding_facts(p_franchise_id text)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select case
    -- coalesce: sem linha em profiles o helper devolve NULL, e "not NULL" cairia no else (17/09).
    when p_franchise_id is null
      or not coalesce(
        public.is_admin_or_manager()
        or p_franchise_id = any ((select public.managed_franchise_ids())::text[]),
        false
      )
    then null
    else jsonb_build_object(
      'first_order_at', (
        select min(coalesce(po.ordered_at, po.created_at))
        from public.purchase_orders po
        where po.franchise_id = p_franchise_id
      ),
      'first_delivered_at', (
        select min(coalesce(po.delivered_at, po.updated_at))
        from public.purchase_orders po
        where po.franchise_id = p_franchise_id and po.status = 'entregue'
      ),
      'stock_now', exists (
        select 1 from public.inventory_items i
        where i.franchise_id = p_franchise_id
          and coalesce(i.active, true)
          and coalesce(i.quantity, 0) > 0
      ),
      'has_catalog', exists (
        select 1 from public.franchise_configurations c
        where c.franchise_evolution_instance_id = p_franchise_id
          and nullif(trim(c.catalog_image_url), '') is not null
      ),
      'first_bot_reply_at', (
        select m.created_at
        from public.conversation_messages m
        where m.franchise_id = p_franchise_id and m.direction = 'out'
        order by m.created_at asc
        limit 1
      ),
      'first_sale_at', (
        select min(s.created_at) from public.sales s
        where s.franchise_id = p_franchise_id
      ),
      'first_sale_with_contact_at', (
        select min(s.created_at) from public.sales s
        where s.franchise_id = p_franchise_id and s.contact_id is not null
      )
    )
  end;
$$;

revoke execute on function public.get_onboarding_facts(text) from public, anon;
grant execute on function public.get_onboarding_facts(text) to authenticated;

notify pgrst, 'reload schema';
