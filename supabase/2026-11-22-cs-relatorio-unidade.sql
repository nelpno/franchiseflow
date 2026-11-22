-- Assessor do CS: "relatório completo" de UMA unidade (22/11/2026), o mesmo conteúdo da análise
-- que o Nelson fazia à mão (skill `analise-franquia`, estrutura para o CS em
-- `cs-celso/analises-franquias/_briefing-gerador.md` § 9): meses lado a lado, posição na rede em
-- R$ por pessoa que escreveu, régua do toque humano, anúncio × espontâneo, checkout, "o robô disse
-- que acabou", estoque e campeão zerado, produtos que caíram, compras à fábrica, verba, quinzenas,
-- alerta de disparo (mesma mensagem para vários contatos) e comprovante sem venda lançada.
--
-- Uma chamada, só leitura. Os meses (unidade e rede) vêm de `cs_rede_mes`, calculada de madrugada: ler 6 meses
-- de conversa ao vivo levava 8 a 11 s com o banco frio numa unidade grande (teto do authenticated = 8 s).
-- Ao vivo só o que é pequeno: quinzenas, estoque, produtos, compras, alertas e falas das últimas 3 semanas.
-- Só CS/admin/manager (mesmo guard da get_unit_360). Sem telefone de cliente na saída.
--
-- ROLLBACK: drop function if exists public.get_cs_relatorio_unidade(text);

