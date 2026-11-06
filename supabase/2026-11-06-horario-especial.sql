-- 2026-11-06 — Horário especial com data (pedido da Bárbara, Jd. Santa Maria; SPEC
-- bots/vendedor/docs/plans/2026-11-dados-da-loja/). De [data] até [data]: "fechado" ou "horário diferente"
-- (abre/fecha), valendo para entrega, retirada ou as duas. O horário da semana não muda.
--
-- franchise_configurations.horario_especial jsonb, padrão '[]'. Item:
--   {"de":"2026-11-06","ate":"2026-11-06","tipo":"fechado"|"horario","abre":"09:00","fecha":"15:00",
--    "vale":"ambos"|"entrega"|"retirada"}
-- Quem lê: V5 aRBzPABwrjhWCPvq › Customer Context (dadosunidade = select * da view), DistanceService › Cota Frete
-- (vai dentro do pricing que o GetDistance CB manda) e EnviaPedidoFechado V2 › Agenda Unidade/Prepare Sale Data.
-- Tabela existente: a RLS de update e os grants dela já valem para a coluna nova.
--
-- ROLLBACK (na ordem; os três leitores tratam coluna ausente ou lista vazia como "sem exceção"):
--   1) antes, tirar horario_especial do select do nó Agenda Unidade (RnF1): sem a coluna o PostgREST dá 400 e o
--      pedido para outro dia vira "agenda_indisponivel" (scripts/apply-horario-especial-2026-11-06.mjs --rollback)
--   2) do $$ declare d text; begin
--        d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
--        d := replace(d, E',\n    COALESCE(horario_especial, ''[]''::jsonb) AS horario_especial\n   FROM franchise_configurations fc', E'\n   FROM franchise_configurations fc');
--        execute 'drop view public.vw_dadosunidade';  -- remover coluna de view exige recriar (conferir dependentes antes)
--        execute 'create view public.vw_dadosunidade with (security_invoker = true) as ' || d;
--        execute 'grant select on public.vw_dadosunidade to authenticated, service_role';  -- anon não tem
--      end $$;
--   3) alter table public.franchise_configurations drop column horario_especial;
-- Desligar sem rollback: update franchise_configurations set horario_especial = '[]' where id = '<uuid>';

alter table public.franchise_configurations
  add column if not exists horario_especial jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'franchise_configurations_horario_especial_array') then
    alter table public.franchise_configurations
      add constraint franchise_configurations_horario_especial_array check (jsonb_typeof(horario_especial) = 'array');
  end if;
end $$;

comment on column public.franchise_configurations.horario_especial is
  'Horário especial por data (feriado, viagem, evento): [{de, ate, tipo fechado|horario, abre, fecha, vale ambos|entrega|retirada}]. Vale só nas datas; o horário da semana não muda. Lido pelo robô vendedor via vw_dadosunidade (06/11/2026).';

-- Recria a view com a coluna nova no FIM (create or replace só aceita coluna acrescentada no fim), mesma definição viva.
do $$
declare d text;
begin
  d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
  if position('horario_especial' in d) > 0 then return; end if;
  if position(E'\n   FROM franchise_configurations fc;' in d) = 0 then raise exception 'vw_dadosunidade: final inesperado'; end if;
  d := replace(d, E'\n   FROM franchise_configurations fc;', E',\n    COALESCE(horario_especial, ''[]''::jsonb) AS horario_especial\n   FROM franchise_configurations fc');
  execute 'create or replace view public.vw_dadosunidade with (security_invoker = true) as ' || d;
end $$;
