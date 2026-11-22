-- Assessor do CS: base da rede por mês para o "relatório completo" (22/11/2026).
--
-- Por que existe: a posição da unidade na rede em R$ por pessoa que escreveu (análise v3,
-- `analise-franquia`) exige o toque humano de TODAS as unidades no mês: ~14 s de consulta.
-- Na hora da pergunta isso estoura o statement_timeout de 8 s do papel authenticated e deixa o
-- Assessor lento. Aqui a rede é calculada uma vez por noite (cron 07:40 UTC = 04:40 BRT) e o
-- relatório da unidade só lê.
--
-- Tabela só de backend: lida pelas funções SECURITY DEFINER; sem grant a anon/authenticated.
--
-- ROLLBACK:
--   select cron.unschedule('cs-rede-mes');
--   drop function if exists public.cs_rede_mes_atualizar(text);
--   drop table if exists public.cs_rede_mes;

create table if not exists public.cs_rede_mes (
  mes            text        not null check (mes ~ '^\d{4}-\d{2}$'),
  franchise_id   text        not null,
  escreveram     int         not null default 0,  -- telefones distintos que mandaram mensagem ao robô
  com_humano     int         not null default 0,  -- dos que escreveram, quantos tiveram resposta humana DEPOIS
  faturamento    numeric     not null default 0,  -- value - desconto + taxa de entrega, por sale_date
  vendas         int         not null default 0,
  atualizado_em  timestamptz not null default now(),
  -- funil da unidade (relatório completo do Assessor); contados por telefone no mês
  vendas_robo        int not null default 0,
  pagto              int not null default 0,  -- robô chegou a passar pagamento (Pix, forma de pagamento, confirmar)
  pagto_sem_compra   int not null default 0,  -- desses, sem venda lançada para o telefone no mês
  acabou             int not null default 0,  -- robô disse que não tinha / acabou (não prova ruptura sozinho)
  anuncio_pessoas    int not null default 0,  -- escreveram e o contato tem marca de clique em anúncio (ctwa/meta_ad_id)
  anuncio_compraram  int not null default 0,
  espont_pessoas     int not null default 0,
  espont_compraram   int not null default 0,
  primary key (mes, franchise_id)
);
alter table public.cs_rede_mes add column if not exists vendas_robo int not null default 0,
  add column if not exists pagto int not null default 0, add column if not exists pagto_sem_compra int not null default 0,
  add column if not exists acabou int not null default 0, add column if not exists anuncio_pessoas int not null default 0,
  add column if not exists anuncio_compraram int not null default 0, add column if not exists espont_pessoas int not null default 0,
  add column if not exists espont_compraram int not null default 0;
alter table public.cs_rede_mes enable row level security;
revoke all on table public.cs_rede_mes from anon, authenticated;
grant select, insert, update, delete on table public.cs_rede_mes to service_role;

create or replace function public.cs_rede_mes_atualizar(p_mes text)
returns int
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '120s'
as $function$
declare
  d_ini date;
  t_ini timestamptz;
  t_fim timestamptz;
  n int;
