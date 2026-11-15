-- 2026-11-10 — "Na retirada, o cliente pode pagar: antes, para reservar | na hora da retirada" por unidade
-- (decisão do Nelson 10/11/2026; caso do Imirim: cliente de retirada desconfia de pagar antes).
-- franchise_configurations.pickup_pay_on_pickup (boolean, padrão false = regra de hoje: Pix pago antes) + exposição
-- na vw_dadosunidade (última coluna). Escreve: Meu robô › Entrega e retirada (FranchiseSettings.jsx). Lê: robô
-- vendedor (V5 aRBzPABwrjhWCPvq, Customer Context → __pagamentoFatos, linha RETIRADA; select * do dadosunidade).
-- Ligado: na RETIRADA (hoje ou outro dia da lista) o Pix também pode ser pago na hora; o robô fecha com
-- pagamento "pix na retirada" (venda a receber), sem pedir comprovante. Entrega não muda.
--
-- ROLLBACK (na ordem; o robô trata coluna ausente como desligada):
--   do $$ declare d text; begin
--     d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
--     d := replace(d, E',\n    COALESCE(pickup_pay_on_pickup, false) AS pickup_pay_on_pickup\n   FROM franchise_configurations fc', E'\n   FROM franchise_configurations fc');
--     execute 'drop view public.vw_dadosunidade';  -- remover coluna de view exige recriar (conferir dependentes antes)
--     execute 'create view public.vw_dadosunidade with (security_invoker = true) as ' || d;
--     execute 'grant select on public.vw_dadosunidade to authenticated, service_role';
--   end $$;
--   alter table public.franchise_configurations drop column pickup_pay_on_pickup;
-- Desligar sem rollback: update franchise_configurations set pickup_pay_on_pickup = false where franchise_evolution_instance_id = '<evo>';
-- Backup da view antes: docs/db-backups/vw_dadosunidade.2026-11-10-antes-pagar-na-retirada.sql (md5 6141b67e8e7a0ac98e8d166b966d25c1).

alter table public.franchise_configurations
  add column if not exists pickup_pay_on_pickup boolean not null default false;

comment on column public.franchise_configurations.pickup_pay_on_pickup is
  'Na retirada o cliente pode pagar na hora (Pix incluso), sem pagar antes para reservar. Padrão false = Pix pago antes. Lido pelo robô vendedor via vw_dadosunidade (10/11/2026).';

-- Recria a view com a coluna nova no FIM (create or replace só aceita coluna acrescentada no fim), mesma definição viva.
do $$
declare d text;
begin
  d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
  if position('pickup_pay_on_pickup' in d) > 0 then return; end if;
  if position(E'\n   FROM franchise_configurations fc;' in d) = 0 then raise exception 'vw_dadosunidade: final inesperado'; end if;
  d := replace(d, E'\n   FROM franchise_configurations fc;', E',\n    COALESCE(pickup_pay_on_pickup, false) AS pickup_pay_on_pickup\n   FROM franchise_configurations fc');
  execute 'create or replace view public.vw_dadosunidade with (security_invoker = true) as ' || d;
end $$;
