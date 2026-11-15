-- corpo vivo antes da abertura do cardápio para a rede (10/11/2026). Reaplicar = voltar.
CREATE OR REPLACE FUNCTION public.cardapio_configurar(p_evo text, p_campos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin boolean := coalesce((select public.is_admin_or_manager())
                     or nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role', false);
  v_fc franchise_configurations%rowtype;
  v_wa text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ate timestamptz;
begin
  if not public.cardapio_pode(p_evo, true) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
    raise exception 'pedido inválido' using errcode = '22023';
  end if;
  -- desligar ({ativo:false}) e pausar a entrega ({entrega_pausa}) NUNCA são recusados; o resto pede a chave cardapio_digital
  if not v_admin and not public.feature_flag_enabled('cardapio_digital', p_evo) and p_campos <> '{"ativo": false}'::jsonb
     and (p_campos - 'entrega_pausa') <> '{}'::jsonb then
    raise exception 'O cardápio digital ainda não está liberado para a sua unidade.' using errcode = '42501';
  end if;
  -- libera o trigger franchise_configurations_guarda_cardapio só dentro desta transação (gravação direta é recusada calada)
  perform set_config('maxi.cardapio_rpc', '1', true);
  select * into v_fc from franchise_configurations where franchise_evolution_instance_id = p_evo for update;
  if not found then
    raise exception 'unidade sem configuração' using errcode = 'P0002';
  end if;

  if p_campos ? 'ativo' then
    if jsonb_typeof(p_campos->'ativo') <> 'boolean' then raise exception 'pedido inválido' using errcode = '22023'; end if;
    if (p_campos->>'ativo')::boolean then
      select nullif(regexp_replace(coalesce(whatsapp_publico, ''), '\D', '', 'g'), '') into v_wa from franchises where evolution_instance_id = p_evo;
      if v_wa is null then
        raise exception 'Falta o WhatsApp público da unidade: o cardápio não tem para onde mandar o pedido.' using errcode = '22023';
      end if;
      if v_fc.cardapio_digital_slug is null then
        raise exception 'O link do seu cardápio ainda não foi criado. Fale com a Maxi.' using errcode = '22023';
      end if;
    end if;
    update franchise_configurations set cardapio_digital_ativo = (p_campos->>'ativo')::boolean where id = v_fc.id;
  end if;

  if p_campos ? 'link_bio' then
    if jsonb_typeof(p_campos->'link_bio') <> 'boolean' then raise exception 'pedido inválido' using errcode = '22023'; end if;
    update franchise_configurations
       set cardapio_link_bio_em = case when (p_campos->>'link_bio')::boolean then coalesce(cardapio_link_bio_em, now()) end
     where id = v_fc.id;
  end if;

  -- v8: pausa da entrega: null = volta agora; "hoje" = até o fim do dia; "HH:MM" = até essa hora de hoje (volta sozinha)
  if p_campos ? 'entrega_pausa' then
    if jsonb_typeof(p_campos->'entrega_pausa') = 'null' then
      v_ate := null;
    elsif p_campos->>'entrega_pausa' = 'hoje' then
      v_ate := (v_hoje + 1)::timestamp at time zone 'America/Sao_Paulo';
    elsif jsonb_typeof(p_campos->'entrega_pausa') = 'string' and p_campos->>'entrega_pausa' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      v_ate := (v_hoje + (p_campos->>'entrega_pausa')::time) at time zone 'America/Sao_Paulo';
      if v_ate <= now() then
        raise exception 'Esse horário já passou. Escolha um horário mais tarde.' using errcode = '22023';
      end if;
    else
      raise exception 'pedido inválido' using errcode = '22023';
    end if;
    update franchise_configurations set cardapio_entrega_pausa_ate = v_ate where id = v_fc.id;
  end if;

  -- v8: prazo da entrega (o mesmo "tempo de entrega" do Meu robô, que o robô também usa)
  if p_campos ? 'entrega_prazo_min' then
    if jsonb_typeof(p_campos->'entrega_prazo_min') <> 'number' or (p_campos->>'entrega_prazo_min')::numeric not between 15 and 180
       or (p_campos->>'entrega_prazo_min')::numeric <> round((p_campos->>'entrega_prazo_min')::numeric) then
      raise exception 'O prazo da entrega vai de 15 a 180 minutos.' using errcode = '22023';
    end if;
    update franchise_configurations set avg_prep_time_minutes = (p_campos->>'entrega_prazo_min')::int where id = v_fc.id;
  end if;

  if p_campos ? 'promocao_regras' then
    -- a validação (e o texto do robô) fica no trigger franchise_configurations_promocao_texto
    update franchise_configurations set promocao_regras = p_campos->'promocao_regras' where id = v_fc.id;
  end if;

  return public.cardapio_painel(p_evo);
end;
$function$
;
