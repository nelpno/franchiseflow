CREATE OR REPLACE FUNCTION public.cardapio_unidade(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_evo text;
  v_ativo boolean;
  v_unidade jsonb;
  v_itens jsonb;
  v_controla boolean;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_regras jsonb;
  v_promocoes jsonb := '[]'::jsonb;
  v_mais jsonb;
  v_pares jsonb;
begin
  v_evo := public.cardapio_evo_do_slug(p_slug);
  if v_evo is null then
    return null;
  end if;

  select coalesce(fc.cardapio_digital_ativo, false), fc.promocao_regras into v_ativo, v_regras
    from franchise_configurations fc where fc.franchise_evolution_instance_id = v_evo;
  -- em pausa: a unidade desligou OU a chave cardapio_digital está desligada (botão de emergência; revisão 10/11/2026)
  v_ativo := coalesce(v_ativo, false) and public.feature_flag_enabled('cardapio_digital', v_evo);

  if not v_ativo then
    return jsonb_build_object(
      'unidade', (select jsonb_build_object('pausado', true, 'nome', f.name,
                    'whatsapp', nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), ''),
                    'whatsapp_pedido', public.cardapio_whatsapp_pedido(v_evo)->>'numero')
                    from franchises f where f.evolution_instance_id = v_evo),
      'itens', '[]'::jsonb);
  end if;

  select jsonb_build_object(
           'nome', f.name,
           'bairro', fc.neighborhood,
           'whatsapp', nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), ''),
           -- 10l: o #PED- vai para o robô quando ele está conectado (senão o público); o site manda para este
           'whatsapp_pedido', public.cardapio_whatsapp_pedido(v_evo)->>'numero',
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
                                 then (select jsonb_agg(jsonb_build_object('dias', r->'days', 'abre', r->>'delivery_start', 'fecha', r->>'delivery_end', 'corte', nullif(r->>'order_cutoff', ''))) from jsonb_array_elements(fc.delivery_schedule) r) end,
           -- feriado e horário diferente com data (Meu robô > Horário especial): só os campos de data e hora
           'horario_especial', case when jsonb_typeof(fc.horario_especial) = 'array' and jsonb_array_length(fc.horario_especial) > 0
                                 then (select jsonb_agg(jsonb_build_object('de', x->>'de', 'ate', x->>'ate', 'tipo', x->>'tipo', 'abre', x->>'abre', 'fecha', x->>'fecha', 'vale', x->>'vale'))
                                         from jsonb_array_elements(fc.horario_especial) x) end,
           -- 10l: o cliente vê SÓ o texto feito para ele (promocao_cliente, ou o da promoção estruturada); o texto livre do
           -- Meu robô (promotions_combo) é instrução para o robô e não vai mais ao cardápio. 'promocao' = o mesmo, por compatibilidade.
           'promocao', public.cardapio_promocao_cliente(v_evo),
           'promocao_cliente', public.cardapio_promocao_cliente(v_evo),
           -- v5: formas de pagamento (só os códigos; nunca chave Pix nem URL do link)
           'pagamento_entrega', case when coalesce(fc.has_delivery, false) and jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array'
                                  then to_jsonb(fc.payment_delivery) end,
           'pagamento_retirada', case when coalesce(fc.has_pickup, false) then
                                   case when jsonb_typeof(to_jsonb(fc.payment_pickup)) = 'array' and jsonb_array_length(to_jsonb(fc.payment_pickup)) > 0
                                     then to_jsonb(fc.payment_pickup)
                                     when jsonb_typeof(to_jsonb(fc.payment_delivery)) = 'array' then to_jsonb(fc.payment_delivery) end end,
           -- v6: id do dataset/pixel do Meta da unidade (público por natureza: vai no HTML de qualquer site com pixel)
           'meta_pixel', case when fc.meta_dataset_id ~ '^[0-9]{6,20}$' then fc.meta_dataset_id end,
           -- v7: o @ do Instagram da unidade (Meu robô)
           'instagram', nullif(btrim(coalesce(fc.social_media_links->>'instagram', '')), ''),
           -- v8: prazo da entrega "o quanto antes" (mesmo campo do Meu robô que o robô usa; sem valor = 60 min)
           'entrega_prazo_min', case when coalesce(fc.has_delivery, false) then public.cardapio_prazo_entrega(fc.avg_prep_time_minutes) end,
           -- v8: entrega pausada pela unidade até 'AAAA-MM-DDTHH:MI' (Brasília); null = não pausada (já venceu = null)
           'entrega_pausa_ate', case when coalesce(fc.has_delivery, false) and fc.cardapio_entrega_pausa_ate > now()
                                  then to_char(fc.cardapio_entrega_pausa_ate at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') end
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

  -- unidade que não controla estoque (nenhum item > 0): tudo aparece disponível e nada some pelos 30 dias
  -- 10l: controla estoque = tem item > 0 OU mexeu no estoque nos últimos 30 dias (zerar TUDO não vira "tudo disponível")
  v_controla := exists (select 1 from inventory_items j where j.franchise_id = v_evo and coalesce(j.active, true) is not false
                          and (j.quantity > 0 or (j.quantity is not null and coalesce(j.zerado_desde, j.updated_at) >= now() - interval '30 days')));

  -- um item por nome (nome repetido no estoque duplicaria mais vendidos, pares e o preço normal do kit):
  -- fica a linha em estoque e, entre iguais, a atualizada por último
  with base as (
    select distinct on (i.product_name) i.product_name produto, i.category categoria, i.sale_price preco,
           (i.quantity > 0 or i.quantity is null or not v_controla) disponivel,
           coalesce(i.zerado_desde, i.updated_at) zerado
      from inventory_items i
     where i.franchise_id = v_evo
       and coalesce(i.active, true) is not false
       and i.sale_price > 0
       and coalesce(i.cardapio_visivel, true)
       and not coalesce(v_controla and i.quantity <= 0 and coalesce(i.zerado_desde, i.updated_at) < now() - interval '30 days', false)
     order by i.product_name, (i.quantity > 0 or i.quantity is null) desc, i.updated_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'produto', b.produto,
           'categoria', b.categoria,
           'preco', b.preco,
           'disponivel', b.disponivel,
           'zerado_em', case when not b.disponivel then to_char((b.zerado at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') end
         ) order by b.categoria, b.produto), '[]'::jsonb)
    into v_itens
    from base b;

  -- mais vendidos (90 d) que estão à venda; sem venda registrada, os de maior estoque
  select coalesce(jsonb_agg(jsonb_build_object('produto', x.produto, 'vendas', x.n) order by x.ord), '[]'::jsonb)
    into v_mais
    from (
      select it->>'produto' produto, coalesce(s.n, 0) n,
             row_number() over (order by s.n desc nulls last, (select quantity from inventory_items q where q.franchise_id = v_evo and q.product_name = it->>'produto' limit 1) desc nulls last, it->>'produto') ord
        from jsonb_array_elements(v_itens) it
        left join cardapio_sugestoes s on s.franchise_id = v_evo and s.tipo = 'mais_vendido' and s.produto_a = it->>'produto'
       where (it->>'disponivel')::boolean
         and (s.n is not null or not exists (select 1 from cardapio_sugestoes s2 where s2.franchise_id = v_evo and s2.tipo = 'mais_vendido'))
    ) x
   where x.ord <= 3;

  -- pares comprados juntos (os dois no cardápio; quem mostra decide pelo estoque)
  select coalesce(jsonb_agg(jsonb_build_object('a', s.produto_a, 'b', s.produto_b, 'n', s.n) order by s.n desc, s.produto_a, s.produto_b), '[]'::jsonb)
    into v_pares
    from cardapio_sugestoes s
   where s.franchise_id = v_evo and s.tipo = 'par' and s.n >= 3
     and exists (select 1 from jsonb_array_elements(v_itens) a where a->>'produto' = s.produto_a)
     and exists (select 1 from jsonb_array_elements(v_itens) b where b->>'produto' = s.produto_b);

  -- promoção estruturada (só com a chave cardapio_kit; o texto livre continua em unidade.promocao)
  if public.feature_flag_enabled('cardapio_kit', v_evo) and jsonb_typeof(v_regras) = 'array' and jsonb_array_length(v_regras) > 0 then
    select coalesce(jsonb_agg(p), '[]'::jsonb) into v_promocoes
      from (
        select jsonb_build_object(
                 'tipo', r->>'tipo', 'nome', r->>'nome',
                 'itens', (select jsonb_agg(jsonb_build_object('product_name', x->>'product_name', 'qtd', (x->>'qtd')::int,
                                    'preco', (select (c->>'preco')::numeric from jsonb_array_elements(v_itens) c where c->>'produto' = x->>'product_name' limit 1)) order by o)
                             from jsonb_array_elements(r->'itens') with ordinality t(x, o)),
                 'preco', case when r->>'tipo' = 'kit' then round((r->>'preco')::numeric, 2) end,
                 'preco_normal', case when r->>'tipo' = 'kit' then
                                   (select round(sum((c->>'preco')::numeric * (x->>'qtd')::int), 2)
                                      from jsonb_array_elements(r->'itens') x join jsonb_array_elements(v_itens) c on c->>'produto' = x->>'product_name') end,
                 'min_qtd', case when r->>'tipo' = 'percentual' then (r->>'min_qtd')::int end,
                 'pct', case when r->>'tipo' = 'percentual' then (r->>'pct')::numeric end,
                 'vale_ate', r->>'vale_ate',
                 'texto', public.promocao_texto(jsonb_build_array(r), v_evo)) p
          from jsonb_array_elements(v_regras) r
         where (r->>'vale_ate' is null or (r->>'vale_ate' ~ '^\d{4}-\d{2}-\d{2}$' and (r->>'vale_ate')::date >= v_hoje))
           -- todos os itens no cardápio de hoje
           and not exists (select 1 from jsonb_array_elements(r->'itens') x
                            where not exists (select 1 from jsonb_array_elements(v_itens) c where c->>'produto' = x->>'product_name'))
           -- kit: todos em estoque; leve N: pelo menos um em estoque
           and case when r->>'tipo' = 'kit'
                 then not exists (select 1 from jsonb_array_elements(r->'itens') x join jsonb_array_elements(v_itens) c on c->>'produto' = x->>'product_name'
                                   where not (c->>'disponivel')::boolean)
                 else exists (select 1 from jsonb_array_elements(r->'itens') x join jsonb_array_elements(v_itens) c on c->>'produto' = x->>'product_name'
                               where (c->>'disponivel')::boolean) end
      ) q;
  end if;

  return jsonb_build_object('unidade', v_unidade, 'itens', v_itens,
                            'promocoes', v_promocoes, 'mais_vendidos', v_mais, 'pares', v_pares);
end;
$function$
;
