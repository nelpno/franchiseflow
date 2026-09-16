-- "Quem chamar hoje" (16-17/09/2026)
-- Lista diaria de clientes para o franqueado chamar no WhatsApp.
-- Plano: ~/.claude/plans/estava-pensando-como-a-scalable-salamander.md
--
-- Ordem de aplicacao:
--   PARTE A (schema + funcoes + triggers)  -> uma migration
--   PARTE B (backup + backfill)            -> execute_sql separado, conferir em query a parte
--
-- Salvar com LF (CRLF injeta \r no prosrc).

-- =====================================================================
-- PARTE A
-- =====================================================================

-- 1. "Nao chamar mais"
alter table public.contacts add column if not exists do_not_contact_at timestamptz;

-- 2. O que o franqueado fez com cada sugestao (1 linha por cliente por dia)
create table if not exists public.contact_actions (
  id uuid primary key default gen_random_uuid(),
  franchise_id text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  action_type text not null
    check (action_type in ('voltou_a_falar','quase_comprou','repetir','primeira_compra','sumido')),
  action_date date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  status text not null check (status in ('sent','skipped')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint contact_actions_contact_day_key unique (contact_id, action_date)
);

create index if not exists contact_actions_franchise_date_idx
  on public.contact_actions (franchise_id, action_date);

alter table public.contact_actions enable row level security;

drop policy if exists contact_actions_select on public.contact_actions;
create policy contact_actions_select on public.contact_actions
  for select using (
    (select is_admin_or_manager())
    or franchise_id = any ((select managed_franchise_ids())::text[])
  );

-- escrita so pela RPC registrar_acao_cliente (sem policy de insert/update)
drop policy if exists contact_actions_delete on public.contact_actions;
create policy contact_actions_delete on public.contact_actions
  for delete using ((select is_admin()));

grant select on table public.contact_actions to anon, authenticated;
grant delete on table public.contact_actions to authenticated;
grant select, insert, update, delete on table public.contact_actions to service_role;

-- 3. Registrar / desfazer uma acao (p_status null = desfazer a de hoje)
create or replace function public.registrar_acao_cliente(
  p_contact_id uuid,
  p_action_type text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fid  text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select c.franchise_id into v_fid from public.contacts c where c.id = p_contact_id;
  if v_fid is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  -- "is not true": helper que devolve NULL nunca libera
  if (public.is_admin_or_manager() or v_fid = any (public.managed_franchise_ids())) is not true then
    raise exception 'Sem permissão para este cliente.' using errcode = '42501';
  end if;

  if p_status is null then
    delete from contact_actions a
     where a.contact_id = p_contact_id and a.action_date = v_hoje;
    return;
  end if;

  insert into contact_actions (franchise_id, contact_id, action_type, action_date, status, created_by)
  values (v_fid, p_contact_id, p_action_type, v_hoje, p_status, auth.uid())
  on conflict (contact_id, action_date) do update
     set action_type = excluded.action_type,
         status      = excluded.status,
         created_by  = excluded.created_by,
         created_at  = now();
end;
$$;

revoke execute on function public.registrar_acao_cliente(uuid, text, text) from public, anon;
grant execute on function public.registrar_acao_cliente(uuid, text, text) to authenticated, service_role;

-- 4. A lista do dia
create or replace function public.get_daily_customer_actions(
  p_franchise_id text,
  p_limit int default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- limites (ajustar depois de medir a adesao)
  c_limite_max      constant int      := 20;
  c_sumido_max      constant int      := 2;           -- sumidos por dia
  c_pausa_dias      constant int      := 7;           -- qualquer acao tira a pessoa da lista por 7 dias
  c_pausa_sumido    constant int      := 30;          -- mensagem a um sumido: 30 dias
  c_janela_conversa constant interval := interval '48 hours';
  c_conversa_parada constant interval := interval '2 hours';
  c_min_msgs        constant int      := 6;           -- "quase comprou"
  c_ritmo_fator     constant numeric  := 1.2;         -- "hora de repetir" = intervalo medio x 1,2
  c_ritmo_min       constant int      := 10;
  c_repetir_max     constant int      := 60;
  c_primeira_de     constant int      := 3;
  c_primeira_ate    constant int      := 5;
  c_sumido_de       constant int      := 31;
  c_sumido_ate      constant int      := 90;
  c_fiel            constant int      := 4;           -- compras para passar na frente em "repetir"

  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes    date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_limit  int  := least(greatest(coalesce(p_limit, 8), 1), c_limite_max);
  v_result jsonb;
begin
  if p_franchise_id is null then
    return null;
  end if;
  if (public.is_admin_or_manager() or p_franchise_id = any (public.managed_franchise_ids())) is not true then
    return null;  -- nunca a lista de outra unidade
  end if;

  with
  contatos as (
    select c.id, c.nome, c.telefone, c.do_not_contact_at
    from contacts c
    where c.franchise_id = p_franchise_id
  ),
  compras as (
    select s.contact_id,
           count(*)::int                    as n,
           count(distinct s.sale_date)::int as n_dias,
           min(s.sale_date)                 as primeira,
           max(s.sale_date)                 as ultima,
           sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)) as total
    from sales s
    where s.franchise_id = p_franchise_id
      and s.contact_id is not null
    group by s.contact_id
  ),
  vendas_recentes as (
    select s.contact_id, s.contact_phone, s.sale_date
    from sales s
    where s.franchise_id = p_franchise_id
      and s.sale_date >= v_hoje - 5
  ),
  -- mensagens das ultimas 48h (bot_conversations.updated_at e mexido por cron, nao serve de relogio)
  msgs as (
    select m.contact_phone,
           max(m.created_at)                                     as ultima_msg,
           max(m.created_at) filter (where m.direction = 'in')   as ultima_do_cliente,
           bool_or(m.direction = 'human')                        as teve_humano
    from conversation_messages m
    where m.franchise_id = p_franchise_id
      and m.created_at >= now() - c_janela_conversa
      and m.contact_phone is not null
    group by m.contact_phone
  ),
  -- conversa viva agora, ou a unidade ja falou com a pessoa: fica fora de TODOS os motivos
  ocupados as (
    select mr.contact_phone
    from msgs mr
    where mr.ultima_msg > now() - c_conversa_parada
       or mr.teve_humano
  ),
  conversas as (
    select distinct on (b.contact_phone)
           b.contact_phone, b.status,
           coalesce(b.messages_count, 0) as msgs,
           (b.started_at at time zone 'America/Sao_Paulo')::date as dia_conversa
    from vw_bot_conversations b
    where b.franchise_id = p_franchise_id
      and b.started_at >= now() - interval '4 days'
      and b.contact_phone is not null
      and b.contact_phone <> ''
    order by b.contact_phone, b.started_at desc
  ),
  -- o cliente escreveu nas ultimas 48h, a conversa nao virou venda e nao ha venda depois dela
  conversas_ok as (
    select cv.contact_phone, cv.msgs, cv.dia_conversa,
           mr.ultima_do_cliente as conversa_em, ct.id as contact_id
    from msgs mr
    join conversas cv on cv.contact_phone = mr.contact_phone
    join contatos ct on ct.telefone = mr.contact_phone
    where mr.ultima_do_cliente is not null
      and cv.status is distinct from 'converted'
      and not exists (
        select 1 from vendas_recentes vr
        where (vr.contact_id = ct.id or vr.contact_phone = cv.contact_phone)
          and vr.sale_date >= cv.dia_conversa
      )
  ),
  candidatos as (
    -- 1. cliente que voltou a falar e nao comprou
    select co.contact_id, 1 as prioridade, 'voltou_a_falar'::text as tipo,
           extract(epoch from co.conversa_em)::numeric as peso, co.conversa_em, co.msgs
    from conversas_ok co
    join compras cp on cp.contact_id = co.contact_id
    where cp.ultima <= co.dia_conversa - 3

    union all
    -- 2. nunca comprou, conversou bastante e parou
    select co.contact_id, 2, 'quase_comprou',
           co.msgs::numeric, co.conversa_em, co.msgs
    from conversas_ok co
    where co.msgs >= c_min_msgs
      and not exists (select 1 from compras cp where cp.contact_id = co.contact_id)

    union all
    -- 3. hora de repetir, no ritmo dele
    select cp.contact_id, 3, 'repetir',
           (case when cp.n_dias >= c_fiel then 1000000000 else 0 end) + coalesce(cp.total, 0),
           null::timestamptz, null::int
    from compras cp
    where cp.n_dias >= 2
      and (v_hoje - cp.ultima) between
            greatest(round(((cp.ultima - cp.primeira)::numeric / (cp.n_dias - 1)) * c_ritmo_fator), c_ritmo_min)
            and c_repetir_max

    union all
    -- 4. primeira compra ha poucos dias
    select cp.contact_id, 4, 'primeira_compra',
           (v_hoje - cp.ultima)::numeric, null, null
    from compras cp
    where cp.n_dias = 1
      and (v_hoje - cp.ultima) between c_primeira_de and c_primeira_ate

    union all
    -- 5. sumido
    select cp.contact_id, 5, 'sumido',
           coalesce(cp.total, 0), null, null
    from compras cp
    where (v_hoje - cp.ultima) between c_sumido_de and c_sumido_ate
  ),
  unico as (
    select distinct on (cd.contact_id) cd.*
    from candidatos cd
    order by cd.contact_id, cd.prioridade
  ),
  feitos_hoje as (
    select a.contact_id, a.action_type as tipo, a.status
    from contact_actions a
    where a.franchise_id = p_franchise_id
      and a.action_date = v_hoje
  ),
  elegiveis as (
    select u.*,
           row_number() over (partition by u.tipo order by u.peso desc) as rn_tipo
    from unico u
    join contatos ct on ct.id = u.contact_id
    where coalesce(ct.telefone, '') <> ''
      and ct.do_not_contact_at is null
      and not exists (select 1 from ocupados o where o.contact_phone = ct.telefone)
      and not exists (select 1 from feitos_hoje f where f.contact_id = u.contact_id)
      and not exists (
        select 1 from contact_actions a
        where a.contact_id = u.contact_id
          and a.action_date < v_hoje
          and a.action_date >= v_hoje - c_pausa_dias
      )
      -- quem recebeu mensagem como sumido descansa 30 dias
      and not exists (
        select 1 from contact_actions a
        where a.contact_id = u.contact_id
          and a.action_type = 'sumido'
          and a.status = 'sent'
          and a.action_date < v_hoje
          and a.action_date >= v_hoje - c_pausa_sumido
      )
  ),
  -- rodizio entre os motivos (o 1o de cada, depois o 2o de cada...): recompra nao fica sem vaga
  pendentes as (
    select e.contact_id, e.prioridade, e.tipo, e.peso, e.conversa_em, e.msgs,
           null::text as status_hoje
    from elegiveis e
    where e.tipo <> 'sumido'
       or e.rn_tipo <= greatest(c_sumido_max - (select count(*) from feitos_hoje f where f.tipo = 'sumido'), 0)
    order by e.rn_tipo, e.prioridade
    limit greatest(v_limit - (select count(*) from feitos_hoje), 0)
  ),
  ordem_tipo(tipo, prioridade) as (
    values ('voltou_a_falar', 1), ('quase_comprou', 2), ('repetir', 3), ('primeira_compra', 4), ('sumido', 5)
  ),
  lista as (
    select p.contact_id, p.prioridade, p.tipo, p.peso, p.conversa_em, p.msgs, p.status_hoje
    from pendentes p
    union all
    select f.contact_id, ot.prioridade, f.tipo, 0, null, null, f.status
    from feitos_hoje f
    join ordem_tipo ot on ot.tipo = f.tipo
  ),
  itens as (
    select
      l.prioridade, l.peso,
      jsonb_build_object(
        'contact_id',     l.contact_id,
        'nome',           ct.nome,
        'telefone',       ct.telefone,
        'tipo',           l.tipo,
        'status_hoje',    l.status_hoje,
        'compras',        coalesce(cp.n, 0),
        'total',          round(coalesce(cp.total, 0), 2),
        'ultima_compra',  cp.ultima,
        'dias',           case when cp.ultima is null then null else v_hoje - cp.ultima end,
        'conversa_em',    l.conversa_em,
        'mensagens',      l.msgs,
        'favorito',       fav.product_name,
        'ultimo_produto', ult.product_name
      ) as item
    from lista l
    join contatos ct on ct.id = l.contact_id
    left join compras cp on cp.contact_id = l.contact_id
    -- produto que ele mais pede e que a unidade tem agora
    left join lateral (
      select ii.product_name
      from sale_items si
      join sales s on s.id = si.sale_id
      join inventory_items ii on ii.id = si.inventory_item_id
      where s.contact_id = l.contact_id
        and s.franchise_id = p_franchise_id
        and s.sale_date >= v_hoje - 90
        and coalesce(ii.active, true)
        and coalesce(ii.quantity, 0) > 0
      group by ii.product_name
      order by sum(si.quantity) desc, ii.product_name
      limit 1
    ) fav on true
    -- produto principal da ultima compra (para "o que achou do X?")
    left join lateral (
      select ii.product_name
      from sales s
      join sale_items si on si.sale_id = s.id
      join inventory_items ii on ii.id = si.inventory_item_id
      where s.contact_id = l.contact_id
        and s.franchise_id = p_franchise_id
        and s.sale_date = cp.ultima
      order by si.quantity desc, ii.product_name
      limit 1
    ) ult on true
  ),
  -- cada venda conta uma vez, mesmo com 2 mensagens na janela
  resumo as (
    select
      (select count(distinct a.contact_id)::int
         from contact_actions a
        where a.franchise_id = p_franchise_id
          and a.status = 'sent'
          and a.action_date >= v_mes) as enviadas,
      count(distinct s.contact_id)::int as compraram,
      coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)), 0) as valor
    from sales s
    where s.franchise_id = p_franchise_id
      and s.contact_id is not null
      and exists (
        select 1 from contact_actions a
        where a.contact_id = s.contact_id
          and a.franchise_id = s.franchise_id
          and a.status = 'sent'
          and a.action_date >= v_mes
          and s.sale_date between a.action_date and a.action_date + 7
      )
  ),
  sem_telefone as (
    select count(*)::int as n
    from compras cp
    join contatos ct on ct.id = cp.contact_id
    where coalesce(ct.telefone, '') = ''
      and cp.ultima >= v_hoje - 90
  )
  select jsonb_build_object(
    'data',             v_hoje,
    'limite',           v_limit,
    'itens',            coalesce((select jsonb_agg(i.item order by i.prioridade, i.peso desc) from itens i), '[]'::jsonb),
    'feitos_hoje',      (select count(*) from feitos_hoje where status = 'sent'),
    'pulados_hoje',     (select count(*) from feitos_hoje where status = 'skipped'),
    'sem_telefone_90d', (select n from sem_telefone),
    'resumo_mes',       (select jsonb_build_object(
                           'mes', to_char(v_mes, 'YYYY-MM'),
                           'enviadas', r.enviadas,
                           'compraram', r.compraram,
                           'valor', round(r.valor, 2))
                         from resumo r)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_daily_customer_actions(text, int) from public, anon;
grant execute on function public.get_daily_customer_actions(text, int) to authenticated, service_role;

-- 5. Numeros do cliente sempre calculados pelas vendas
--    (antes: last_purchase_at = data da venda INSERIDA, mesmo retroativa; delete nao voltava a data)
create or replace function public.recompute_contact_purchase_stats(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n      int;
  v_total  numeric;
  v_ultima date;
  v_last   timestamptz;
begin
  if p_contact_id is null then
    return;
  end if;

  -- trava o contato ANTES de somar: duas vendas simultaneas nao gravam total velho
  perform 1 from public.contacts c where c.id = p_contact_id for update;
  if not found then
    return;  -- contato sendo apagado (sales.contact_id -> SET NULL)
  end if;

  select count(*)::int,
         coalesce(sum(s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0)), 0),
         max(s.sale_date)
    into v_n, v_total, v_ultima
  from sales s
  where s.contact_id = p_contact_id;

  -- meio-dia de SP: a data certa em qualquer fuso do Brasil
  v_last := case when v_ultima is null then null
                 else (v_ultima + time '12:00') at time zone 'America/Sao_Paulo' end;

  update contacts c
     set purchase_count   = v_n,
         total_spent      = v_total,
         last_purchase_at = v_last,
         status = case
                    when v_n >= 3 then 'recorrente'
                    when v_n >= 1 then 'cliente'
                    when c.status in ('cliente', 'recorrente') then 'novo_lead'
                    else c.status
                  end
   where c.id = p_contact_id
     and (c.purchase_count   is distinct from v_n
       or c.total_spent      is distinct from v_total
       or c.last_purchase_at is distinct from v_last
       or c.status is distinct from case
                                      when v_n >= 3 then 'recorrente'
                                      when v_n >= 1 then 'cliente'
                                      when c.status in ('cliente', 'recorrente') then 'novo_lead'
                                      else c.status
                                    end);
end;
$$;

revoke execute on function public.recompute_contact_purchase_stats(uuid) from public, anon, authenticated;

-- INSERT: mesmo trigger de antes (on_sale_created), agora recalculando
create or replace function public.update_contact_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_name  text;
begin
  perform recompute_contact_purchase_stats(new.contact_id);

  select telefone, nome into v_phone, v_name from contacts where id = new.contact_id;
  if v_phone is not null then
    insert into daily_unique_contacts (franchise_id, date, contact_phone, contact_name)
    values (new.franchise_id,
            least(coalesce(new.sale_date, current_date), current_date),
            v_phone, v_name)
    on conflict (franchise_id, date, contact_phone) do nothing;
  end if;
  return new;
end;
$$;

-- UPDATE / DELETE
create or replace function public.tr_sales_recompute_contact()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_contact_purchase_stats(old.contact_id);
    return null;
  end if;

  -- UPDATE
  perform recompute_contact_purchase_stats(new.contact_id);
  if old.contact_id is distinct from new.contact_id then
    perform recompute_contact_purchase_stats(old.contact_id);
  end if;
  return null;
end;
$$;

-- o antigo era BEFORE DELETE (ainda enxergava a venda sendo apagada) e nao voltava a data
drop trigger if exists revert_contact_on_sale_delete on public.sales;
drop function if exists public.revert_contact_on_sale_delete();

create trigger revert_contact_on_sale_delete
  after delete on public.sales
  for each row when (old.contact_id is not null)
  execute function public.tr_sales_recompute_contact();

drop trigger if exists trg_sales_contact_stats_upd on public.sales;
create trigger trg_sales_contact_stats_upd
  after update of contact_id, sale_date, value, discount_amount, delivery_fee on public.sales
  for each row when (old.contact_id is not null or new.contact_id is not null)
  execute function public.tr_sales_recompute_contact();

-- 6. get_franchise_funnel_stats nao conferia a unidade (qualquer logado lia o funil de qualquer uma)
do $$
declare
  body text;
begin
  select pg_get_functiondef('public.get_franchise_funnel_stats(text,date,date)'::regprocedure) into body;
  if position('HAVING p_franchise_id IS NOT NULL;' in body) = 0 then
    raise exception 'ancora do HAVING nao encontrada em get_franchise_funnel_stats';
  end if;
  body := replace(
    body,
    'HAVING p_franchise_id IS NOT NULL;',
    'HAVING p_franchise_id IS NOT NULL
     AND ((SELECT is_admin_or_manager()) OR p_franchise_id = ANY ((SELECT managed_franchise_ids())::text[]));'
  );
  execute body;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- PARTE B (rodar separado, depois da A)
-- =====================================================================
-- create table public._backup_contacts_stats_2026_09_17 as
--   select id, purchase_count, total_spent, last_purchase_at, status, updated_at from public.contacts;
-- alter table public._backup_contacts_stats_2026_09_17 enable row level security;
--
-- with x as (
--   select s.contact_id,
--          count(*)::int as n,
--          coalesce(sum(s.value - coalesce(s.discount_amount,0) + coalesce(s.delivery_fee,0)),0) as total,
--          (max(s.sale_date) + time '12:00') at time zone 'America/Sao_Paulo' as last_at
--   from public.sales s where s.contact_id is not null group by 1
-- )
-- update public.contacts c
--    set purchase_count = x.n, total_spent = x.total, last_purchase_at = x.last_at,
--        status = case when x.n >= 3 then 'recorrente' else 'cliente' end
--   from x
--  where c.id = x.contact_id
--    and (c.purchase_count is distinct from x.n or c.total_spent is distinct from x.total
--      or c.last_purchase_at is distinct from x.last_at
--      or c.status is distinct from case when x.n >= 3 then 'recorrente' else 'cliente' end);
--
-- -- quem tinha compra contada mas nao tem venda nenhuma
-- update public.contacts c
--    set purchase_count = 0, total_spent = 0, last_purchase_at = null,
--        status = case when c.status in ('cliente','recorrente') then 'novo_lead' else c.status end
--  where not exists (select 1 from public.sales s where s.contact_id = c.id)
--    and (c.purchase_count is distinct from 0 or c.total_spent is distinct from 0
--      or c.last_purchase_at is not null or c.status in ('cliente','recorrente'));
--
-- Conferencia (query SEPARADA): divergencias entre contacts e sales devem ser 0.
