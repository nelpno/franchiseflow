CREATE OR REPLACE FUNCTION public.franchise_configurations_guarda_cardapio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  if v_claims is null or v_claims::jsonb ->> 'role' = 'service_role' or coalesce((select public.is_admin_or_manager()), false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- franqueada criando a configuração: cardápio nasce sem link, desligado e sem promoção estruturada
    new.cardapio_digital_slug := null;
    new.cardapio_digital_ativo := false;
    new.cardapio_link_bio_em := null;
    new.promocao_regras := '[]'::jsonb;
    new.promotions_combo_manual := null;
    return new;
  end if;
  new.cardapio_digital_slug := old.cardapio_digital_slug;
  if coalesce(current_setting('maxi.cardapio_rpc', true), '') = '1' then
    return new;
  end if;
  new.cardapio_digital_ativo := old.cardapio_digital_ativo;
  new.cardapio_link_bio_em := old.cardapio_link_bio_em;
  new.promocao_regras := old.promocao_regras;
  new.promotions_combo_manual := old.promotions_combo_manual;
  return new;
end;
$function$
;
