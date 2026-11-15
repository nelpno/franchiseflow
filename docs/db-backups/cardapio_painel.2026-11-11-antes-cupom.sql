CREATE OR REPLACE FUNCTION public.cardapio_painel(p_evo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb;
  v_controla boolean;
  v_ck jsonb;
  v_slug text;
begin
  if not public.cardapio_pode(p_evo, false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- 10l: controla estoque = tem item > 0 OU mexeu no estoque nos últimos 30 dias (zerar TUDO não vira "tudo disponível")
  v_controla := exists (select 1 from inventory_items j where j.franchise_id = p_evo and coalesce(j.active, true) is not false
                          and (j.quantity > 0 or (j.quantity is not null and coalesce(j.zerado_desde, j.updated_at) >= now() - interval '30 days')));
  v_ck := coalesce(public.cardapio_checklist(p_evo), '[]'::jsonb);
  v_slug := public.cardapio_slug_novo(p_evo);
  select jsonb_build_object(
           'evo', fc.franchise_evolution_instance_id,
           'nome', f.name,
           'ativo', coalesce(fc.cardapio_digital_ativo, false),
           -- chave cardapio_digital da unidade: desligada = página em pausa, robô sem link, sem frete (cardapio_aberto)
           'chave_ligada', public.feature_flag_enabled('cardapio_digital', p_evo),
           'slug', fc.cardapio_digital_slug,
           'url', case when fc.cardapio_digital_slug is not null then 'https://pedido.maximassas.com.br/' || fc.cardapio_digital_slug || '/' end,
           -- 10f: link que nasce ao ligar (o próprio, se já existe)
           'slug_sugerido', v_slug,
           'url_sugerida', case when v_slug is not null then 'https://pedido.maximassas.com.br/' || v_slug || '/' end,
           'primeira_vez_em', fc.cardapio_primeira_vez_em,
           'ativo_mudou_em', fc.cardapio_ativo_mudou_em,
           'checklist', v_ck,
           'pode_ligar', not exists (select 1 from jsonb_array_elements(v_ck) c where c->>'nivel' = 'trava' and not (c->>'ok')::boolean),
           'link_bio_em', fc.cardapio_link_bio_em,
           -- "primeiro uso" = nunca ligou nem recebeu visita (eventos guardam 180 dias)
           'ja_usou', fc.cardapio_primeira_vez_em is not null
                      or (fc.cardapio_digital_slug is not null
                          and exists (select 1 from cardapio_eventos e where e.unidade = fc.cardapio_digital_slug)),
           'tem_whatsapp', nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), '') is not null,
           'tem_horarios', (coalesce(fc.has_delivery, false) and jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0)
                           or (coalesce(fc.has_pickup, false) and ((jsonb_typeof(fc.pickup_schedule) = 'array' and jsonb_array_length(fc.pickup_schedule) > 0)
                                                                  or (jsonb_typeof(fc.delivery_schedule) = 'array' and jsonb_array_length(fc.delivery_schedule) > 0))),
           'tem_pagamento', (jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_delivery)) > 0)
                            or (jsonb_typeof(to_jsonb(fc.payment_pickup)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_pickup)) > 0),
           'horario_especial', coalesce(fc.horario_especial, '[]'::jsonb),
           'promocao_regras', coalesce(fc.promocao_regras, '[]'::jsonb),
           'promocao_texto', fc.promotions_combo,
           -- 10l: texto da promoção para o cliente (o escrito pela unidade) e o que o cardápio mostra de fato
           'promocao_cliente', fc.promocao_cliente,
           'promocao_cliente_exibida', public.cardapio_promocao_cliente(p_evo),
           -- 10l: para onde vai o pedido (robo | pessoal | publico) e o número
           'pedido_destino', public.cardapio_whatsapp_pedido(p_evo)->>'destino',
           'whatsapp_pedido', public.cardapio_whatsapp_pedido(p_evo)->>'numero',
           'kit_no_cardapio', public.feature_flag_enabled('cardapio_kit', p_evo),
           'controla_estoque', v_controla,
           -- v8: entrega "o quanto antes" e pausa da entrega
           'tem_entrega', coalesce(fc.has_delivery, false),
           -- 10i: "pedidos até" e fim da entrega de HOJE (Meu robô > horário de entrega; o mesmo campo que o robô lê)
           'entrega_corte_hoje', (select nullif(g->>'order_cutoff', '') from jsonb_array_elements(case when jsonb_typeof(fc.delivery_schedule) = 'array' then fc.delivery_schedule else '[]'::jsonb end) g where g->'days' ? (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from (now() at time zone 'America/Sao_Paulo'))::int + 1] limit 1),
           'entrega_fim_hoje', (select nullif(g->>'delivery_end', '') from jsonb_array_elements(case when jsonb_typeof(fc.delivery_schedule) = 'array' then fc.delivery_schedule else '[]'::jsonb end) g where g->'days' ? (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from (now() at time zone 'America/Sao_Paulo'))::int + 1] limit 1),
           -- 10n: o MESMO prazo do robô e do cardápio (regra só em cardapio_prazo_unidade; null = dentro da janela); a tela só exibe
           'entrega_prazo_min', case when coalesce(fc.has_delivery, false) then public.cardapio_prazo_unidade(fc.franchise_evolution_instance_id) end,
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
$function$
;
