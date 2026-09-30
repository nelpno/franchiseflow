-- 30/09/2026 — "Quem chamar hoje": folga de um dia, quem comprou uma vez há 20-30 dias, ordem nova
--
-- Decisão do Nelson (30/09), a partir da observação de Socorro ("a sugestão é sempre de clientes
-- com quem conversamos no dia anterior") e dos números da rede desde 16/09 (1.175 mensagens):
--   1. "Hora de repetir" passa a incluir quem comprou UMA vez há 20 a 30 dias. A 2ª compra vem, na
--      mediana, 25 dias depois da 1ª, e esse cliente não aparecia em lista nenhuma do 6º ao 30º dia
--      (1.486 clientes na rede; ~9 por unidade na faixa de 20 a 30 dias).
--   2. Conversa com o robô ("Quase comprou" e "Voltou a falar") só entra no 2º e no 3º dia depois da
--      última mensagem do cliente (falou segunda, aparece quarta e quinta). Chamar antes não vendia
--      mais: até 12 h 4,9% · 12 a 24 h 4,3% · 24 a 48 h 4,5%. Além de 48 h NÃO há medição: conferir.
--   3. Ordem: Voltou a falar (12,5%) > Hora de repetir (~12%) > Quase comprou (4,5%) > Primeira compra > Sumido.
--   4. Ninguém entra como "Sumido" tendo recebido qualquer mensagem nos últimos 30 dias.
-- Efeito colateral aceito: a janela de "a unidade já falou com a pessoa" sobe de 48 h para 4 dias
-- (quem a franqueada atendeu nesses dias fica fora de todos os motivos).
-- Não muda: limite de 8 por dia, pausa de 7 dias depois de qualquer ação, 2 sumidos por dia.
--
-- MEDIR em 14/10/2026: conversão de 'repetir' com 1 compra (nunca sugerido antes) e de
-- 'quase_comprou' com 2-3 dias, contra os números acima.
--
-- Corpo anterior: md5(prosrc) = fe2ccfaf5ff85aa39d497c60bfd4a759; backup em docs/db-backups/get_daily_customer_actions.2026-09-30-antes.sql
-- ROLLBACK: node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/get_daily_customer_actions.2026-09-30-antes.sql
--   (e voltar ACTION_ORDER em src/lib/customerActions.js; create or replace mantém os grants).
-- Aplicar: node supabase/cs-cockpit/_aplica-lf.mjs supabase/2026-09-30-crm-folga-e-recompra.sql

CREATE OR REPLACE FUNCTION public.get_daily_customer_actions(p_franchise_id text, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  -- limites (ajustar depois de medir a adesao)
  c_limite_max      constant int      := 20;
  c_sumido_max      constant int      := 2;           -- sumidos por dia
  c_pausa_dias      constant int      := 7;           -- qualquer acao tira a pessoa da lista por 7 dias
  c_pausa_sumido    constant int      := 30;          -- mensagem a um sumido: 30 dias
  c_janela_conversa constant interval := interval '4 days';  -- quem a unidade atendeu nesses dias fica fora de tudo
  c_folga_de        constant int      := 2;           -- conversa: aparece a partir do 2o dia depois da ultima mensagem do cliente
  c_folga_ate       constant int      := 3;           -- ... e ate o 3o
  c_repetir1_de     constant int      := 20;          -- comprou UMA vez: "hora de repetir" de 20 a 30 dias
  c_repetir1_ate    constant int      := 30;
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
      and s.sale_date >= v_hoje - 7
  ),
  -- mensagens dos ultimos 4 dias (bot_conversations.updated_at e mexido por cron, nao serve de relogio)
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
      and b.started_at >= now() - interval '7 days'
      and b.contact_phone is not null
      and b.contact_phone <> ''
    order by b.contact_phone, b.started_at desc
  ),
  -- a ultima mensagem do cliente foi ha 2 ou 3 dias (folga de um dia: chamar na manha seguinte soava
  -- insistente e nao vendia mais — 30/09/2026), a conversa nao virou venda e nao ha venda depois dela
  conversas_ok as (
    select cv.contact_phone, cv.msgs, cv.dia_conversa,
           mr.ultima_do_cliente as conversa_em, ct.id as contact_id
    from msgs mr
    join conversas cv on cv.contact_phone = mr.contact_phone
    join contatos ct on ct.telefone = mr.contact_phone
    where mr.ultima_do_cliente is not null
      and (mr.ultima_do_cliente at time zone 'America/Sao_Paulo')::date between v_hoje - c_folga_ate and v_hoje - c_folga_de
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
    -- 3. nunca comprou, conversou bastante e parou
    select co.contact_id, 3, 'quase_comprou',
           co.msgs::numeric, co.conversa_em, co.msgs
    from conversas_ok co
    where co.msgs >= c_min_msgs
      and not exists (select 1 from compras cp where cp.contact_id = co.contact_id)

    union all
    -- 2. hora de repetir: no ritmo dele, ou comprou uma vez ha 20-30 dias (a 2a compra vem, na mediana, 25 dias depois)
    select cp.contact_id, 2, 'repetir',
           (case when cp.n_dias >= c_fiel then 1000000000 else 0 end) + coalesce(cp.total, 0),
           null::timestamptz, null::int
    from compras cp
    where (cp.n_dias >= 2
           and (v_hoje - cp.ultima) between
                 greatest(round(((cp.ultima - cp.primeira)::numeric / (cp.n_dias - 1)) * c_ritmo_fator), c_ritmo_min)
                 and c_repetir_max)
       or (cp.n_dias = 1
           and (v_hoje - cp.ultima) between c_repetir1_de and c_repetir1_ate)

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
      -- quem recebeu mensagem como sumido descansa 30 dias; e ninguem entra como sumido tendo
      -- recebido QUALQUER mensagem nesses 30 dias (nao insistir)
      and not exists (
        select 1 from contact_actions a
        where a.contact_id = u.contact_id
          and (a.action_type = 'sumido' or u.tipo = 'sumido')
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
    values ('voltou_a_falar', 1), ('repetir', 2), ('quase_comprou', 3), ('primeira_compra', 4), ('sumido', 5)
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
$function$
;
