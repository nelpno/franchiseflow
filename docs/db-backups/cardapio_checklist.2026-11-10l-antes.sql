-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_checklist(p_evo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  fc franchise_configurations%rowtype;
  f franchises%rowtype;
  v jsonb := '[]'::jsonb;
  v_ent boolean;
  v_ret boolean;
  v_ok boolean;
  v_faixas int;
  v_raio numeric;
  v_estoque int;
  v_aparecem int;
  v_zerados int;
  v_controla boolean;
  v_robo text;
begin
  select * into fc from franchise_configurations where franchise_evolution_instance_id = p_evo;
  if not found then return null; end if;
  select * into f from franchises where evolution_instance_id = p_evo;
  v_ent := coalesce(fc.has_delivery, false);
  v_ret := coalesce(fc.has_pickup, false);

  -- chave da Maxi (freio de emergência) desligada para a unidade
  if not public.feature_flag_enabled('cardapio_digital', p_evo) then
    v := v || jsonb_build_object('id', 'chave', 'nivel', 'trava', 'ok', false, 'titulo', 'Cardápio pausado pela Maxi',
      'motivo', 'A Maxi pausou o cardápio desta unidade. Fale com a Maxi para voltar.', 'falta', 'a Maxi liberar o cardápio de novo');
  end if;
  if f.status is distinct from 'active' or coalesce(f.is_test, false) then
    v := v || jsonb_build_object('id', 'unidade', 'nivel', 'trava', 'ok', false, 'titulo', 'Unidade ativa',
      'motivo', 'O cardápio só funciona para unidade ativa no cadastro da Maxi.', 'falta', 'a unidade estar ativa no cadastro da Maxi');
  end if;

  v_ok := nullif(regexp_replace(coalesce(f.whatsapp_publico, ''), '\D', '', 'g'), '') is not null;
  -- 10i: sem número, mas com o robô conectado (Zuck) num número que não é o celular do responsável = oferece usar o do robô
  v_robo := case when not v_ok then public.cardapio_robo_whatsapp(p_evo) end;
  v := v || jsonb_build_object('id', 'whatsapp', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'WhatsApp da unidade',
    'motivo', case when v_ok then 'É para esse número que o pedido do cliente vai.'
                   when v_robo is not null then 'Sem ele o cardápio não tem para onde mandar o pedido. Dá para usar o número do robô, que já está conectado.'
                   else 'Sem ele o cardápio não tem para onde mandar o pedido. Quem cadastra é a Maxi.' end,
    'sugestao', case when v_robo is not null then '(' || left(v_robo, 2) || ') ' || substr(v_robo, 3, length(v_robo) - 6) || '-' || right(v_robo, 4) end,
    'falta', case when v_robo is not null then 'o WhatsApp da unidade (toque em Usar o número do robô)' else 'o WhatsApp da unidade (quem cadastra é a Maxi)' end);

  v := v || jsonb_build_object('id', 'modalidade', 'nivel', 'trava', 'ok', v_ent or v_ret, 'titulo', 'Entrega ou retirada ligada',
    'motivo', case when v_ent and v_ret then 'O cliente escolhe entre entrega e retirada.'
                   when v_ent then 'O cardápio oferece só entrega, como está no Meu robô.'
                   when v_ret then 'O cardápio oferece só retirada, como está no Meu robô.'
                   else 'O cardápio só oferece o que estiver ligado no Meu robô, e hoje nada está ligado.' end,
    'falta', 'ligar a entrega ou a retirada no Meu robô');

  if v_ent then
    v_ok := public.cardapio_horario_ok(fc.delivery_schedule, 'delivery_start', 'delivery_end');
    v := v || jsonb_build_object('id', 'horario_entrega', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Dias e horários de entrega',
      'motivo', case when v_ok then 'O cliente escolhe o dia e a faixa de horário. Os dias que ficam de fora são a sua folga.'
                     else 'Sem eles o cliente não tem como escolher quando receber.' end,
      'falta', 'os dias e horários de entrega');
  end if;
  if v_ret then
    v_ok := case when coalesce(fc.has_custom_pickup_hours, false) and jsonb_typeof(fc.pickup_schedule) = 'array' and jsonb_array_length(fc.pickup_schedule) > 0
                 then public.cardapio_horario_ok(fc.pickup_schedule, 'open', 'close')
                 else public.cardapio_horario_ok(fc.delivery_schedule, 'delivery_start', 'delivery_end') end;
    v := v || jsonb_build_object('id', 'horario_retirada', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Dias e horários de retirada',
      'motivo', case when v_ok then 'O cliente escolhe quando vai buscar. Os dias que ficam de fora são a sua folga.'
                     else 'Sem eles o cliente não tem como escolher quando buscar.' end,
      'falta', 'os dias e horários de retirada');
  end if;

  if v_ent then
    v_ok := coalesce(array_length(fc.payment_delivery, 1), 0) > 0;
    v := v || jsonb_build_object('id', 'pagamento_entrega', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Formas de pagamento na entrega',
      'motivo', case when v_ok then 'O cliente escolhe como vai pagar no próprio pedido.'
                     else 'Sem nenhuma marcada, o cliente não tem como escolher como pagar.' end,
      'falta', 'as formas de pagamento na entrega');
  end if;
  if v_ret then
    -- retirada sem forma própria usa as da entrega (mesma regra do cardapio_unidade)
    v_ok := coalesce(array_length(fc.payment_pickup, 1), 0) > 0 or coalesce(array_length(fc.payment_delivery, 1), 0) > 0;
    v := v || jsonb_build_object('id', 'pagamento_retirada', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Formas de pagamento na retirada',
      'motivo', case when v_ok then 'O cliente escolhe como vai pagar no próprio pedido.'
                     else 'Sem nenhuma marcada, o cliente não tem como escolher como pagar.' end,
      'falta', 'as formas de pagamento na retirada');
  end if;

  if v_ent then
    -- a Edge cardapio-frete mede a distância de carro a partir deste endereço (vw_dadosunidade.unit_address)
    v_ok := length(btrim(coalesce(fc.unit_address, ''))) >= 8;
    v := v || jsonb_build_object('id', 'endereco', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Endereço da unidade',
      'motivo', case when v_ok then 'O frete sai da distância de carro entre a unidade e o cliente.'
                     else 'Sem ele o cardápio não calcula o frete.' end,
      'falta', 'o endereço da unidade');

    if fc.delivery_pricing is not null then
      v := v || jsonb_build_object('id', 'frete', 'nivel', 'aviso', 'ok', false, 'titulo', 'Frete por bairro ou por horário',
        'motivo', 'O cardápio não calcula esse tipo de frete: o cliente vê que a unidade confirma o valor no WhatsApp.', 'falta', null);
    else
      select count(*) into v_faixas from jsonb_array_elements(case when jsonb_typeof(fc.delivery_fee_rules) = 'array' then fc.delivery_fee_rules else '[]'::jsonb end) r
       where coalesce(r->>'max_km', '') ~ '^\d+([.,]\d+)?$' and coalesce(r->>'fee', '') ~ '^\d+([.,]\d+)?$';
      v_ok := coalesce(fc.charges_delivery_fee, true) = false or v_faixas > 0;
      v := v || jsonb_build_object('id', 'frete', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Frete por distância',
        'motivo', case when coalesce(fc.charges_delivery_fee, true) = false then 'Entrega sem taxa de frete.'
                       when v_ok then v_faixas || case when v_faixas = 1 then ' faixa de frete por km.' else ' faixas de frete por km.' end
                       else 'Sem as faixas, o cardápio não sabe quanto cobrar de frete.' end,
        'falta', 'as faixas de frete por distância');
      v_raio := fc.max_delivery_radius_km;
      v_ok := coalesce(v_raio, 0) > 0;
      v := v || jsonb_build_object('id', 'raio', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Distância máxima de entrega',
        'motivo', case when v_ok then 'Até ' || regexp_replace(replace(to_char(v_raio, 'FM999990.0'), '.', ','), ',0$', '') || ' km. Mais longe, o cliente vê que dá para retirar ou combinar.'
                       else 'Sem ela, o cardápio não sabe se você entrega no endereço do cliente.' end,
        'falta', 'a distância máxima de entrega');
    end if;
  end if;

  -- produtos: à venda = preço > 0, ativo, visível no cardápio e com estoque
  select count(*) filter (where i.quantity > 0),
         count(*) filter (where i.quantity > 0 or (i.quantity is not null and i.quantity <= 0
                                                   and coalesce(i.zerado_desde, i.updated_at) >= now() - interval '30 days')),
         count(*) filter (where i.quantity is not null and i.quantity <= 0 and coalesce(i.zerado_desde, i.updated_at) >= now() - interval '30 days')
    into v_estoque, v_aparecem, v_zerados
    from inventory_items i
   where i.franchise_id = p_evo and coalesce(i.active, true) is not false and i.sale_price > 0 and coalesce(i.cardapio_visivel, true);
  v_controla := v_estoque > 0;
  v_ok := v_estoque >= 5;
  v := v || jsonb_build_object('id', 'produtos', 'nivel', 'trava', 'ok', v_ok, 'titulo', 'Pelo menos 5 produtos com preço e estoque',
    'motivo', case when v_ok then v_estoque || ' produtos à venda, com o preço e o estoque do seu Estoque.'
                   when v_estoque = 0 then 'Nenhum produto com estoque agora. O cardápio mostra o que está no seu Estoque.'
                   else 'Hoje são ' || v_estoque || '. Com menos de 5, o cliente quase não tem o que escolher.' end,
    'falta', 'ter pelo menos 5 produtos com preço e estoque');
  if v_controla and v_aparecem > 0 then
    v_ok := v_zerados::numeric / v_aparecem < 0.4;
    v := v || jsonb_build_object('id', 'em_falta', 'nivel', 'aviso', 'ok', v_ok,
      'titulo', case when v_ok then 'Estoque sem muita coisa em falta' else 'Muitos produtos em falta' end,
      'motivo', case when v_zerados = 0 then 'Nenhum produto em falta.'
                     else v_zerados || ' de ' || v_aparecem || ' produtos estão em falta: o cliente vê "Em falta" e não consegue pedir.' end,
      'falta', null);
  end if;

  -- robô: respondeu alguém nos últimos 3 dias (é ele quem manda o link a quem conversa; o cardápio funciona sem ele)
  v_ok := exists (select 1 from conversation_messages m
                   where m.franchise_id = p_evo and m.direction = 'out' and m.created_at > now() - interval '3 days');
  v := v || jsonb_build_object('id', 'robo', 'nivel', 'aviso', 'ok', v_ok, 'titulo', 'Robô respondendo',
    'motivo', case when v_ok then 'O robô manda o link do cardápio a quem conversa com ele.'
                   else 'O robô não respondeu ninguém nos últimos 3 dias. O cardápio funciona sem ele (o pedido chega no seu WhatsApp), mas é ele quem manda o link a quem conversa.' end,
    'falta', null);
  -- 10k: nenhum item sai com ok nulo (nulo = não está em dia)
  return (select jsonb_agg(c || jsonb_build_object('ok', coalesce((c->>'ok')::boolean, false)) order by o)
            from jsonb_array_elements(v) with ordinality x(c, o));
end;
$function$
;
