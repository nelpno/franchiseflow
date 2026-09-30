-- Números que o robô NÃO responde, cadastrados pela própria unidade no painel (30/09/2026).
-- Pedido da rede no grupo (Ubatuba e Rafael, 30/09): fornecedor, maquininha, família — contatos que não são cliente.
-- Grava em public.bot_blocked_numbers (source='manual', franchise_id = a unidade), que o firewall do robô
-- (RPC bot_firewall_check, chamada a cada mensagem pelo V5) já lê. O trigger normaliza o formato (DDD + 8 dígitos).
-- Permissão: admin/gestor ou quem administra a unidade (managed_franchise_ids). anon não executa.

create or replace function public.painel_pode_unidade(p_evo text)
returns boolean language sql stable security definer set search_path = public as $$
  -- managed_franchise_ids guarda o id da franquia (uuid) e, em perfis antigos, o nome da instância
  select (select public.is_admin_or_manager())
      or p_evo = any((select public.managed_franchise_ids())::text[])
      or exists (select 1 from public.franchises f where f.evolution_instance_id = p_evo
                  and f.id::text = any((select public.managed_franchise_ids())::text[]))
$$;
revoke execute on function public.painel_pode_unidade(text) from public, anon;
grant execute on function public.painel_pode_unidade(text) to authenticated, service_role;

create or replace function public.painel_robo_bloqueios(p_franchise text)
returns table (id uuid, phone_raw text, label text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (select public.painel_pode_unidade(p_franchise)) then
    raise exception 'Sem permissão para esta unidade.' using errcode = '42501';
  end if;
  return query
    select b.id, b.phone_raw, b.label, b.created_at from public.bot_blocked_numbers b
     where b.franchise_id = p_franchise and b.source = 'manual' and b.active
     order by b.created_at desc;
end $$;

create or replace function public.painel_robo_bloquear(p_franchise text, p_phone text, p_label text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_key text := public.normalize_phone_key(p_phone); v_id uuid;
begin
  if not (select public.painel_pode_unidade(p_franchise)) then
    raise exception 'Sem permissão para esta unidade.' using errcode = '42501';
  end if;
  if v_key is null then
    raise exception 'Número inválido: coloque o DDD e o número (ex.: 11 98765-4321).' using errcode = 'P0001';
  end if;
  insert into public.bot_blocked_numbers(phone_raw, franchise_id, source, label, active)
  values (btrim(p_phone), p_franchise, 'manual', nullif(left(btrim(coalesce(p_label, '')), 80), ''), true)
  on conflict (phone_key, coalesce(franchise_id, '*'), source)
  do update set active = true, phone_raw = excluded.phone_raw, label = coalesce(excluded.label, public.bot_blocked_numbers.label), expires_at = null
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'phone_key', v_key);
end $$;

create or replace function public.painel_robo_desbloquear(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_franchise text;
begin
  select franchise_id into v_franchise from public.bot_blocked_numbers where id = p_id and source = 'manual';
  if v_franchise is null then
    raise exception 'Número não encontrado.' using errcode = 'P0001';
  end if;
  if not (select public.painel_pode_unidade(v_franchise)) then
    raise exception 'Sem permissão para esta unidade.' using errcode = '42501';
  end if;
  update public.bot_blocked_numbers set active = false where id = p_id;
end $$;

revoke execute on function public.painel_robo_bloqueios(text) from public, anon;
revoke execute on function public.painel_robo_bloquear(text, text, text) from public, anon;
revoke execute on function public.painel_robo_desbloquear(uuid) from public, anon;
grant execute on function public.painel_robo_bloqueios(text) to authenticated, service_role;
grant execute on function public.painel_robo_bloquear(text, text, text) to authenticated, service_role;
grant execute on function public.painel_robo_desbloquear(uuid) to authenticated, service_role;