create or replace function public.get_cs_relatorio_unidade(p_evo text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_m0 date;
  v_m1 date;
  v_ini date;
  v_ini_ts timestamptz;
  r jsonb;
begin
  if not coalesce((select public.is_cs_or_admin()) or (select public.is_admin_or_manager()), false) then
    return null;
  end if;
  if p_evo is null or not exists (select 1 from public.franchises where evolution_instance_id = p_evo) then
    return jsonb_build_object('erro', 'unidade não encontrada');
  end if;
  v_m0 := date_trunc('month', v_hoje)::date;
  v_m1 := (v_m0 - interval '1 month')::date;
  v_ini := (v_m0 - interval '5 months')::date;
  v_ini_ts := v_ini::timestamp at time zone 'America/Sao_Paulo';

  with
  vs as (
    select s.id, public.normalize_phone_key(s.contact_phone) as tel, s.sale_date,
           s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0) as liq
      from public.sales s
     where s.franchise_id = p_evo and s.sale_date >= v_m1 and s.sale_date <= v_hoje
  ),
  cache as (
    select * from public.cs_rede_mes where franchise_id = p_evo and mes >= to_char(v_ini, 'YYYY-MM')
  ),
  po as (
    select to_char(ordered_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
           round(sum(total_amount), 2) as compras, count(*) as n
      from public.purchase_orders
     where franchise_id = p_evo and status <> 'cancelado' and ordered_at >= v_ini_ts
     group by 1
  ),
  mk as (
    select reference_month as mes, round(sum(amount), 2) as bruto,
           min(created_at at time zone 'America/Sao_Paulo')::date as pago_em
      from public.marketing_payments
     where franchise_id = p_evo and status = 'confirmed' and reference_month >= to_char(v_ini, 'YYYY-MM')
     group by 1
  ),
  ms as (
    select to_char(g, 'YYYY-MM') as mes, g::date as d0
      from generate_series(v_ini::timestamp, v_m0::timestamp, interval '1 month') g
  ),
  meses as (
    select jsonb_agg(jsonb_build_object(
             'mes', ms.mes,
             'parcial_ate_ontem', ms.d0 = v_m0,
             'dias', case when ms.d0 = v_m0 then greatest(extract(day from v_hoje)::int - 1, 1)
                          else extract(day from (ms.d0 + interval '1 month - 1 day'))::int end,
             'pessoas_que_escreveram', coalesce(c.escreveram, 0),
             'pct_resposta_humana', round(100.0 * c.com_humano / nullif(c.escreveram, 0), 1),
             'vendas', coalesce(c.vendas, 0),
             'vendas_robo', coalesce(c.vendas_robo, 0),
             'vendas_a_mao', coalesce(c.vendas, 0) - coalesce(c.vendas_robo, 0),
             'faturamento', round(coalesce(c.faturamento, 0), 2),
             'faturamento_por_dia', round(coalesce(c.faturamento, 0) / (case when ms.d0 = v_m0 then greatest(extract(day from v_hoje) - 1, 1)
                                         else extract(day from (ms.d0 + interval '1 month - 1 day')) end), 2),
             'ticket_medio', round(c.faturamento / nullif(c.vendas, 0), 2),
             'rs_por_pessoa_que_escreveu', round(coalesce(c.faturamento, 0) / nullif(c.escreveram, 0), 2),
             'chegaram_ao_pagamento', coalesce(c.pagto, 0),
             'chegaram_ao_pagamento_e_nao_compraram', coalesce(c.pagto_sem_compra, 0),
             'robo_disse_que_acabou', coalesce(c.acabou, 0),
             'vieram_do_anuncio', jsonb_build_object('pessoas', coalesce(c.anuncio_pessoas, 0), 'compraram', coalesce(c.anuncio_compraram, 0),
                                   'conversao_pct', round(100.0 * c.anuncio_compraram / nullif(c.anuncio_pessoas, 0), 1)),
             'escreveram_por_conta', jsonb_build_object('pessoas', coalesce(c.espont_pessoas, 0), 'compraram', coalesce(c.espont_compraram, 0),
                                   'conversao_pct', round(100.0 * c.espont_compraram / nullif(c.espont_pessoas, 0), 1)),
             'compras_a_fabrica', coalesce(po.compras, 0),
             'pedidos_a_fabrica', coalesce(po.n, 0),
             'verba_anuncio_bruta', mk.bruto,
             'verba_paga_em', mk.pago_em
           ) order by ms.mes) as j
      from ms
      left join cache c on c.mes = ms.mes
      left join po on po.mes = ms.mes
      left join mk on mk.mes = ms.mes
  ),
  cm as (
    select bc.id, bc.started_at, public.normalize_phone_key(bc.contact_phone) as tel,
           bool_or(x.direction = 'out' and x.content ~* '(chave|c[oó]digo) (do )?pix|forma de pagamento|maquininha|posso confirmar|finalizar o pedido') as pagto,
           bool_or(x.direction = 'out' and x.content ~* 'n[ãa]o (est[áa] )?dispon[ií]vel|n[ãa]o (tenho|temos)|sem estoque|esgotad|acabou') as acabou
      from public.bot_conversations bc
      join public.conversation_messages x on x.conversation_id = bc.id
     where bc.franchise_id = p_evo and bc.started_at > now() - interval '21 days'
     group by bc.id, bc.started_at, 3
  ),
  quinz as (
    select jsonb_agg(jsonb_build_object(
             'mes', q.mes,
             'dia_1_a_15_por_dia', round(q.a / 15.0, 2),
             'dia_16_ao_fim_por_dia', case when q.dias2 > 0 then round(q.b / q.dias2, 2) end
           ) order by q.mes) as j
      from (
        select to_char(m, 'YYYY-MM') as mes,
               coalesce(sum(vs.liq) filter (where extract(day from vs.sale_date) <= 15), 0) as a,
               coalesce(sum(vs.liq) filter (where extract(day from vs.sale_date) > 15), 0) as b,
               case when m::date = v_m0 then greatest(extract(day from v_hoje) - 15, 0)
                    else extract(day from (m + interval '1 month - 1 day')) - 15 end as dias2
          from unnest(array[v_m1, v_m0]) m
          left join vs on vs.sale_date >= m::date and vs.sale_date < (m + interval '1 month')::date
         group by m
      ) q
  ),
  rede as (
    select mes, franchise_id, escreveram, com_humano, faturamento, atualizado_em,
           faturamento / nullif(escreveram, 0) as rs,
           100.0 * com_humano / nullif(escreveram, 0) as pct
      from public.cs_rede_mes
     where mes in (to_char(v_m1, 'YYYY-MM'), to_char(v_m0, 'YYYY-MM'))
  ),
  rk as (
    select mes, franchise_id, rank() over (partition by mes order by rs desc) as pos, count(*) over (partition by mes) as de
      from rede where escreveram >= 50
  ),
  rf as (
    select mes, franchise_id, rank() over (partition by mes order by faturamento desc) as pos, count(*) over (partition by mes) as de
      from rede where faturamento > 0
  ),
  posicao as (
    select jsonb_agg(jsonb_build_object(
             'mes', x.mes,
             'base_calculada_em', (select max(atualizado_em) from rede r2 where r2.mes = x.mes),
             'rs_por_pessoa', jsonb_build_object(
                'posicao', (select pos from rk where rk.mes = x.mes and rk.franchise_id = p_evo),
                'de', (select max(de) from rk where rk.mes = x.mes),
                'mediana_rede', (select round(percentile_cont(0.5) within group (order by rs)::numeric, 2) from rede r2 where r2.mes = x.mes and r2.escreveram >= 50),
                'corte', 'só unidades com 50+ pessoas no mês'),
             'faturamento', jsonb_build_object(
                'posicao', (select pos from rf where rf.mes = x.mes and rf.franchise_id = p_evo),
                'de', (select max(de) from rf where rf.mes = x.mes),
                'mediana_rede', (select round(percentile_cont(0.5) within group (order by faturamento)::numeric, 2) from rede r2 where r2.mes = x.mes and r2.faturamento > 0)),
             'pct_resposta_humana_mediana_rede', (select round(percentile_cont(0.5) within group (order by pct)::numeric, 1) from rede r2 where r2.mes = x.mes and r2.escreveram >= 50)
           ) order by x.mes) as j
      from (select distinct mes from rede) x
  ),
  regua as (
    select jsonb_build_object(
             'mes', to_char(v_m1, 'YYYY-MM'),
             'faixas', jsonb_agg(jsonb_build_object('faixa', f.faixa, 'unidades', f.n, 'rs_por_pessoa_mediana', f.rs, 'pessoas_media', f.pessoas) order by f.faixa)
           ) as j
      from (
        select case when pct < 20 then 'A: menos de 20%' when pct < 35 then 'B: 20% a 35%'
                    when pct < 50 then 'C: 35% a 50%' else 'D: 50% ou mais' end as faixa,
               count(*) as n,
               round(percentile_cont(0.5) within group (order by rs)::numeric, 2) as rs,
               round(avg(escreveram)) as pessoas
          from rede where mes = to_char(v_m1, 'YYYY-MM') and escreveram >= 50
         group by 1
      ) f
  ),
  inv as (
    select id, product_name, quantity from public.inventory_items where franchise_id = p_evo and active
  ),
  v60 as (
    select si.inventory_item_id, si.product_name,
           sum(si.quantity) filter (where s.sale_date > v_hoje - 30) as q30,
           sum(si.quantity) filter (where s.sale_date <= v_hoje - 30) as q_ant,
           sum(si.quantity * si.unit_price) filter (where s.sale_date > v_hoje - 30) as r30
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
     where s.franchise_id = p_evo and s.sale_date > v_hoje - 60 and s.sale_date <= v_hoje
     group by 1, 2
  ),
  estoque as (
    select jsonb_build_object(
             'itens_ativos', (select count(*) from inv),
             'itens_ativos_mediana_rede', (select round(percentile_cont(0.5) within group (order by n)::numeric)
                                             from (select i.franchise_id, count(*) n from public.inventory_items i
                                                     join public.franchises f on f.evolution_instance_id = i.franchise_id
                                                    where i.active and f.status = 'active' and not coalesce(f.is_test, false)
                                                    group by 1) t),
             'zerados', (select count(*) from inv where quantity <= 0),
             'zerados_nomes', (select jsonb_agg(product_name order by product_name) from (select product_name from inv where quantity <= 0 order by product_name limit 15) z),
             'pacotes_no_estoque', (select round(sum(greatest(quantity, 0))) from inv),
             'campeoes_de_venda_zerados', (select jsonb_agg(jsonb_build_object('produto', v.product_name, 'vendidos_60d', v.tot) order by v.tot desc)
                                             from (select v60.product_name, coalesce(v60.q30, 0) + coalesce(v60.q_ant, 0) as tot
                                                     from v60 join inv on inv.id = v60.inventory_item_id
                                                    where inv.quantity <= 0
                                                    order by 2 desc limit 5) v)
           ) as j
  ),
  produtos as (
    select jsonb_build_object(
             'mais_vendidos_30d', (select jsonb_agg(jsonb_build_object('produto', product_name, 'unidades_30d', q30, 'unidades_30d_anteriores', coalesce(q_ant, 0), 'receita_30d', round(r30, 2)) order by q30 desc)
                                     from (select product_name, sum(q30) q30, sum(q_ant) q_ant, sum(r30) r30 from v60 group by 1 having sum(q30) > 0 order by 2 desc limit 8) t),
             'que_cairam', (select jsonb_agg(jsonb_build_object('produto', product_name, 'unidades_30d_anteriores', q_ant, 'unidades_30d', q30) order by q_ant - q30 desc)
                              from (select product_name, coalesce(sum(q30), 0) q30, sum(q_ant) q_ant from v60 group by 1
                                     having sum(q_ant) >= 5 and coalesce(sum(q30), 0) <= 0.5 * sum(q_ant)
                                     order by sum(q_ant) - coalesce(sum(q30), 0) desc limit 5) t)
           ) as j
  ),
  compras as (
    select jsonb_build_object(
             'ultimos_pedidos', (select jsonb_agg(jsonb_build_object('pedido_em', (ordered_at at time zone 'America/Sao_Paulo')::date, 'status', status, 'valor', total_amount, 'entregue_em', (delivered_at at time zone 'America/Sao_Paulo')::date) order by ordered_at desc)
                                   from (select * from public.purchase_orders where franchise_id = p_evo and status <> 'cancelado' order by ordered_at desc limit 3) t),
             'dias_desde_o_ultimo_entregue', (select v_hoje - max(delivered_at at time zone 'America/Sao_Paulo')::date from public.purchase_orders where franchise_id = p_evo and status = 'entregue')
           ) as j
  ),
  disparo as (
    select jsonb_agg(jsonb_build_object('trecho', t.trecho, 'contatos', t.n, 'de', t.d1, 'ate', t.d2) order by t.n desc) as j
      from (
        select left(regexp_replace(lower(content), '\s+', ' ', 'g'), 80) as trecho,
               count(distinct public.normalize_phone_key(contact_phone)) as n,
               min(created_at at time zone 'America/Sao_Paulo')::date as d1,
               max(created_at at time zone 'America/Sao_Paulo')::date as d2
          from public.conversation_messages
         where franchise_id = p_evo and direction = 'human' and created_at > now() - interval '14 days'
           and length(content) >= 25
         group by 1
        having count(distinct public.normalize_phone_key(contact_phone)) >= 8
         order by 2 desc limit 3
      ) t
  ),
  img as (
    select distinct on (x.conversation_id) x.conversation_id, x.created_at, public.normalize_phone_key(x.contact_phone) as tel
      from public.conversation_messages x
     where x.franchise_id = p_evo and x.direction = 'in' and x.message_type = 'image'
       and x.created_at > now() - interval '30 days'
       and exists (select 1 from public.conversation_messages o
                    where o.conversation_id = x.conversation_id and o.direction = 'out'
                      and o.created_at < x.created_at and o.content ~* 'pix')
     order by x.conversation_id, x.created_at
  ),
  comprovante as (
    select jsonb_build_object(
             'imagens_depois_do_pix_sem_venda_lancada', count(*),
             'sem_resposta_humana_depois', count(*) filter (where not hum),
             'datas', jsonb_agg(to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM') order by created_at desc),
             'nota', 'cliente mandou imagem (provável comprovante) depois de o robô passar o Pix, e não há venda lançada para o telefone dela em até 3 dias: dinheiro parado ou venda não lançada; abrir a conversa antes de cobrar'
           ) as j
      from (
        select img.*,
               exists (select 1 from public.conversation_messages h where h.conversation_id = img.conversation_id
                         and h.direction = 'human' and h.created_at > img.created_at) as hum
          from img
         where img.tel is not null
           and not exists (select 1 from vs where vs.tel = img.tel
                             and vs.sale_date between (img.created_at at time zone 'America/Sao_Paulo')::date - 1
                                                  and (img.created_at at time zone 'America/Sao_Paulo')::date + 3)
      ) t
  ),
  verbatim as (
    select jsonb_agg(jsonb_build_object('em', to_char(t.created_at at time zone 'America/Sao_Paulo', 'DD/MM'), 'situacao', t.sit, 'cliente_escreveu', t.txt) order by t.created_at desc) as j
      from (select * from (
        select distinct on (cm.id) cm.id, m.created_at,
               case when cm.acabou then 'robô disse que não tinha' else 'chegou ao pagamento e não comprou' end as sit,
               left(regexp_replace(m.content, '\s+', ' ', 'g'), 160) as txt
          from cm
          join public.conversation_messages m on m.conversation_id = cm.id and m.direction = 'in'
         where cm.started_at > now() - interval '21 days'
           and (cm.acabou or cm.pagto)
           and not exists (select 1 from vs where vs.tel = cm.tel and vs.sale_date >= (cm.started_at at time zone 'America/Sao_Paulo')::date - 1)
           and m.message_type = 'text' and length(m.content) between 15 and 300
           and m.content !~* 'tenho interesse e queria mais informa|posso ter mais informa|gostaria de mais informa'
         order by cm.id, m.created_at desc
      ) d order by d.created_at desc limit 6) t
  )
  select jsonb_build_object(
           'hoje', v_hoje,
           'unidade', (select jsonb_build_object('nome', f.name, 'cidade', f.city, 'dono', f.owner_name,
                                                 'aberta_em', (f.created_at at time zone 'America/Sao_Paulo')::date,
                                                 'idade_dias', v_hoje - (f.created_at at time zone 'America/Sao_Paulo')::date)
                         from public.franchises f where f.evolution_instance_id = p_evo),
           'meses', (select j from meses),
           'quinzenas', (select j from quinz),
           'posicao_na_rede', (select j from posicao),
           'regua_resposta_humana', (select j from regua),
           'estoque', (select j from estoque),
           'produtos', (select j from produtos),
           'compras_a_fabrica', (select j from compras),
           'alerta_disparo', coalesce((select j from disparo), '[]'::jsonb),
           'comprovantes', (select j from comprovante),
           'o_cliente_escreveu', coalesce((select j from verbatim), '[]'::jsonb)
         )
    into r;
  return r;
end
$function$;

revoke execute on function public.get_cs_relatorio_unidade(text) from public, anon;
grant execute on function public.get_cs_relatorio_unidade(text) to authenticated;
