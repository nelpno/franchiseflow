-- Visita única do cardápio (26/11/2026, Nelson: "veja se está correto esse visita única para não errar os números").
--
-- Antes: "visitas" = linhas de medidor_sessoes = abas do navegador (sessionStorage). A mesma pessoa que volta do
-- WhatsApp/Instagram com a aba recarregada, ou abre de novo mais tarde, contava de novo (30 dias até 26/11: 4.238
-- abas, 510 reaberturas do mesmo aparelho em < 30 min, 3.418 visitas únicas por dia = −19%).
-- Agora: VISITA = mesmo aparelho (tipo, sistema, navegador, app, tela, densidade) na mesma unidade conta 1 vez por
-- dia de Brasília. Sem id persistente no navegador (a política de privacidade do cardápio fala só em contadores);
-- dois celulares idênticos no mesmo dia e unidade viram 1 (erra para baixo, pouco).
--
-- E o medidor apaga as sessões com 30 dias (cron medidor-retencao-30d; a /privacidade/ promete 30 dias): o "Mês
-- anterior" e o "mesmo trecho do mês anterior" do Canais de venda iam perder visitas a partir de 04/12. Por isso a
-- contagem de cada visita (só unidade, dia, hora da 1ª abertura, nº de aberturas e se veio do Instagram; nada do
-- aparelho) fica guardada em cardapio_visitas, regravada todo dia para os últimos 29 dias.
--
-- Rollback: supabase/2026-11-26-cardapio-visitas-unicas-ROLLBACK.sql

create table if not exists public.cardapio_visitas (
  unidade text not null,
  dia date not null,                 -- dia em Brasília
  n integer not null,                -- ordem da visita no dia (só para a chave)
  primeira_em timestamptz not null,  -- 1ª abertura da visita
  aberturas integer not null,
  instagram boolean not null default false,
  primary key (unidade, dia, n)
);
create index if not exists cardapio_visitas_primeira_idx on public.cardapio_visitas (primeira_em);
alter table public.cardapio_visitas enable row level security;
-- só backend (as RPCs SECURITY DEFINER leem): sem grant a anon/authenticated
revoke all on table public.cardapio_visitas from public, anon, authenticated;
grant select, insert, update, delete on table public.cardapio_visitas to service_role;

-- Visitas únicas ao vivo, direto do medidor (só vale para os últimos ~30 dias).
create or replace function public.cardapio_visitas_vivas(p_ini timestamptz, p_fim timestamptz)
returns table (unidade text, dia date, primeira_em timestamptz, aberturas bigint, instagram boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.unidade, (s.criado_em at time zone 'America/Sao_Paulo')::date, min(s.criado_em), count(*),
         coalesce(bool_or(s.app = 'instagram' or s.utm_source ilike 'instagram%' or s.origem ilike '%instagram%'), false)
    from medidor_sessoes s
   where not coalesce(s.teste, false) and s.criado_em >= p_ini and s.criado_em < p_fim
   group by s.unidade, (s.criado_em at time zone 'America/Sao_Paulo')::date,
            -- sessão sem dados do aparelho (a 1ª chamada não chegou) conta sozinha
            case when s.tela_w is null and s.dispositivo is null then 's:' || s.sessao
                 else concat_ws('|', s.dispositivo, s.so, s.navegador, s.app, s.tela_w, s.tela_h, s.dpr) end
$$;

-- Visitas únicas de qualquer período: dias recentes ao vivo, os antigos da cardapio_visitas.
create or replace function public.cardapio_visitas_unicas(p_ini timestamptz, p_fim timestamptz)
returns table (unidade text, primeira_em timestamptz, aberturas bigint, instagram boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with c as (select (((now() at time zone 'America/Sao_Paulo')::date - 27)::timestamp at time zone 'America/Sao_Paulo') t)
  select v.unidade, v.primeira_em, v.aberturas, v.instagram
    from c, public.cardapio_visitas_vivas(greatest(p_ini, c.t), p_fim) v
  union all
  select g.unidade, g.primeira_em, g.aberturas::bigint, g.instagram
    from c, public.cardapio_visitas g
   where g.primeira_em >= p_ini and g.primeira_em < least(p_fim, c.t)
$$;

-- Regrava os últimos 29 dias completos (o medidor ainda tem todos inteiros; ele apaga com 30).
create or replace function public.cardapio_visitas_guardar()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer;
begin
  delete from cardapio_visitas where dia between v_hoje - 29 and v_hoje - 1;
  insert into cardapio_visitas (unidade, dia, n, primeira_em, aberturas, instagram)
  select v.unidade, v.dia, row_number() over (partition by v.unidade, v.dia order by v.primeira_em),
         v.primeira_em, v.aberturas, v.instagram
    from public.cardapio_visitas_vivas((v_hoje - 29)::timestamp at time zone 'America/Sao_Paulo',
                                       v_hoje::timestamp at time zone 'America/Sao_Paulo') v;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.cardapio_visitas_vivas(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.cardapio_visitas_unicas(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.cardapio_visitas_guardar() from public, anon, authenticated;

-- 00h15 de Brasília (antes da retenção do medidor, 01h41)
select cron.schedule('cardapio-visitas-guardar', '15 3 * * *', 'select public.cardapio_visitas_guardar()');
select public.cardapio_visitas_guardar();
