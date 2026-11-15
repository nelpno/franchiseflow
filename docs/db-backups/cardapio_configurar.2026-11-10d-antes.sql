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
begin
  if not public.cardapio_pode(p_evo, true) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
    raise exception 'pedido inválido' using errcode = '22023';
  end if;
  -- desligar ({ativo:false}) NUNCA é recusado (revisão 10/11/2026); o resto pede a chave cardapio_digital
  if not v_admin and not public.feature_flag_enabled('cardapio_digital', p_evo) and p_campos <> '{"ativo": false}'::jsonb then
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

  if p_campos ? 'promocao_regras' then
    -- a validação (e o texto do robô) fica no trigger franchise_configurations_promocao_texto
    update franchise_configurations set promocao_regras = p_campos->'promocao_regras' where id = v_fc.id;
  end if;

  return public.cardapio_painel(p_evo);
end;
$function$
;
