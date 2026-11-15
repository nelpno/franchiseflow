-- backup do corpo vivo (cardapio_unidade(p_slug text), md5 prosrc 456b61e2985e75719c1c1fee8392f5a1); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.cardapio_unidade(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_evo text;
  v_unidade jsonb;
  v_itens jsonb;
begin
  -- lista branca do piloto (unidade nova = recriar a função com mais uma linha)
  v_evo := case lower(trim(coalesce(p_slug, '')))
             when 'imirim' then 'franquiasaopaulosp10'
             else null
           end;
  if v_evo is null then
    return null;
  end if;

  select jsonb_build_object(
           'nome', f.name,
           'bairro', fc.neighborhood,
           'whatsapp', nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), ''),
           'entrega', coalesce(fc.has_delivery, false),
           'retirada', coalesce(fc.has_pickup, false),
           'pedido_minimo', coalesce(fc.min_order_value, 0),
           -- v4: o que a unidade já preenche no Meu robô (dashboard); nunca endereço de retirada (unidade em casa)
           -- retirada sem horário próprio segue o da entrega (mesma regra do robô e do dashboard)
           'retirada_horario', case when coalesce(fc.has_pickup, false) then
                                 case when coalesce(fc.has_custom_pickup_hours, false) and jsonb_typeof(fc.pickup_schedule) = 'array' and jsonb_array_length(fc.pickup_schedule) > 0
                                   then (select jsonb_agg(jsonb_build_object('dias', r->'days', 'abre', r->>'open', 'fecha', r->>'close')) from jsonb_array_elements(fc.pickup_schedule) r)
                                   when jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0
                                   then (select jsonb_agg(jsonb_build_object('dias', r->'days', 'abre', r->>'delivery_start', 'fecha', r->>'delivery_end')) from jsonb_array_elements(fc.delivery_schedule) r)
                                 end end,
           'entrega_horario', case when coalesce(fc.has_delivery, false) and jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0
                                 then (select jsonb_agg(jsonb_build_object('dias', r->'days', 'abre', r->>'delivery_start', 'fecha', r->>'delivery_end')) from jsonb_array_elements(fc.delivery_schedule) r) end,
           -- feriado e horário diferente com data (Meu robô > Horário especial): só os campos de data e hora
           'horario_especial', case when jsonb_typeof(fc.horario_especial) = 'array' and jsonb_array_length(fc.horario_especial) > 0
                                 then (select jsonb_agg(jsonb_build_object('de', x->>'de', 'ate', x->>'ate', 'tipo', x->>'tipo', 'abre', x->>'abre', 'fecha', x->>'fecha', 'vale', x->>'vale'))
                                         from jsonb_array_elements(fc.horario_especial) x) end,
           'promocao', nullif(left(btrim(coalesce(fc.promotions_combo, '')), 400), ''),
           -- v5: formas de pagamento (só os códigos; nunca chave Pix nem URL do link)
           'pagamento_entrega', case when coalesce(fc.has_delivery, false) and jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array'
                                  then to_jsonb(fc.payment_delivery) end,
           'pagamento_retirada', case when coalesce(fc.has_pickup, false) then
                                   case when jsonb_typeof(to_jsonb(fc.payment_pickup)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_pickup)) > 0
                                     then to_jsonb(fc.payment_pickup)
                                     when jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array' then to_jsonb(fc.payment_delivery) end end,
           -- v6: id do dataset/pixel do Meta da unidade (público por natureza: vai no HTML de qualquer site com pixel)
           'meta_pixel', case when fc.meta_dataset_id ~ '^[0-9]{6,20}$' then fc.meta_dataset_id end
         )
    into v_unidade
    from franchises f
    join franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
   where f.evolution_instance_id = v_evo
     and f.status = 'active'
     and coalesce(f.is_test, false) = false;

  if v_unidade is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'produto', i.product_name,
           'categoria', i.category,
           'preco', i.sale_price,
           'disponivel', (i.quantity > 0 or i.quantity is null or not exists (
               select 1 from inventory_items j
                where j.franchise_id = i.franchise_id
                  and coalesce(j.active, true) is not false
                  and j.quantity > 0))
         ) order by i.category, i.product_name), '[]'::jsonb)
    into v_itens
    from inventory_items i
   where i.franchise_id = v_evo
     and coalesce(i.active, true) is not false
     and i.sale_price > 0;

  return jsonb_build_object('unidade', v_unidade, 'itens', v_itens);
end;
$function$
;
