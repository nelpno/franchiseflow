-- S4.3 (28/09/2026): tira delivery_start_time e order_cutoff_time da vw_dadosunidade.
-- O wizard parou de gravar em 12/09; nenhum workflow ATIVO do n8n cita as colunas (varridos 189);
-- o prompt do V5 lê campos nomeados; a reserva do delivery_schedule_text só valia para unidade sem
-- delivery_schedule, e das 4 nessa condição nenhuma tinha horário velho (texto final idêntico).
-- A vw_unidades_publicas (site) depende da view e é recriada igual, na mesma transação.
-- ROLLBACK: node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/vw_dadosunidade.2026-09-28-antes.sql
-- ACL original: vw_dadosunidade {postgres=arwdDxtm/postgres,authenticated=rm/postgres,service_role=arwdDxtm/postgres} | vw_unidades_publicas {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
begin;
drop view if exists public.vw_unidades_publicas;
drop view if exists public.vw_dadosunidade;
create view public.vw_dadosunidade with (security_invoker = true) as
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
    COALESCE(pix_extra_keys, '[]'::jsonb) AS pix_extra_keys
   FROM franchise_configurations fc;
comment on view public.vw_dadosunidade is $c$Recriar SEMPRE com WITH (security_invoker = true): create or replace view sem o WITH volta a rodar como o dono e reabre leitura e escrita pela chave anon (fix 12/09/2026). | View para vendedor generico n8n (V3 Supabase). Inclui accepts_reservation_without_payment (default false). Uso: SELECT * FROM vw_dadosunidade WHERE instance_name = $instanceName$c$;
revoke all on public.vw_dadosunidade from anon, authenticated;
grant select, maintain on public.vw_dadosunidade to authenticated;
grant all on public.vw_dadosunidade to service_role;
create view public.vw_unidades_publicas with (security_invoker = true) as
 WITH vendas AS (
         SELECT sales.franchise_id,
            count(*) AS n
           FROM sales
          WHERE sales.created_at >= (now() - '60 days'::interval)
          GROUP BY sales.franchise_id
        )
 SELECT v.zuck_instance_name,
    v.franchise_name AS nome,
    NULLIF(btrim(v.city), ''::text) AS cidade,
    NULLIF(btrim(v.neighborhood), ''::text) AS bairro,
    lower(unaccent(COALESCE(btrim(v.neighborhood), ''::text))) AS bairro_ascii,
    lower(unaccent(COALESCE(v.franchise_name, ''::text))) AS nome_ascii,
        CASE
            WHEN o.cidades_atendidas IS NOT NULL AND array_length(o.cidades_atendidas, 1) > 0 THEN ( SELECT array_agg(lower(unaccent(x.x))) AS array_agg
               FROM unnest(o.cidades_atendidas) x(x))
            ELSE ARRAY[lower(unaccent(COALESCE(btrim(v.city), ''::text)))]
        END AS cidades_busca,
        CASE
            WHEN o.cidades_atendidas IS NOT NULL AND array_length(o.cidades_atendidas, 1) > 0 THEN array_to_string(o.cidades_atendidas, ', '::text)
            ELSE NULLIF(btrim(v.city), ''::text)
        END AS cidade_exibida,
    COALESCE(NULLIF(btrim(v.pickup_address), ''::text), NULLIF(btrim(v.unit_address), ''::text), NULLIF(btrim(v.street_address), ''::text)) AS endereco,
    NULLIF(btrim(v.pickup_hours_text), ''::text) AS horario_retirada,
    v.has_pickup,
    v.has_delivery,
    v.pickup_is_store,
    NULLIF(btrim(v.catalog_image_url), ''::text) AS catalogo_url,
    COALESCE(NULLIF(btrim(o.telefone_publico_manual), ''::text), t.telefone_publico) AS telefone_publico,
        CASE
            WHEN NULLIF(btrim(o.telefone_publico_manual), ''::text) IS NOT NULL THEN COALESCE(o.fonte_telefone, 'manual'::text)
            ELSE 'zuckzapgo'::text
        END AS fonte_telefone,
    t.logged_in,
    s.n AS vendas_60d
   FROM vw_dadosunidade v
     JOIN franchises f ON f.evolution_instance_id = v.franchise_evolution_instance_id
     JOIN unidade_telefone_publico t ON t.zuck_instance_name = v.zuck_instance_name
     JOIN vendas s ON s.franchise_id = v.franchise_evolution_instance_id
     LEFT JOIN unidade_locator_override o ON o.zuck_instance_name = v.zuck_instance_name
  WHERE COALESCE(f.is_test, false) = false;
grant all on public.vw_unidades_publicas to anon, authenticated, service_role;
commit;
notify pgrst, 'reload schema';
