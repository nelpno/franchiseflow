-- Primeiros passos, Fase 2 (16/09/2026): grava UM item da trilha por vez.
-- A tela mandava o mapa inteiro de items: quem abriu antes apagava o que o outro marcou
-- depois (admin apagando a confirmação da franqueada). Aqui a troca é atômica, só na chave.
-- SECURITY INVOKER: vale a RLS de UPDATE e o guard (franqueada não muda maxi_*).
-- Desmarcar um item da Maxi também apaga a chave legada equivalente (4-4, 8-1, 9-3),
-- senão o legado "reacendia" o item.

create or replace function public.set_onboarding_item(p_franchise_id text, p_key text, p_done boolean)
returns jsonb
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_row public.onboarding_checklists;
  v_legado text := case p_key
    when 'maxi_grupo' then '4-4'
    when 'maxi_redes' then '8-1'
    when 'maxi_validacao' then '9-3'
  end;
begin
  if p_key is null or p_key !~ '^(p|maxi)_[a-z_]{2,40}$' then
    raise exception 'Item invalido' using errcode = '22023';
  end if;

  update public.onboarding_checklists oc
  set items = case
      when p_done then coalesce(oc.items, '{}'::jsonb) || jsonb_build_object(p_key, to_jsonb(now()))
      else (coalesce(oc.items, '{}'::jsonb) - p_key) - coalesce(v_legado, '')
    end
  where oc.franchise_id = p_franchise_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Primeiros passos nao encontrados para esta unidade' using errcode = '42501';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.set_onboarding_item(text, text, boolean) from public, anon;
grant execute on function public.set_onboarding_item(text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
