CREATE OR REPLACE FUNCTION public.cardapio_prazo_unidade(p_evo text)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when fc.delivery_pricing is null then nullif(greatest(coalesce(fc.avg_prep_time_minutes, 0), 0), 0)
           -- o cast fica dentro do case: o Postgres não garante a ordem do AND no where ("40.5" não derruba a página)
           else (select nullif(min(case when coalesce(t->>'minutos', '') ~ '^[0-9]{1,4}$' then (t->>'minutos')::int end), 0)
                   from jsonb_array_elements(case when jsonb_typeof(fc.delivery_pricing->'grupos') = 'array' then fc.delivery_pricing->'grupos' else '[]'::jsonb end) g,
                        jsonb_array_elements(case when jsonb_typeof(g->'tipos') = 'array' then g->'tipos' else '[]'::jsonb end) t
                  where jsonb_typeof(g->'dias') = 'array'
                    and g->'dias' ? (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from (now() at time zone 'America/Sao_Paulo'))::int + 1]
                    and t->>'promessa' = 'minutos')
         end
    from franchise_configurations fc where fc.franchise_evolution_instance_id = p_evo
$function$
;
