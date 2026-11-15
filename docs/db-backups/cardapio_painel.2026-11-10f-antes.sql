-- Corpo de cardapio_painel ANTES do 2026-11-10f-cardapio-rede-aberta.sql (= o da 2026-11-10e, md5 16f5c0834ec2d91a557400e8d8afb2a1).
-- Restaurado em 10/11 noite: um backup de outra sessão (10i) tinha sobrescrito este arquivo com o corpo já com o 10f.
create or replace function public.cardapio_painel(p_evo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_controla boolean;
begin
  if not public.cardapio_pode(p_evo, false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  v_controla := exists (select 1 from inventory_items j where j.franchise_id = p_evo and coalesce(j.active, true) is not false and j.quantity > 0);
  select jsonb_build_object(
           'evo', fc.franchise_evolution_instance_id,
           'nome', f.name,
           'ativo', coalesce(fc.cardapio_digital_ativo, false),
           -- chave cardapio_digital da unidade: desligada = página em pausa, robô sem link, sem frete (cardapio_aberto)
           'chave_ligada', public.feature_flag_enabled('cardapio_digital', p_evo),
           'slug', fc.cardapio_digital_slug,
           'url', case when fc.cardapio_digital_slug is not null then 'https://pedido.maximassas.com.br/' || fc.cardapio_digital_slug || '/' end,
           'link_bio_em', fc.cardapio_link_bio_em,
           -- "primeiro uso" = nunca ligou nem recebeu visita (eventos guardam 180 dias)
           'ja_usou', fc.cardapio_digital_slug is not null
                      and exists (select 1 from cardapio_eventos e where e.unidade = fc.cardapio_digital_slug),
           'tem_whatsapp', nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), '') is not null,
           'tem_horarios', (coalesce(fc.has_delivery, false) and jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0)
                           or (coalesce(fc.has_pickup, false) and ((jsonb_typeof(fc.pickup_schedule) = 'array' and jsonb_array_length(fc.pickup_schedule) > 0)
                                                                  or (jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0))),
           'tem_pagamento', (jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_delivery)) > 0)
                            or (jsonb_typeof(to_jsonb(fc.payment_pickup)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_pickup)) > 0),
           'horario_especial', coalesce(fc.horario_especial, '[]'::jsonb),
           'promocao_regras', coalesce(fc.promocao_regras, '[]'::jsonb),
           'promocao_texto', fc.promotions_combo,
           'kit_no_cardapio', public.feature_flag_enabled('cardapio_kit', p_evo),
           'controla_estoque', v_controla,
           -- v8: entrega "o quanto antes" e pausa da entrega
           'tem_entrega', coalesce(fc.has_delivery, false),
           -- v8b: o MESMO prazo que o cardápio mostra (regra só em cardapio_prazo_entrega); a tela só exibe
           'entrega_prazo_min', case when coalesce(fc.has_delivery, false) then public.cardapio_prazo_entrega(fc.avg_prep_time_minutes) end,
           'entrega_pausa_ate', case when fc.cardapio_entrega_pausa_ate > now()
                                  then to_char(fc.cardapio_entrega_pausa_ate at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') end,
           'produtos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', i.id, 'produto', i.product_name, 'categoria', i.category, 'preco', i.sale_price,
                      'quantidade', i.quantity, 'visivel', coalesce(i.cardapio_visivel, true),
                      'zerado', v_controla and i.quantity is not null and i.quantity <= 0,
                      'zerado_desde', case when v_controla and i.quantity is not null and i.quantity <= 0 then coalesce(i.zerado_desde, i.updated_at) end
                    ) order by i.category, i.product_name)
               from inventory_items i
              where i.franchise_id = p_evo and coalesce(i.active, true) is not false and i.sale_price > 0), '[]'::jsonb)
         )
    into v
    from franchise_configurations fc
    join franchises f on f.evolution_instance_id = fc.franchise_evolution_instance_id
   where fc.franchise_evolution_instance_id = p_evo;
  return v;
end;
$$;
revoke all on function public.cardapio_painel(text) from public, anon;
grant execute on function public.cardapio_painel(text) to authenticated;
