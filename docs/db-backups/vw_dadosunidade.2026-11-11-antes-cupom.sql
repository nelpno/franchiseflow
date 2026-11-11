-- pg_get_viewdef(vw_dadosunidade) em 11/11/2026 antes de cupom_ativo; md5 bb8c9e195c19ebca160464e0b3692a8e
-- voltar: create or replace NAO remove coluna; ver ROLLBACK em site/pedido/supabase/2026-11-11b-cupom.sql
create or replace view public.vw_dadosunidade with (security_invoker = true) as
 SELECT id,
    franchise_evolution_instance_id AS instance_name,
    franchise_evolution_instance_id,
    COALESCE(whatsapp_instance_id, franchise_evolution_instance_id) AS zuck_instance_name,
    COALESCE(franchise_name, ''::text) AS franchise_name,
    COALESCE(unit_address, ''::text) AS unit_address,
    COALESCE(street_address, ''::text) AS street_address,
    COALESCE(cep, ''::text) AS cep,
    COALESCE(address_reference, ''::text) AS address_reference,
    COALESCE(city, ''::text) AS city,
    COALESCE(neighborhood, ''::text) AS neighborhood,
    COALESCE(personal_phone_for_summary, ''::text) AS personal_phone_for_summary,
        CASE
            WHEN COALESCE(personal_phone_for_summary, ''::text) = ''::text THEN ''::text
            WHEN regexp_replace(personal_phone_for_summary, '\D'::text, ''::text, 'g'::text) ~~ '55%'::text AND length(regexp_replace(personal_phone_for_summary, '\D'::text, ''::text, 'g'::text)) = 13 THEN regexp_replace(personal_phone_for_summary, '\D'::text, ''::text, 'g'::text)
            ELSE '55'::text || regexp_replace(personal_phone_for_summary, '\D'::text, ''::text, 'g'::text)
        END AS personal_phone_wa,
    COALESCE(working_days, ''::text) AS working_days,
    COALESCE(opening_hours, ''::text) AS opening_hours,
    COALESCE(delivery_schedule, '[]'::jsonb) AS delivery_schedule,
        CASE
            WHEN delivery_schedule IS NOT NULL AND delivery_schedule <> '[]'::jsonb AND jsonb_typeof(delivery_schedule) = 'array'::text AND jsonb_array_length(delivery_schedule) > 0 THEN ( SELECT string_agg((((((lbl.label || ': '::text) || COALESCE(grp.value ->> 'delivery_start'::text, ''::text)) || '-'::text) || COALESCE(grp.value ->> 'delivery_end'::text, ''::text)) ||
                    CASE
                        WHEN ((grp.value ->> 'charges_fee'::text)::boolean) = false THEN ' (frete gratis)'::text
                        WHEN (grp.value -> 'fee_rules'::text) IS NOT NULL AND (grp.value -> 'fee_rules'::text) <> '[]'::jsonb AND (grp.value -> 'fee_rules'::text) <> 'null'::jsonb THEN ' | Frete: '::text ||
                        CASE
                            WHEN (grp.value -> 'fee_rules'::text) ? 'mode'::text AND ((grp.value -> 'fee_rules'::text) ->> 'mode'::text) = 'modality'::text THEN COALESCE(( SELECT string_agg(((r.value ->> 'label'::text) || ': R$'::text) || replace(to_char(NULLIF(r.value ->> 'fee'::text, ''::text)::numeric, 'FM999G990D00'::text), '.'::text, ','::text), ', '::text) AS string_agg
                               FROM jsonb_array_elements((grp.value -> 'fee_rules'::text) -> 'rules'::text) r(value)
                              WHERE NULLIF(r.value ->> 'label'::text, ''::text) IS NOT NULL AND NULLIF(r.value ->> 'fee'::text, ''::text) IS NOT NULL), ''::text)
                            ELSE COALESCE(( SELECT string_agg((('Ate '::text || (r.value ->> 'max_km'::text)) || 'km: R$'::text) || replace(to_char(NULLIF(r.value ->> 'fee'::text, ''::text)::numeric, 'FM999G990D00'::text), '.'::text, ','::text), ', '::text ORDER BY (NULLIF(r.value ->> 'max_km'::text, ''::text)::numeric)) AS string_agg
                               FROM jsonb_array_elements(grp.value -> 'fee_rules'::text) r(value)
                              WHERE NULLIF(r.value ->> 'max_km'::text, ''::text) IS NOT NULL AND NULLIF(r.value ->> 'fee'::text, ''::text) IS NOT NULL), ''::text)
                        END
                        ELSE ''::text
                    END) ||
                    CASE
                        WHEN NULLIF(grp.value ->> 'order_cutoff'::text, ''::text) IS NULL THEN ''::text
                        WHEN jsonb_array_length(fc.delivery_schedule) > 1 THEN (((' | SO '::text || lbl.label) || ': pedido ate '::text) || (grp.value ->> 'order_cutoff'::text)) || ' (apos, fica pro proximo dia desta faixa; nao vale pros outros dias)'::text
                        ELSE (' | Pedido ate '::text || (grp.value ->> 'order_cutoff'::text)) || ' (apos, a entrega fica pro proximo dia disponivel)'::text
                    END, ' | '::text) AS string_agg
               FROM jsonb_array_elements(fc.delivery_schedule) grp(value)
                 CROSS JOIN LATERAL ( SELECT COALESCE(
                            CASE
                                WHEN jsonb_array_length(grp.value -> 'days'::text) = 7 THEN 'Todos os dias'::text
                                WHEN jsonb_array_length(grp.value -> 'days'::text) = 1 THEN upper("left"((grp.value -> 'days'::text) ->> 0, 1)) || SUBSTRING((grp.value -> 'days'::text) ->> 0 FROM 2)
                                ELSE ( SELECT string_agg(upper("left"(d.val, 1)) || SUBSTRING(d.val FROM 2), ', '::text) AS string_agg
                                   FROM jsonb_array_elements_text(grp.value -> 'days'::text) d(val))
                            END, 'Geral'::text) AS label) lbl)
            ELSE ''::text
        END AS delivery_schedule_text,
        CASE
            WHEN COALESCE(NULLIF(accepted_payment_methods, ''::text), NULL::text) IS NOT NULL THEN accepted_payment_methods
            WHEN COALESCE(payment_delivery, '{}'::text[]) <> '{}'::text[] OR COALESCE(payment_pickup, '{}'::text[]) <> '{}'::text[] THEN ( SELECT array_to_string(ARRAY( SELECT DISTINCT unnest(array_cat(COALESCE(fc.payment_delivery, '{}'::text[]), COALESCE(fc.payment_pickup, '{}'::text[]))) AS unnest), ', '::text) AS array_to_string)
            ELSE ''::text
        END AS accepted_payment_methods,
    COALESCE(payment_delivery, '{}'::text[]) AS payment_delivery,
    COALESCE(payment_pickup, '{}'::text[]) AS payment_pickup,
    COALESCE(pix_key_type, ''::text) AS pix_key_type,
    COALESCE(pix_key_data, ''::text) AS pix_key_data,
    COALESCE(pix_holder_name, ''::text) AS pix_holder_name,
    COALESCE(pix_bank, ''::text) AS pix_bank,
    COALESCE(payment_link, ''::text) AS payment_link,
    COALESCE(has_delivery, true) AS has_delivery,
    COALESCE(has_pickup, false) AS has_pickup,
    COALESCE(delivery_method, ''::text) AS delivery_method,
    COALESCE(charges_delivery_fee, true) AS charges_delivery_fee,
    max_delivery_radius_km,
    min_order_value,
    avg_prep_time_minutes,
        CASE
            WHEN delivery_fee_rules ? 'mode'::text THEN delivery_fee_rules
            ELSE COALESCE(delivery_fee_rules, '[]'::jsonb)
        END AS delivery_fee_rules,
        CASE
            WHEN COALESCE(charges_delivery_fee, true) = false THEN 'Entrega gratis'::text
            WHEN COALESCE(NULLIF(shipping_rules_costs, ''::text), NULL::text) IS NOT NULL THEN shipping_rules_costs
            WHEN delivery_fee_rules ? 'mode'::text AND (delivery_fee_rules ->> 'mode'::text) = 'modality'::text THEN ( SELECT string_agg(((rule.value ->> 'label'::text) || ': R$'::text) || replace(to_char(NULLIF(rule.value ->> 'fee'::text, ''::text)::numeric, 'FM999G990D00'::text), '.'::text, ','::text), ' | '::text) AS string_agg
               FROM jsonb_array_elements(fc.delivery_fee_rules -> 'rules'::text) rule(value)
              WHERE NULLIF(rule.value ->> 'label'::text, ''::text) IS NOT NULL AND NULLIF(rule.value ->> 'fee'::text, ''::text) IS NOT NULL)
            WHEN delivery_fee_rules IS NOT NULL AND jsonb_array_length(COALESCE(delivery_fee_rules, '[]'::jsonb)) > 0 THEN ( SELECT string_agg((('Ate '::text || (rule.value ->> 'max_km'::text)) || 'km: R$'::text) || replace(to_char(NULLIF(rule.value ->> 'fee'::text, ''::text)::numeric, 'FM999G990D00'::text), '.'::text, ','::text), ' | '::text ORDER BY (NULLIF(rule.value ->> 'max_km'::text, ''::text)::numeric)) AS string_agg
               FROM jsonb_array_elements(fc.delivery_fee_rules) rule(value)
              WHERE NULLIF(rule.value ->> 'max_km'::text, ''::text) IS NOT NULL AND NULLIF(rule.value ->> 'fee'::text, ''::text) IS NOT NULL)
            ELSE ''::text
        END AS shipping_rules_costs,
    COALESCE(agent_name, 'Atendente Maxi'::text) AS agent_name,
    COALESCE(bot_personality, 'professional'::text) AS bot_personality,
    COALESCE(welcome_message, ''::text) AS welcome_message,
    COALESCE(promotions_combo, ''::text) AS promotions_combo,
    COALESCE(price_table_url, ''::text) AS price_table_url,
    COALESCE(catalog_image_url, ''::text) AS catalog_image_url,
    COALESCE(social_media_links, '{}'::jsonb) AS social_media_links,
    COALESCE(has_custom_pickup_hours, false) AS has_custom_pickup_hours,
    COALESCE(pickup_schedule, '[]'::jsonb) AS pickup_schedule,
        CASE
            WHEN has_custom_pickup_hours = true AND pickup_schedule IS NOT NULL AND pickup_schedule <> '[]'::jsonb AND jsonb_typeof(pickup_schedule) = 'array'::text AND jsonb_array_length(pickup_schedule) > 0 THEN ( SELECT string_agg((((COALESCE(
                    CASE
                        WHEN jsonb_array_length(grp.value -> 'days'::text) = 7 THEN 'Todos os dias'::text
                        WHEN jsonb_array_length(grp.value -> 'days'::text) = 1 THEN upper("left"((grp.value -> 'days'::text) ->> 0, 1)) || SUBSTRING((grp.value -> 'days'::text) ->> 0 FROM 2)
                        ELSE ( SELECT string_agg(upper("left"(d.val, 1)) || SUBSTRING(d.val FROM 2), ', '::text) AS string_agg
                           FROM jsonb_array_elements_text(grp.value -> 'days'::text) d(val))
                    END, 'Geral'::text) || ': '::text) || COALESCE(grp.value ->> 'open'::text, ''::text)) || '-'::text) || COALESCE(grp.value ->> 'close'::text, ''::text), ' | '::text) AS string_agg
               FROM jsonb_array_elements(fc.pickup_schedule) grp(value))
            WHEN COALESCE(has_pickup, false) = true THEN COALESCE(opening_hours, ''::text)
            ELSE NULL::text
        END AS pickup_hours_text,
    COALESCE(facebook_page_id, ''::text) AS facebook_page_id,
    COALESCE(whatsapp_business_account_id, ''::text) AS whatsapp_business_account_id,
    COALESCE(meta_dataset_id, ''::text) AS meta_dataset_id,
    COALESCE(pickup_requires_scheduling, true) AS pickup_requires_scheduling,
    COALESCE(accepts_reservation_without_payment, false) AS accepts_reservation_without_payment,
    updated_at,
    COALESCE(payment_fees, '{}'::jsonb) AS payment_fees,
    COALESCE(charges_card_fee_to_customer, false) AS charges_card_fee_to_customer,
    COALESCE(pickup_is_store, false) AS pickup_is_store,
    pickup_address,
    delivery_pricing,
    COALESCE(pix_extra_keys, '[]'::jsonb) AS pix_extra_keys,
    COALESCE(pix_por_ferramenta, false) AS pix_por_ferramenta,
        CASE
            WHEN COALESCE(personal_phone_extra, ''::text) = ''::text THEN ''::text
            WHEN regexp_replace(personal_phone_extra, '\D'::text, ''::text, 'g'::text) ~~ '55%'::text AND length(regexp_replace(personal_phone_extra, '\D'::text, ''::text, 'g'::text)) = 13 THEN regexp_replace(personal_phone_extra, '\D'::text, ''::text, 'g'::text)
            ELSE '55'::text || regexp_replace(personal_phone_extra, '\D'::text, ''::text, 'g'::text)
        END AS personal_phone_wa_extra,
    COALESCE(pix_on_delivery, false) AS pix_on_delivery,
    COALESCE(horario_especial, '[]'::jsonb) AS horario_especial,
        CASE
            WHEN cardapio_digital_slug IS NOT NULL AND cardapio_aberto(franchise_evolution_instance_id) THEN ('https://pedido.maximassas.com.br/'::text || cardapio_digital_slug) || '/'::text
            ELSE NULL::text
        END AS cardapio_digital_url,
        CASE
            WHEN COALESCE(has_delivery, true) AND cardapio_entrega_pausa_ate > now() THEN to_char((cardapio_entrega_pausa_ate AT TIME ZONE 'America/Sao_Paulo'::text), 'YYYY-MM-DD"T"HH24:MI'::text)
            ELSE NULL::text
        END AS entrega_pausada_ate,
    COALESCE(pickup_pay_on_pickup, false) AS pickup_pay_on_pickup
   FROM franchise_configurations fc;
