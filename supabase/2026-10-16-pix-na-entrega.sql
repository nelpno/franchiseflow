-- 2026-10-16 — "Aceito Pix na entrega" por unidade (Uberaba/Verônica).
-- franchise_configurations.pix_on_delivery (boolean, padrão false) + exposição na vw_dadosunidade (última coluna).
-- O robô (V5 aRBzPABwrjhWCPvq, Customer Context → __pagamentoFatos) lê do dadosunidade (select *): ligado, a linha de
-- pagamento diz que o Pix pode ser pago na hora da entrega/retirada; desligado, nada muda.
--
-- ROLLBACK (na ordem; o robô trata coluna ausente como desligada):
--   do $$ declare d text; begin
--     d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
--     d := replace(d, E',\n    COALESCE(pix_on_delivery, false) AS pix_on_delivery\n   FROM franchise_configurations fc', E'\n   FROM franchise_configurations fc');
--     execute 'drop view public.vw_dadosunidade';  -- remover coluna de view exige recriar (conferir dependentes antes)
--     execute 'create view public.vw_dadosunidade with (security_invoker = true) as ' || d;
--     execute 'grant select on public.vw_dadosunidade to authenticated, service_role';  -- grants de 16/10 (anon não tem)
--   end $$;
--   alter table public.franchise_configurations drop column pix_on_delivery;
-- Desligar sem rollback: update franchise_configurations set pix_on_delivery = false where franchise_evolution_instance_id = '<evo>';

alter table public.franchise_configurations
  add column if not exists pix_on_delivery boolean not null default false;

comment on column public.franchise_configurations.pix_on_delivery is
  'Aceita Pix pago na hora da entrega/retirada (o cliente paga quando recebe). Padrão false = Pix antecipado. Lido pelo robô vendedor via vw_dadosunidade (16/10/2026).';

-- Recria a view com a coluna nova no FIM (create or replace só aceita coluna acrescentada no fim), mesma definição viva.
do $$
declare d text;
begin
  d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
  if position('pix_on_delivery' in d) > 0 then return; end if;
  if position(E'\n   FROM franchise_configurations fc;' in d) = 0 then raise exception 'vw_dadosunidade: final inesperado'; end if;
  d := replace(d, E'\n   FROM franchise_configurations fc;', E',\n    COALESCE(pix_on_delivery, false) AS pix_on_delivery\n   FROM franchise_configurations fc');
  execute 'create or replace view public.vw_dadosunidade with (security_invoker = true) as ' || d;
end $$;
