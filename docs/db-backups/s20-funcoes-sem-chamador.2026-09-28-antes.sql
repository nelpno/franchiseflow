-- Backup das 9 funções sem chamador (corpo vivo + dono + permissões), antes do DROP da S20.2.
-- Reaplicar este arquivo = recriar todas.

-- deduct_inventory(p_franchise_id text, p_items jsonb) · dono postgres · md5(prosrc) 82c273c93fe16a52460f083cb9ef8085
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_franchise_id text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_name TEXT, quantity NUMERIC)
  LOOP
    UPDATE inventory_items
    SET quantity = GREATEST(quantity - item.quantity, 0),
        updated_at = now()
    WHERE franchise_id = p_franchise_id
      AND product_name = item.product_name;
  END LOOP;
END;
$function$
;

alter function public.deduct_inventory(p_franchise_id text, p_items jsonb) owner to postgres;
revoke all on function public.deduct_inventory(p_franchise_id text, p_items jsonb) from public;
grant execute on function public.deduct_inventory(p_franchise_id text, p_items jsonb) to postgres;
grant execute on function public.deduct_inventory(p_franchise_id text, p_items jsonb) to service_role;

-- get_bot_conversation_summary(p_since timestamp with time zone) · dono postgres · md5(prosrc) 380b4973cd7d7a96c964097830b73e90
CREATE OR REPLACE FUNCTION public.get_bot_conversation_summary(p_since timestamp with time zone DEFAULT (now() - '90 days'::interval))
 RETURNS TABLE(franchise_id text, day date, total bigint, converted bigint, abandoned bigint, ongoing bigint, autonomous bigint, with_human_msgs bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin_or_manager() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  return query
  with human_convos as (
    select distinct cm.conversation_id
    from public.conversation_messages cm
    where cm.direction = 'human'
      and cm.created_at >= p_since
      and cm.conversation_id is not null
  )
  select
    bc.franchise_id,
    bc.started_at::date as day,
    count(*) as total,
    count(*) filter (where bc.outcome = 'converted' or bc.status = 'converted') as converted,
    count(*) filter (where bc.outcome = 'abandoned' or bc.status = 'abandoned') as abandoned,
    count(*) filter (
      where bc.outcome = 'ongoing'
      or (bc.outcome is null and bc.status = 'started' and bc.updated_at >= now() - interval '24 hours')
    ) as ongoing,
    count(*) filter (where hc.conversation_id is null) as autonomous,
    count(*) filter (where hc.conversation_id is not null) as with_human_msgs
  from public.vw_bot_conversations bc
  left join human_convos hc on hc.conversation_id = bc.id
  where bc.started_at >= p_since
  group by bc.franchise_id, bc.started_at::date;
end;
$function$
;

alter function public.get_bot_conversation_summary(p_since timestamp with time zone) owner to postgres;
revoke all on function public.get_bot_conversation_summary(p_since timestamp with time zone) from public;
grant execute on function public.get_bot_conversation_summary(p_since timestamp with time zone) to postgres;
grant execute on function public.get_bot_conversation_summary(p_since timestamp with time zone) to authenticated;
grant execute on function public.get_bot_conversation_summary(p_since timestamp with time zone) to service_role;

-- get_bot_leads_daily(p_since date) · dono postgres · md5(prosrc) 237c3f60920aa271001abceb33a510b5
CREATE OR REPLACE FUNCTION public.get_bot_leads_daily(p_since date DEFAULT (CURRENT_DATE - 90))
 RETURNS TABLE(day date, total_count bigint, ongoing_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    (started_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS day,
    count(*) AS total_count,
    count(*) FILTER (WHERE outcome = 'ongoing') AS ongoing_count
  FROM bot_conversations
  WHERE started_at >= p_since
    AND status NOT IN ('manual_sale', 'duplicate_stale')
  GROUP BY day;
$function$
;

alter function public.get_bot_leads_daily(p_since date) owner to postgres;
revoke all on function public.get_bot_leads_daily(p_since date) from public;
grant execute on function public.get_bot_leads_daily(p_since date) to public;
grant execute on function public.get_bot_leads_daily(p_since date) to postgres;
grant execute on function public.get_bot_leads_daily(p_since date) to anon;
grant execute on function public.get_bot_leads_daily(p_since date) to authenticated;
grant execute on function public.get_bot_leads_daily(p_since date) to service_role;

-- get_contact_by_phone(p_franchise_id text, p_telefone text) · dono postgres · md5(prosrc) 0656b1e4f7195d19f649cca28446bd23
CREATE OR REPLACE FUNCTION public.get_contact_by_phone(p_franchise_id text, p_telefone text)
 RETURNS TABLE(id uuid, nome text, telefone text, endereco text, bairro text, status text, purchase_count integer, total_spent numeric, last_purchase_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_phone text := public.normalize_phone_br(p_telefone);
BEGIN
  IF v_phone IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro,
         c.status, c.purchase_count, c.total_spent, c.last_purchase_at
  FROM contacts c
  WHERE c.franchise_id = p_franchise_id AND c.telefone = v_phone;
END; $function$
;

alter function public.get_contact_by_phone(p_franchise_id text, p_telefone text) owner to postgres;
revoke all on function public.get_contact_by_phone(p_franchise_id text, p_telefone text) from public;
grant execute on function public.get_contact_by_phone(p_franchise_id text, p_telefone text) to postgres;
grant execute on function public.get_contact_by_phone(p_franchise_id text, p_telefone text) to service_role;

-- get_human_message_counts(p_since timestamp with time zone) · dono postgres · md5(prosrc) 7bdd09294dd1a6886b2e3c75dd7ef15a
CREATE OR REPLACE FUNCTION public.get_human_message_counts(p_since timestamp with time zone DEFAULT (now() - '90 days'::interval))
 RETURNS TABLE(conversation_id uuid, franchise_id text, msg_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT conversation_id, franchise_id, count(*) as msg_count
  FROM conversation_messages
  WHERE direction = 'human' AND created_at >= p_since
  GROUP BY conversation_id, franchise_id;
$function$
;

alter function public.get_human_message_counts(p_since timestamp with time zone) owner to postgres;
revoke all on function public.get_human_message_counts(p_since timestamp with time zone) from public;
grant execute on function public.get_human_message_counts(p_since timestamp with time zone) to public;
grant execute on function public.get_human_message_counts(p_since timestamp with time zone) to postgres;
grant execute on function public.get_human_message_counts(p_since timestamp with time zone) to anon;
grant execute on function public.get_human_message_counts(p_since timestamp with time zone) to authenticated;
grant execute on function public.get_human_message_counts(p_since timestamp with time zone) to service_role;

-- get_human_message_totals(p_since timestamp with time zone) · dono postgres · md5(prosrc) 93bb128bbb5b6b2d53220e9e94f9e519
CREATE OR REPLACE FUNCTION public.get_human_message_totals(p_since timestamp with time zone DEFAULT (now() - '90 days'::interval))
 RETURNS TABLE(franchise_id text, msg_count bigint, conv_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin_or_manager() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  return query
  select
    cm.franchise_id,
    count(*) as msg_count,
    count(distinct cm.conversation_id) as conv_count
  from public.conversation_messages cm
  where cm.direction = 'human'
    and cm.created_at >= p_since
  group by cm.franchise_id;
end;
$function$
;

alter function public.get_human_message_totals(p_since timestamp with time zone) owner to postgres;
revoke all on function public.get_human_message_totals(p_since timestamp with time zone) from public;
grant execute on function public.get_human_message_totals(p_since timestamp with time zone) to postgres;
grant execute on function public.get_human_message_totals(p_since timestamp with time zone) to authenticated;
grant execute on function public.get_human_message_totals(p_since timestamp with time zone) to service_role;

-- get_network_touch_ranking(p_start date, p_end date) · dono postgres · md5(prosrc) a4470c2856c1381baf525dba81bae2f7
CREATE OR REPLACE FUNCTION public.get_network_touch_ranking(p_start date, p_end date)
 RETURNS TABLE(franchise_id text, franchise_name text, city text, pessoas integer, com_toque integer, toque_pct numeric, faturamento numeric, rs_por_pessoa numeric, pos_toque integer, pos_rs integer, total_no_ranking integer, amostra_pequena boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with conv as (
  select c.franchise_id as fid, cm.conversation_id as cid,
    min(cm.created_at) filter (where cm.direction = 'in')    as primeira_do_cliente,
    max(cm.created_at) filter (where cm.direction = 'human') as ultima_humana
  from conversation_messages cm
  join bot_conversations c on c.id = cm.conversation_id
  where cm.created_at >= (p_start::timestamp at time zone 'America/Sao_Paulo')
    and cm.created_at <  ((p_end + 1)::timestamp at time zone 'America/Sao_Paulo')
  group by 1, 2
),
agg as (
  select fid,
    count(*)::int as pessoas,
    count(*) filter (where ultima_humana > primeira_do_cliente)::int as com_toque
  from conv where primeira_do_cliente is not null group by fid
),
ven as (
  select franchise_id as fid,
    sum(value - coalesce(discount_amount,0) + coalesce(delivery_fee,0)) as rec
  from sales where sale_date between p_start and p_end group by 1
),
base as (
  select f.evolution_instance_id as fid, f.name, f.city,
    a.pessoas, a.com_toque,
    round(100.0 * a.com_toque / nullif(a.pessoas,0), 1) as toque_pct,
    coalesce(v.rec, 0) as rec,
    round(coalesce(v.rec,0) / nullif(a.pessoas,0), 2) as rs_pes,
    (a.pessoas < 50) as pequena
  from agg a
  join franchises f on f.evolution_instance_id = a.fid
  left join ven v on v.fid = a.fid
  where f.name not ilike '%teste%' and not f.is_test
)
select fid, name, city, pessoas, com_toque, toque_pct, rec, rs_pes,
  -- posicao so entre quem tem amostra suficiente; abaixo de 50 pessoas nao ranqueia
  case when not pequena then rank() over (partition by pequena order by toque_pct desc)::int end,
  case when not pequena then rank() over (partition by pequena order by rs_pes  desc)::int end,
  case when not pequena then count(*) filter (where not pequena) over ()::int end,
  pequena
from base
order by pequena, rs_pes desc nulls last;
$function$
;

alter function public.get_network_touch_ranking(p_start date, p_end date) owner to postgres;
revoke all on function public.get_network_touch_ranking(p_start date, p_end date) from public;
grant execute on function public.get_network_touch_ranking(p_start date, p_end date) to postgres;
grant execute on function public.get_network_touch_ranking(p_start date, p_end date) to service_role;

-- update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text) · dono postgres · md5(prosrc) 1342783328772bbddfbf806691d4b0ce
CREATE OR REPLACE FUNCTION public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE contacts
  SET
    endereco = p_endereco,
    bairro = COALESCE(p_bairro, contacts.bairro),
    updated_at = NOW()
  WHERE id = p_contact_id;
$function$
;

alter function public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text) owner to postgres;
revoke all on function public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text) from public;
grant execute on function public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text) to postgres;
grant execute on function public.update_contact_address(p_contact_id uuid, p_endereco text, p_bairro text) to service_role;

-- upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text) · dono postgres · md5(prosrc) 680c255e5ebf75a8af2ca42b1906b4de
CREATE OR REPLACE FUNCTION public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_phone text := public.normalize_phone_br(p_telefone);
BEGIN
  IF v_phone IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_contact_id FROM contacts
  WHERE franchise_id = p_franchise_id AND telefone = v_phone;

  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_at = NOW(),
        nome = CASE
          WHEN contacts.nome IS NULL OR contacts.nome = '' THEN COALESCE(p_nome, '')
          ELSE contacts.nome
        END,
        updated_at = NOW()
    WHERE id = v_contact_id;
    RETURN v_contact_id;
  ELSE
    INSERT INTO contacts (franchise_id, telefone, nome, status, source, last_contact_at)
    VALUES (p_franchise_id, v_phone, COALESCE(p_nome, ''), 'novo_lead', 'bot', NOW())
    RETURNING id INTO v_contact_id;
    RETURN v_contact_id;
  END IF;
END; $function$
;

alter function public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text) owner to postgres;
revoke all on function public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text) from public;
grant execute on function public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text) to postgres;
grant execute on function public.upsert_bot_contact(p_franchise_id text, p_telefone text, p_nome text) to service_role;
