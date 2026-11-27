-- 27/11/2026 · varredura de segurança (Dynamic Agents - HQ/seguranca/varredura-2026-11-27/RELATORIO-maxi.md, achado 3)
-- Antes: qualquer usuário logado avisava QUALQUER unidade com título, texto e link livres (golpe: "pague nesta chave Pix").
-- Agora: só fábrica/CS (admin, manager, cs), a própria unidade, ou chamada interna sem usuário (cron, service_role).
-- Chamadores mapeados: OrderDetailDialog.jsx:177 e PurchaseOrders.jsx:419 (fábrica), s15 conferir-entrega (gatilho/cron), estoque-baixo (cron).
-- ROLLBACK: rodar o bloco "ROLLBACK" no fim deste arquivo.
create or replace function public.notify_franchise_users(p_franchise_id uuid, p_title text, p_message text, p_type text default 'info'::text, p_icon text default 'notifications'::text, p_link text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is not null
     and not public.is_admin_or_manager()
     and not public.is_cs_or_admin()
     and not exists (select 1 from profiles where id = auth.uid() and p_franchise_id::text = any(managed_franchise_ids)) then
    raise exception 'sem permissão para avisar esta unidade' using errcode = '42501';
  end if;
  insert into notifications (user_id, title, message, type, icon, link)
  select id, p_title, p_message, p_type, p_icon, p_link
  from profiles where p_franchise_id::text = any(managed_franchise_ids);
end;
$function$;

-- ROLLBACK (versão anterior, sem trava):
-- create or replace function public.notify_franchise_users(p_franchise_id uuid, p_title text, p_message text, p_type text default 'info'::text, p_icon text default 'notifications'::text, p_link text default null::text)
--  returns void language plpgsql security definer set search_path to 'public'
-- as $function$
-- begin
--   insert into notifications (user_id, title, message, type, icon, link)
--   select id, p_title, p_message, p_type, p_icon, p_link
--   from profiles where p_franchise_id::text = any(managed_franchise_ids);
-- end;
-- $function$;
