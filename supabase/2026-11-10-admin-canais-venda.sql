-- Canais de venda da rede (admin/gerente/CS), 10/11/2026: robô × cardápio digital × lançada à mão.
-- Função NOVA (não existia: sem backup de corpo). Tela: src/components/canais/* (Hoje + página CanaisVenda).
--
-- ROLLBACK:
--   drop function if exists public.get_admin_canais_venda(text, integer);
--   (versão 10c, períodos: voltar à de 7/30 dias = o drop acima + reaplicar docs/db-backups/get_admin_canais_venda.2026-11-10c-antes.sql)
--   (versão 10b, adesão leve: voltar à anterior = reaplicar docs/db-backups/get_admin_canais_venda.2026-11-10b-antes.sql)
--
-- Período (10c, igual às outras telas do admin), em datas de Brasília:
--   '7d'           = últimos 7 dias contando hoje × os 7 antes, cortados na mesma hora de agora (corte_anterior);
--   'mes'          = 1º do mês até agora × o mesmo trecho do mês anterior, até a mesma hora (dia que o mês anterior
--                    não tem = mês anterior inteiro);
--   'mes_anterior' = mês passado inteiro × o mês antes dele inteiro (sem corte).
--   p_dias é legado (front antigo durante o deploy): 30 = 'mes', o resto = '7d'. Venda com sale_date futura (o robô grava a data da entrega)
-- só entra quando a data chega.
-- Regras (as mesmas do funil do cardápio, site/pedido/supabase/funil.sql, e da cardapio_resultado):
--   * telefone casado por normalize_phone_key (DDD + 8 últimos dígitos: pega o 9º dígito faltando);
--   * visitas = medidor_sessoes sem teste, pelo slug ATUAL da unidade;
--   * pedido enviado = cardapio_eventos 'enviou' (código distinto);
--   * pedido que chegou = 1ª mensagem de ENTRADA na unidade com o #PED- de um código que o cardápio da
--     unidade enviou; venda casada = 1ª venda da unidade do mesmo telefone criada até 72 h depois.
-- Atribuição do R$ (cada venda em UM canal só, por sale_date no período):
--   cardápio = venda casada a um #PED- (fechada pelo robô ou lançada à mão: o pedido veio pronto do cardápio);
--   robô = sales.source = 'bot' que não é do cardápio; manual = o resto (source = 'manual').
-- Robô (conversas): telefones distintos que ESCREVERAM (direction = 'in', disparo da franqueada não entra) no
--   período, SEM quem mandou #PED- no período (esse conta no cardápio). Converteu = venda da unidade do mesmo
--   telefone (qualquer origem: a franqueada fecha metade) criada depois da 1ª mensagem e antes do fim do período.
-- Adesão ao cardápio (10b): o MESMO estado da public.cardapio_adesao() (a ordem do CASE é a dela), mas leve: as travas
--   vêm da própria cardapio_checklist, chamada só para quem não está ligado/pausado, e não calcula o que a lista de
--   adesão mostra e esta tela não usa (avisos, pedidos_7d, robô = responsável). Medido 10/11 (70 unidades, 3 rodadas):
--   7 dias 570-720 ms -> ~310 ms; 30 dias ~1.100 ms -> ~840 ms; estado/desde iguais aos da cardapio_adesao nas 70.
--   Mudou o CASE da cardapio_adesao? Mude aqui. Unidade sem franchise_configurations
--   = 'sem_config' (a cardapio_adesao a deixa de fora; aqui ela conta no total).
-- Sem PII: nenhum telefone, nome de cliente ou dono na resposta (só unidade).

drop function if exists public.get_admin_canais_venda(integer);

create or replace function public.get_admin_canais_venda(p_periodo text default null, p_dias integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_per text := case when p_periodo in ('7d', 'mes', 'mes_anterior') then p_periodo when p_dias = 30 then 'mes' else '7d' end;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje date := v_agora::date;
  v_ini date;
  v_fim date;
  v_pini date;
  v_pfim date;
  v_corta boolean;
  t_pini timestamptz;
  t_ini timestamptz;
  t_fim timestamptz;
  t_pfim timestamptz;
  v jsonb;
begin
  -- SQL direto (MCP, sem claims) também lê; pelo app só admin/gerente/CS.
  if not coalesce(nullif(current_setting('request.jwt.claims', true), '') is null
                  or (select public.is_cs_or_admin())
                  or nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role', false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_per = '7d' then
    v_ini := v_hoje - 6; v_fim := v_hoje; v_pini := v_hoje - 13; v_pfim := v_hoje - 7; v_corta := true;
  elsif v_per = 'mes' then
    v_ini := date_trunc('month', v_hoje)::date; v_fim := v_hoje;
    v_pini := (v_ini - interval '1 month')::date;
    v_pfim := least(v_pini + (v_hoje - v_ini), v_ini - 1);   -- 31/03 contra fevereiro = fevereiro inteiro
    v_corta := (v_pini + (v_hoje - v_ini)) <= v_ini - 1;
  else
    v_ini := (date_trunc('month', v_hoje) - interval '1 month')::date; v_fim := date_trunc('month', v_hoje)::date - 1;
    v_pini := (v_ini - interval '1 month')::date; v_pfim := v_ini - 1; v_corta := false;
  end if;
  t_pini := v_pini::timestamp at time zone 'America/Sao_Paulo';
  t_ini  := v_ini::timestamp at time zone 'America/Sao_Paulo';
  t_fim  := (v_fim + 1)::timestamp at time zone 'America/Sao_Paulo';
  -- período anterior que termina "hoje" cortado na MESMA hora de agora (hoje está pela metade: dia inteiro contra meio dia
  -- puxava tudo para baixo); sem corte, vai até o fim do último dia
  t_pfim := case when v_corta then (v_pfim + v_agora::time)::timestamp at time zone 'America/Sao_Paulo'
                 else (v_pfim + 1)::timestamp at time zone 'America/Sao_Paulo' end;

  with u as (
    select f.id fid, f.evolution_instance_id evo, f.name nome, fc.cardapio_digital_slug slug,
           (fc.franchise_evolution_instance_id is not null) tem_config, coalesce(fc.cardapio_digital_ativo, false) ativo,
           fc.cardapio_primeira_vez_em, fc.cardapio_ativo_mudou_em
      from franchises f
      left join franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
     where f.status = 'active' and not coalesce(f.is_test, false) and f.evolution_instance_id is not null
  ),
  ad as materialized (
    select u.evo,
           case when not u.tem_config then 'sem_config'
                when not public.feature_flag_enabled('cardapio_digital', u.evo) then 'pausado_maxi'
                when u.ativo then 'ligado'
                when u.cardapio_primeira_vez_em is not null then 'pausado'
                when not exists (select 1 from jsonb_array_elements(coalesce(public.cardapio_checklist(u.evo), '[]'::jsonb)) c
                                  where c->>'nivel' = 'trava' and not (c->>'ok')::boolean) then 'pronto'
                when exists (select 1 from app_eventos a where a.franquia_id = u.fid and a.evento = 'cardapio_tela_aberta'
                                                          and a.papel = 'franchisee') then 'falta'
                else 'nao_abriu' end estado,
           case when u.ativo or u.cardapio_primeira_vez_em is not null then u.cardapio_ativo_mudou_em end desde
      from u
  ),
  -- mensagens de entrada com #PED- (índice idx_conv_msg_in_ped); até 3 dias antes, para casar venda do começo do período
  msg as (
    select m.franchise_id evo, public.normalize_phone_key(m.contact_phone) k, m.created_at,
           (regexp_match(m.content, '#(PED-[A-Z2-9]{4})'))[1] cod
      from conversation_messages m
     where m.direction = 'in' and m.content like '%#PED-%'
       and m.created_at >= t_pini - interval '3 days' and m.created_at < t_fim
       and m.franchise_id in (select evo from u)
  ),
  enviados as (
    select u.evo, e.codigo cod, min(e.criado_em) criado_em
      from cardapio_eventos e join u on u.slug = e.unidade
     where e.evento = 'enviou' and e.codigo is not null
       and e.criado_em >= t_pini - interval '4 days' and e.criado_em < t_fim
     group by 1, 2
  ),
  chegou as (
    select distinct on (m.evo, m.cod) m.evo, m.cod, m.k, m.created_at
      from msg m join enviados e on e.evo = m.evo and e.cod = m.cod
     where m.cod is not null and m.k is not null
     order by m.evo, m.cod, m.created_at
  ),
  vendas as (
    select s.id, s.franchise_id evo, s.source, s.sale_date, s.created_at,
           case when length(n2.y) in (10, 11) then left(n2.y, 2) || right(n2.y, 8) end k,
           s.value - coalesce(s.discount_amount, 0) + coalesce(s.delivery_fee, 0) receita
      from sales s
     -- = public.normalize_phone_key(contact_phone) escrita aqui dentro: a função (SQL com CTE) não é
     -- "inlined" e custa ~45 µs por linha (1,4 s em 30 mil contatos). Mudou lá? Mude aqui e em contato.
     cross join lateral (select ltrim(regexp_replace(coalesce(s.contact_phone, ''), '\D', '', 'g'), '0') x) n1
     cross join lateral (select case when length(n1.x) in (12, 13) and n1.x like '55%' then substr(n1.x, 3) else n1.x end y) n2
     where s.franchise_id in (select evo from u)
       and (s.sale_date between v_pini and v_fim
            or (s.created_at >= t_pini - interval '3 days' and s.created_at < t_fim + interval '3 days'))
  ),
  casada as (
    select c.evo, c.cod, c.created_at chegou_em, vv.id venda_id
      from chegou c
      left join lateral (
        select v2.id from vendas v2
         where v2.evo = c.evo and v2.k = c.k
           and v2.created_at between c.created_at and c.created_at + interval '72 hours'
         order by v2.created_at limit 1) vv on true
  ),
  venda_card as (select distinct venda_id id from casada where venda_id is not null),
  vendas_per as (
    -- venda do período anterior: dias inteiros, e no último dia (o "hoje" de N dias atrás) só a lançada até a mesma hora
    select v.*, case when v.sale_date >= v_ini then 'cur' else 'prev' end per,
           case when vc.id is not null then 'cardapio' when v.source = 'bot' then 'robo' else 'manual' end canal
      from vendas v left join venda_card vc on vc.id = v.id
     where (v.sale_date between v_ini and v_fim or v.sale_date between v_pini and v_pfim)
       and not (v_corta and v.sale_date = v_pfim and v.created_at >= t_pfim)
  ),
  -- contatos que escreveram, por período
  -- (índice idx_conv_msg_in_cover: só lê o índice; normaliza o telefone DEPOIS de agrupar, é a parte cara)
  contato_bruto as materialized (
    select m.franchise_id evo, m.contact_phone ph, case when m.created_at >= t_ini then 'cur' when m.created_at < t_pfim then 'prev' end per,
           min(m.created_at) primeira
      from conversation_messages m
     where m.direction = 'in' and m.created_at >= t_pini and m.created_at < t_fim
       and (m.created_at >= t_ini or m.created_at < t_pfim)
       and m.franchise_id in (select evo from u)
     group by 1, 2, 3
  ),
  -- só código que o cardápio da unidade enviou (o mesmo critério do funil)
  ped_contato as (
    select distinct m.evo, m.k, case when m.created_at >= t_ini then 'cur' when m.created_at < t_pfim then 'prev' end per
      from msg m join enviados e on e.evo = m.evo and e.cod = m.cod
     where m.k is not null and m.created_at >= t_pini and (m.created_at >= t_ini or m.created_at < t_pfim)
  ),
  contato as (
    select c.evo, c.k, c.per, c.primeira, (pc.k is not null) mandou_ped
      from (select cb.evo, case when length(n2.y) in (10, 11) then left(n2.y, 2) || right(n2.y, 8) end k,
                   cb.per, min(cb.primeira) primeira
              from contato_bruto cb
             cross join lateral (select ltrim(regexp_replace(coalesce(cb.ph, ''), '\D', '', 'g'), '0') x) n1
             cross join lateral (select case when length(n1.x) in (12, 13) and n1.x like '55%' then substr(n1.x, 3) else n1.x end y) n2
             group by 1, 2, 3) c
      left join ped_contato pc on pc.evo = c.evo and pc.k = c.k and pc.per = c.per
     where c.k is not null
  ),
  robo_comprou as (
    select distinct c.evo, c.k, c.per
      from contato c
      join vendas v on v.evo = c.evo and v.k = c.k
     where not c.mandou_ped and v.created_at >= c.primeira
       and v.created_at < case when c.per = 'cur' then t_fim else t_pfim end
  ),
  robo as (
    select c.evo, c.per, count(*) contatos, count(rc.k) compraram
      from contato c
      left join robo_comprou rc on rc.evo = c.evo and rc.k = c.k and rc.per = c.per
     where not c.mandou_ped
     group by 1, 2
  ),
  visitas as (
    select u.evo, case when s.criado_em >= t_ini then 'cur' when s.criado_em < t_pfim then 'prev' end per, count(*) n
      from medidor_sessoes s join u on u.slug = s.unidade
     where not coalesce(s.teste, false) and s.criado_em >= t_pini and s.criado_em < t_fim and (s.criado_em >= t_ini or s.criado_em < t_pfim)
     group by 1, 2
  ),
  env as (
    select evo, case when criado_em >= t_ini then 'cur' when criado_em < t_pfim then 'prev' end per, count(*) n
      from enviados where criado_em >= t_pini and (criado_em >= t_ini or criado_em < t_pfim) group by 1, 2
  ),
  cheg as (
    -- distinct: dois códigos do mesmo telefone em 72 h podem casar a MESMA venda
    select evo, case when chegou_em >= t_ini then 'cur' when chegou_em < t_pfim then 'prev' end per,
           count(*) chegaram, count(distinct venda_id) viraram_venda
      from casada where chegou_em >= t_pini and (chegou_em >= t_ini or chegou_em < t_pfim) group by 1, 2
  ),
  vend as (
    select evo, per,
           count(*) filter (where canal = 'cardapio') n_cardapio,
           coalesce(sum(receita) filter (where canal = 'cardapio'), 0) rs_cardapio,
           count(*) filter (where canal = 'cardapio' and source = 'bot') n_cardapio_robo,
           count(*) filter (where canal = 'robo') n_robo,
           coalesce(sum(receita) filter (where canal = 'robo'), 0) rs_robo,
           count(*) filter (where canal = 'manual') n_manual,
           coalesce(sum(receita) filter (where canal = 'manual'), 0) rs_manual
      from vendas_per group by 1, 2
  ),
  pers as (select unnest(array['cur', 'prev']) per),
  linha as (
    select u.evo, u.nome, (u.slug is not null) tem_slug, ad.estado, ad.desde, p.per,
           jsonb_build_object(
             'robo_contatos', coalesce(r.contatos, 0), 'robo_compraram', coalesce(r.compraram, 0),
             'visitas', coalesce(vi.n, 0), 'pedidos_enviados', coalesce(en.n, 0),
             'pedidos_chegaram', coalesce(ch.chegaram, 0), 'pedidos_viraram_venda', coalesce(ch.viraram_venda, 0),
             'vendas_cardapio', coalesce(vd.n_cardapio, 0), 'rs_cardapio', round(coalesce(vd.rs_cardapio, 0), 2),
             'vendas_cardapio_robo', coalesce(vd.n_cardapio_robo, 0),
             'vendas_robo', coalesce(vd.n_robo, 0), 'rs_robo', round(coalesce(vd.rs_robo, 0), 2),
             'vendas_manual', coalesce(vd.n_manual, 0), 'rs_manual', round(coalesce(vd.rs_manual, 0), 2)
           ) m
      from u cross join pers p
      left join ad on ad.evo = u.evo
      left join robo r on r.evo = u.evo and r.per = p.per
      left join visitas vi on vi.evo = u.evo and vi.per = p.per
      left join env en on en.evo = u.evo and en.per = p.per
      left join cheg ch on ch.evo = u.evo and ch.per = p.per
      left join vend vd on vd.evo = u.evo and vd.per = p.per
  ),
  por_unidade as (
    select evo, nome, tem_slug, estado, desde,
           max(m::text) filter (where per = 'cur')::jsonb atual,
           max(m::text) filter (where per = 'prev')::jsonb anterior
      from linha group by 1, 2, 3, 4, 5
  ),
  rede as (
    select per, jsonb_object_agg(chave, total) m
      from (select l.per, kv.key chave, sum((kv.value)::numeric) total
              from linha l, jsonb_each(l.m) kv group by 1, 2) q
     group by 1
  )
  select jsonb_build_object(
    'periodo', v_per, 'hoje', v_hoje,
    'inicio', v_ini, 'fim', v_fim, 'inicio_anterior', v_pini, 'fim_anterior', v_pfim,
    'corte_anterior', case when v_corta then t_pfim end,
    'gerado_em', now(),
    'rede', jsonb_build_object('atual', (select m from rede where per = 'cur'), 'anterior', (select m from rede where per = 'prev')),
    -- todas as unidades da lista (u), inclusive sem configuração: o total bate com a lista por unidade
    'adesao', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
                 from (select coalesce(ad.estado, 'sem_config') estado, count(*) n from u left join ad on ad.evo = u.evo group by 1) q),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('evo', evo, 'nome', nome, 'tem_slug', tem_slug, 'estado', estado, 'cardapio_desde', desde,
                                                              'atual', atual, 'anterior', anterior) order by nome)
                            from por_unidade), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke execute on function public.get_admin_canais_venda(text, integer) from public, anon;
grant execute on function public.get_admin_canais_venda(text, integer) to authenticated, service_role;
