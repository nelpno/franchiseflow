CREATE OR REPLACE FUNCTION public.franchise_configurations_guarda_cardapio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  -- SQL direto (sem claims, MCP/cron/emergência) passa tudo
  if v_claims is null then
    return new;
  end if;
  -- slug divulgado não muda pela API, nem pelo admin nem pela service role (10f)
  if tg_op = 'UPDATE' and old.cardapio_primeira_vez_em is not null then
    new.cardapio_primeira_vez_em := old.cardapio_primeira_vez_em;
    -- 10k: congela só o slug que EXISTE (sem slug, ele ainda pode nascer dentro da cardapio_configurar)
    if old.cardapio_digital_slug is not null then
      new.cardapio_digital_slug := old.cardapio_digital_slug;
    end if;
  end if;
  if v_claims::jsonb ->> 'role' = 'service_role' or coalesce((select public.is_admin_or_manager()), false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- franqueada criando a configuração: cardápio nasce sem link, desligado e sem promoção estruturada
    new.cardapio_digital_slug := null;
    new.cardapio_digital_ativo := false;
    new.cardapio_link_bio_em := null;
    new.promocao_regras := '[]'::jsonb;
    new.promotions_combo_manual := null;
    new.cardapio_entrega_pausa_ate := null;
    new.cardapio_primeira_vez_em := null;
    new.cardapio_ativo_mudou_em := null;
    new.promocao_cliente := null;
    new.cupom_regras := '{}'::jsonb;
    return new;
  end if;
  if coalesce(current_setting('maxi.cardapio_rpc', true), '') = '1' then
    -- dentro da cardapio_configurar: o slug só pode NASCER (de null para o gerado); trocar, nunca
    if old.cardapio_digital_slug is not null then
      new.cardapio_digital_slug := old.cardapio_digital_slug;
    end if;
    return new;
  end if;
  new.cardapio_digital_slug := old.cardapio_digital_slug;
  new.cardapio_digital_ativo := old.cardapio_digital_ativo;
  new.cardapio_link_bio_em := old.cardapio_link_bio_em;
  new.promocao_regras := old.promocao_regras;
  new.promotions_combo_manual := old.promotions_combo_manual;
  new.cardapio_entrega_pausa_ate := old.cardapio_entrega_pausa_ate;
  new.cardapio_primeira_vez_em := old.cardapio_primeira_vez_em;
  new.cardapio_ativo_mudou_em := old.cardapio_ativo_mudou_em;
  new.promocao_cliente := old.promocao_cliente;
  new.cupom_regras := old.cupom_regras;
  return new;
end;
$function$;
