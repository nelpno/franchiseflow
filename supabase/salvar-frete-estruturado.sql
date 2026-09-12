-- Grava o frete do cartão "Entrega" das unidades no frete calculado (plano de frete 12/09/2026, Fase 5b).
--
-- O delivery_pricing só muda pelo servidor: o trigger protege_delivery_pricing descarta, calado, a mudança
-- feita pela chave do painel (authenticated). O painel então chama esta função, que:
--   1. confere quem pede (admin/gestor ou quem administra a unidade);
--   2. confere conflito coluna a coluna contra o que a tela carregou (p_esperado) — outra aba ou o suporte
--      pode ter mudado o frete depois que a tela abriu (foi o que desfez a correção do Guarujá em 11/09);
--   3. grava o frete e os campos derivados dele (horário do robô, venda manual) juntos, ou nada.
-- Ligar ou desligar o frete calculado de uma unidade (null <-> objeto) continua sendo só do suporte.
create or replace function public.salvar_frete_estruturado(p_config_id uuid, p_campos jsonb, p_esperado jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.franchise_configurations%rowtype;
  v_atual jsonb;
  v_permitidas constant text[] := array['delivery_pricing', 'delivery_schedule', 'delivery_fee_rules',
    'charges_delivery_fee', 'max_delivery_radius_km', 'opening_hours', 'working_days'];
  v_chave text;
  v_conflitos text[] := '{}';
  v_pricing jsonb;
  v_grupo jsonb;
  v_tipo jsonb;
begin
  if p_campos is null or coalesce(jsonb_typeof(p_campos), '') <> 'object' then
    raise exception 'Frete: nada para gravar.' using errcode = 'P0001';
  end if;

  select * into v_row from public.franchise_configurations where id = p_config_id for update;
  if not found then
    raise exception 'Frete: configuração não encontrada.' using errcode = 'P0001';
  end if;

  if not ((select public.is_admin_or_manager())
          or v_row.franchise_evolution_instance_id = any((select public.managed_franchise_ids())::text[])) then
    raise exception 'Sem permissão para alterar esta unidade.' using errcode = '42501';
  end if;

  v_atual := to_jsonb(v_row);
  for v_chave in select jsonb_object_keys(p_campos) loop
    if not (v_chave = any(v_permitidas)) then
      raise exception 'Frete: campo não permitido (%).', v_chave using errcode = 'P0001';
    end if;
    if (v_atual -> v_chave) is distinct from (coalesce(p_esperado, '{}'::jsonb) -> v_chave) then
      v_conflitos := v_conflitos || v_chave;
    end if;
  end loop;
  if coalesce(array_length(v_conflitos, 1), 0) > 0 then
    raise exception 'CONFLITO_FRETE:%', array_to_string(v_conflitos, ',') using errcode = '40001';
  end if;

  if p_campos ? 'delivery_pricing' and not (select public.is_admin_or_manager()) then
    if v_row.delivery_pricing is null or coalesce(jsonb_typeof(p_campos -> 'delivery_pricing'), '') <> 'object' then
      raise exception 'Frete: só o suporte liga ou desliga o frete calculado.' using errcode = '42501';
    end if;
  end if;

  -- estrutura mínima: o painel já valida; esta é a última porta antes do robô
  v_pricing := p_campos -> 'delivery_pricing';
  if coalesce(jsonb_typeof(v_pricing), '') = 'object' then
    if coalesce(jsonb_typeof(v_pricing -> 'grupos'), '') <> 'array' or jsonb_array_length(v_pricing -> 'grupos') = 0 then
      raise exception 'Frete: defina ao menos um grupo de dias.' using errcode = 'P0001';
    end if;
    for v_grupo in select value from jsonb_array_elements(v_pricing -> 'grupos') loop
      if coalesce(jsonb_typeof(v_grupo -> 'dias'), '') <> 'array' or jsonb_array_length(v_grupo -> 'dias') = 0
         or coalesce(jsonb_typeof(v_grupo -> 'tipos'), '') <> 'array' or jsonb_array_length(v_grupo -> 'tipos') = 0 then
        raise exception 'Frete: cada grupo de dias precisa de dias e de ao menos um tipo de entrega.' using errcode = 'P0001';
      end if;
      for v_tipo in select value from jsonb_array_elements(v_grupo -> 'tipos') loop
        if coalesce(v_tipo ->> 'inicio', '') !~ '^\d{1,2}:\d{2}$' or coalesce(v_tipo ->> 'fim', '') !~ '^\d{1,2}:\d{2}$' then
          raise exception 'Frete: tipo de entrega sem janela (das __ às __).' using errcode = 'P0001';
        end if;
        if coalesce(v_tipo -> 'taxa' ->> 'modo', '') not in ('fixa', 'faixas', 'por_km', 'especial') then
          raise exception 'Frete: tipo de entrega sem taxa.' using errcode = 'P0001';
        end if;
        if v_tipo -> 'taxa' ->> 'modo' = 'fixa' and coalesce(jsonb_typeof(v_tipo -> 'taxa' -> 'valor'), '') <> 'number' then
          raise exception 'Frete: falta o valor da taxa.' using errcode = 'P0001';
        end if;
      end loop;
    end loop;
  end if;

  update public.franchise_configurations set
    delivery_pricing       = case when p_campos ? 'delivery_pricing' then nullif(p_campos -> 'delivery_pricing', 'null'::jsonb) else delivery_pricing end,
    delivery_schedule      = case when p_campos ? 'delivery_schedule' then p_campos -> 'delivery_schedule' else delivery_schedule end,
    delivery_fee_rules     = case when p_campos ? 'delivery_fee_rules' then p_campos -> 'delivery_fee_rules' else delivery_fee_rules end,
    charges_delivery_fee   = case when p_campos ? 'charges_delivery_fee' then (p_campos ->> 'charges_delivery_fee')::boolean else charges_delivery_fee end,
    max_delivery_radius_km = case when p_campos ? 'max_delivery_radius_km' then (p_campos ->> 'max_delivery_radius_km')::numeric else max_delivery_radius_km end,
    opening_hours          = case when p_campos ? 'opening_hours' then p_campos ->> 'opening_hours' else opening_hours end,
    working_days           = case when p_campos ? 'working_days' then p_campos ->> 'working_days' else working_days end
  where id = p_config_id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id, 'updated_at', v_row.updated_at,
    'delivery_pricing', v_row.delivery_pricing, 'delivery_schedule', v_row.delivery_schedule,
    'delivery_fee_rules', v_row.delivery_fee_rules, 'charges_delivery_fee', v_row.charges_delivery_fee,
    'max_delivery_radius_km', v_row.max_delivery_radius_km, 'opening_hours', v_row.opening_hours,
    'working_days', v_row.working_days);
end $$;

revoke all on function public.salvar_frete_estruturado(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_frete_estruturado(uuid, jsonb, jsonb) to authenticated, service_role;

comment on function public.salvar_frete_estruturado(uuid, jsonb, jsonb) is
  'Cartão Entrega (frete calculado): grava delivery_pricing + campos derivados com checagem de permissão e de conflito. Ligar/desligar o frete calculado é só admin/gestor.';