begin
  if p_mes is null or p_mes !~ '^\d{4}-\d{2}$' then
    raise exception 'mes invalido: %', p_mes;
  end if;
  d_ini := (p_mes || '-01')::date;
  t_ini := d_ini::timestamp at time zone 'America/Sao_Paulo';
  t_fim := (d_ini + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  insert into public.cs_rede_mes as r (mes, franchise_id, escreveram, com_humano, faturamento, vendas, atualizado_em,
         vendas_robo, pagto, pagto_sem_compra, acabou, anuncio_pessoas, anuncio_compraram, espont_pessoas, espont_compraram)
  with m as (
    select bc.franchise_id, public.normalize_phone_key(bc.contact_phone) as tel,
           min(x.created_at) filter (where x.direction = 'in')    as pin,
           max(x.created_at) filter (where x.direction = 'human') as uh,
           bool_or(x.direction = 'out' and x.content ~* '(chave|c[oó]digo) (do )?pix|forma de pagamento|maquininha|posso confirmar|finalizar o pedido') as pagto,
           bool_or(x.direction = 'out' and x.content ~* 'n[ãa]o (est[áa] )?dispon[ií]vel|n[ãa]o (tenho|temos)|sem estoque|esgotad|acabou') as acabou
      from public.bot_conversations bc
      join public.conversation_messages x on x.conversation_id = bc.id
     where bc.started_at >= t_ini and bc.started_at < t_fim
     group by bc.franchise_id, bc.id, 2
  ), p as (
    select franchise_id, tel, bool_or(pin is not null) as esc, bool_or(uh > pin) as hum,
           bool_or(pagto) as pagto, bool_or(acabou) as acabou
      from m where tel is not null group by 1, 2
  ), sv as (
    select franchise_id, public.normalize_phone_key(contact_phone) as tel, source,
           value - coalesce(discount_amount, 0) + coalesce(delivery_fee, 0) as liq
      from public.sales
     where sale_date >= d_ini and sale_date < (d_ini + interval '1 month')::date
  ), comp as (
    select distinct franchise_id, tel from sv where tel is not null
  ), ct as (
    select franchise_id, public.normalize_phone_key(telefone) as tel,
           bool_or(ctwa_clid is not null or meta_ad_id is not null) as anuncio
      from public.contacts
     where telefone is not null
     group by 1, 2
  ), a as (
    select p.franchise_id,
           count(*) filter (where p.esc) as escreveram,
           count(*) filter (where p.esc and p.hum) as com_humano,
           count(*) filter (where p.pagto) as pagto,
           count(*) filter (where p.pagto and comp.tel is null) as pagto_sem_compra,
           count(*) filter (where p.acabou) as acabou,
           count(*) filter (where p.esc and coalesce(ct.anuncio, false)) as an_p,
           count(*) filter (where p.esc and coalesce(ct.anuncio, false) and comp.tel is not null) as an_c,
           count(*) filter (where p.esc and not coalesce(ct.anuncio, false)) as es_p,
           count(*) filter (where p.esc and not coalesce(ct.anuncio, false) and comp.tel is not null) as es_c
      from p
      left join comp on comp.franchise_id = p.franchise_id and comp.tel = p.tel
      left join ct on ct.franchise_id = p.franchise_id and ct.tel = p.tel
     group by p.franchise_id
  ), v as (
    select franchise_id, sum(liq) as fat, count(*) as vendas, count(*) filter (where source = 'bot') as vendas_robo
      from sv group by 1
  )
  select p_mes, f.evolution_instance_id, coalesce(a.escreveram, 0), coalesce(a.com_humano, 0),
         coalesce(v.fat, 0), coalesce(v.vendas, 0), now(),
         coalesce(v.vendas_robo, 0), coalesce(a.pagto, 0), coalesce(a.pagto_sem_compra, 0), coalesce(a.acabou, 0),
         coalesce(a.an_p, 0), coalesce(a.an_c, 0), coalesce(a.es_p, 0), coalesce(a.es_c, 0)
    from public.franchises f
    left join a on a.franchise_id = f.evolution_instance_id
    left join v on v.franchise_id = f.evolution_instance_id
   where f.evolution_instance_id is not null
     and not coalesce(f.is_test, false)
     and (a.franchise_id is not null or v.franchise_id is not null)
  on conflict (mes, franchise_id) do update
     set escreveram = excluded.escreveram, com_humano = excluded.com_humano,
         faturamento = excluded.faturamento, vendas = excluded.vendas, atualizado_em = excluded.atualizado_em,
         vendas_robo = excluded.vendas_robo, pagto = excluded.pagto, pagto_sem_compra = excluded.pagto_sem_compra,
         acabou = excluded.acabou, anuncio_pessoas = excluded.anuncio_pessoas, anuncio_compraram = excluded.anuncio_compraram,
         espont_pessoas = excluded.espont_pessoas, espont_compraram = excluded.espont_compraram;
  get diagnostics n = row_count;
  return n;
end
$function$;
revoke execute on function public.cs_rede_mes_atualizar(text) from public, anon, authenticated;

select cron.unschedule('cs-rede-mes') where exists (select 1 from cron.job where jobname = 'cs-rede-mes');
-- Toda noite: mês corrente (até ontem) e o anterior (fecha o mês que acabou de virar).
select cron.schedule(
  'cs-rede-mes',
  '40 7 * * *',
  $cron$
    select public.cs_rede_mes_atualizar(to_char((now() at time zone 'America/Sao_Paulo') - interval '1 month', 'YYYY-MM'));
    select public.cs_rede_mes_atualizar(to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'));
  $cron$
);
