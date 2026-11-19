-- Vigia de saude dos robos (P8-2, 04/10/2026). So leitura; quem chama e o
-- vigia-robos-maxi.mjs do Copiloto (nelsonnet), com a service role.
-- Limiares medidos em 35 dias de conversation_messages (ver o cabecalho do .mjs).
create or replace function public.vigia_robos_sinais()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with uni as (
  select f.evolution_instance_id inst, f.name nome, v.zuck_instance_name zuck
  from franchises f
  left join vw_dadosunidade v on v.franchise_evolution_instance_id = f.evolution_instance_id
  where f.status = 'active' and not coalesce(f.is_test, false)
),
ult as (
  select franchise_id inst, max(created_at) filter (where direction = 'out') ultima_resposta
  from conversation_messages
  where created_at > now() - interval '60 days'
  group by 1
),
rede as (
  select count(*) filter (where direction = 'in') entrou, count(*) filter (where direction = 'out') respondeu
  from conversation_messages where created_at > now() - interval '60 minutes'
),
mudos as (
  select franchise_id inst, count(*) filter (where direction = 'in') entrou,
         count(distinct contact_phone) filter (where direction = 'in') contatos
  from conversation_messages where created_at > now() - interval '2 hours'
  group by 1
  having count(*) filter (where direction = 'in') >= 8
     and count(distinct contact_phone) filter (where direction = 'in') >= 3
     and count(*) filter (where direction in ('out', 'human')) = 0
),
loops as (
  select franchise_id inst, right(contact_phone, 4) fim, count(*) respostas
  from conversation_messages
  where created_at > now() - interval '60 minutes' and direction = 'out'
  group by franchise_id, contact_phone
  having count(*) >= 30
),
freio as (
  select id::text, franchise_id inst, coalesce(label, '') label, created_at
  from bot_blocked_numbers
  where source = 'auto_loop' and created_at > now() - interval '24 hours'
),
cad as (
  select u.inst,
    (coalesce(trim(fc.pix_key_data), '') = ''
      and (fc.accepted_payment_methods ilike '%pix%'
           or 'pix' = any(coalesce(fc.payment_delivery, '{}'))
           or 'pix' = any(coalesce(fc.payment_pickup, '{}')))) sem_pix,
    (not coalesce(fc.has_delivery, false) and not coalesce(fc.has_pickup, false)) sem_modalidade,
    (coalesce(nullif(trim(fc.street_address), ''), nullif(trim(fc.unit_address), '')) is null) sem_endereco,
    (fc.operating_hours is null and coalesce(trim(fc.opening_hours), '') = '') sem_horario,
    not exists (select 1 from inventory_items i where i.franchise_id = u.inst and i.quantity > 0) sem_estoque
  from uni u left join franchise_configurations fc on fc.franchise_evolution_instance_id = u.inst
)
select jsonb_build_object(
  'agora', now(),
  'unidades', (select coalesce(jsonb_agg(jsonb_build_object('inst', u.inst, 'nome', u.nome, 'zuck', u.zuck,
                 'ultima_resposta', ult.ultima_resposta) order by u.nome), '[]')
               from uni u left join ult using (inst)),
  'rede', (select to_jsonb(rede) from rede),
  'mudos', (select coalesce(jsonb_agg(to_jsonb(mudos)), '[]') from mudos),
  'loops', (select coalesce(jsonb_agg(to_jsonb(loops)), '[]') from loops),
  'freio', (select coalesce(jsonb_agg(to_jsonb(freio)), '[]') from freio),
  'cadastro', (select coalesce(jsonb_agg(to_jsonb(cad)), '[]') from cad
               where sem_pix or sem_modalidade or sem_endereco or sem_horario or sem_estoque)
);
$$;

revoke execute on function public.vigia_robos_sinais() from public, anon, authenticated;
grant execute on function public.vigia_robos_sinais() to service_role;
