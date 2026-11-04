-- Telemetria do app no NOSSO banco (04/11/2026, revisão de uso, itens 5 e 6).
-- Os eventos (Isso resolveu?, manual baixado, modelo de pedido...) só existiam no painel do
-- Clarity, que ninguém lia e a API não entrega; o seletor do clique sem resposta também não
-- vem pela API. Agora o app grava aqui, em lote, pela RPC `registrar_eventos_app`.
--
-- O que NÃO entra: texto da tela, nome, telefone, query string (só `?tab=`/`?aba=`/`?abrir=`).
-- `alvo` = seletor do elemento (tag.classes, até 3 níveis), nunca o texto dele.
-- Leitura: só service_role / SQL (admin pelo MCP). Tabela de backend: sem grant a anon/authenticated.
-- Limpeza: cron mensal apaga o que passou de 180 dias.
--
-- ROLLBACK:
--   select cron.unschedule('app-eventos-limpeza');
--   drop function if exists public.registrar_eventos_app(jsonb);
--   drop table if exists public.app_eventos;

create table if not exists public.app_eventos (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  user_id      uuid not null,
  papel        text,
  franquia_id  uuid,
  evento       text not null check (evento ~ '^[a-z0-9_]{1,80}$'),
  detalhe      text check (length(detalhe) <= 80),
  tela         text check (length(tela) <= 120),
  alvo         text check (length(alvo) <= 200),
  aparelho     text check (aparelho in ('celular', 'tablet', 'pc'))
);

create index if not exists app_eventos_evento_idx on public.app_eventos (evento, criado_em desc);
create index if not exists app_eventos_franquia_idx on public.app_eventos (franquia_id, criado_em desc);
create index if not exists app_eventos_usuario_idx on public.app_eventos (user_id, criado_em desc); -- teto diário da RPC

alter table public.app_eventos enable row level security;
revoke all on table public.app_eventos from anon, authenticated, public;
grant select, insert, update, delete on table public.app_eventos to service_role;

-- Recebe até 50 eventos: [{e, d, t, a, dev, fid}]. Ignora o que vier fora do formato
-- (telemetria nunca devolve erro à tela). Teto de 3.000 eventos por usuário por dia.
create or replace function public.registrar_eventos_app(p_eventos jsonb)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_papel  text;
  v_ids    text[];
  v_hoje   int;
  v_n      int;
begin
  if v_uid is null or jsonb_typeof(p_eventos) is distinct from 'array' then
    return 0;
  end if;

  -- managed_franchise_ids guarda o UUID da franquia E o evolution_instance_id: fica só com os UUIDs.
  select role, array(select x from unnest(managed_franchise_ids) x where x ~ '^[0-9a-f-]{36}$')
    into v_papel, v_ids from profiles where id = v_uid;

  select count(*) into v_hoje from app_eventos
   where user_id = v_uid and criado_em > now() - interval '1 day';
  if v_hoje >= 3000 then
    return 0;
  end if;

  insert into app_eventos (user_id, papel, franquia_id, evento, detalhe, tela, alvo, aparelho)
  select v_uid, v_papel,
         case when x->>'fid' = any(v_ids) then (x->>'fid')::uuid
              when coalesce(array_length(v_ids, 1), 0) = 1 then v_ids[1]::uuid end,
         x->>'e',
         left(nullif(x->>'d', ''), 80),
         left(nullif(x->>'t', ''), 120),
         left(nullif(x->>'a', ''), 200),
         case when x->>'dev' in ('celular', 'tablet', 'pc') then x->>'dev' end
    from (select value x from jsonb_array_elements(p_eventos) limit 50) s
   where coalesce(x->>'e', '') ~ '^[a-z0-9_]{1,80}$'
     and (x->>'fid' is null or x->>'fid' ~ '^[0-9a-f-]{36}$');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke execute on function public.registrar_eventos_app(jsonb) from public, anon;
grant execute on function public.registrar_eventos_app(jsonb) to authenticated;

select cron.schedule('app-eventos-limpeza', '17 6 1 * *',
  $$delete from public.app_eventos where criado_em < now() - interval '180 days'$$);
