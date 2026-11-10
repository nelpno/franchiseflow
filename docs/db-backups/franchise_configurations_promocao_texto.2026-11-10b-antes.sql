-- backup do corpo vivo (franchise_configurations_promocao_texto(), md5 prosrc 840aa7854e0155563c684963ab0dbd15); reaplicar = voltar
CREATE OR REPLACE FUNCTION public.franchise_configurations_promocao_texto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_erro text;
  v_tinha boolean := tg_op = 'UPDATE' and jsonb_array_length(coalesce(old.promocao_regras, '[]'::jsonb)) > 0;
  v_tem boolean := jsonb_array_length(coalesce(new.promocao_regras, '[]'::jsonb)) > 0;
begin
  if tg_op = 'INSERT' or new.promocao_regras is distinct from old.promocao_regras then
    v_erro := public.promocao_regras_erro(new.promocao_regras, new.franchise_evolution_instance_id);
    if v_erro is not null then
      raise exception '%', v_erro using errcode = '22023';
    end if;
  end if;
  if v_tem then
    if not v_tinha and new.promotions_combo_manual is null then
      new.promotions_combo_manual := case when tg_op = 'UPDATE' then old.promotions_combo end;
    end if;
    new.promotions_combo := public.promocao_texto(new.promocao_regras, new.franchise_evolution_instance_id);
  elsif v_tinha then
    new.promotions_combo := null;
  end if;
  return new;
end;
$function$
;
