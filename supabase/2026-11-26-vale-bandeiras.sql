-- 2026-11-26 — Vale-alimentação separado do vale-refeição + bandeiras de vale aceitas (pedido da Bárbara, Jd. Santa Maria:
-- "só liberaram o alimentação pro meu CNPJ, e no painel só tinha vale-refeição"). Forma nova = código 'food_voucher' em
-- payment_delivery/payment_pickup (TEXT[], o banco não muda). Bandeiras = franchise_configurations.vale_bandeiras (TEXT[]
-- com os NOMES como o painel mostra: "Alelo", "Ticket", "VR", "Pluxee (Sodexo)"...), uma lista para os dois vales.
-- NULL de propósito = a unidade ainda não revisou os vales depois desta mudança: o robô não afirma nem nega o
-- vale-alimentação de quem só tinha o vale-refeição marcado (antes não havia a opção). O painel grava [] ou a lista
-- quando a franqueada mexe em qualquer vale. Exposição na vw_dadosunidade (última coluna, sem coalesce: o NULL é o sinal).
-- Escreve: Meu robô › Pagamento (FranchiseSettings.jsx). Lê: robô vendedor (V5 aRBzPABwrjhWCPvq, Customer Context →
-- __pagamentoFatos; select * do dadosunidade).
--
-- ROLLBACK (na ordem; o robô trata coluna ausente como "não revisado"):
--   do $$ declare d text; begin
--     d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
--     d := replace(d, E',\n    vale_bandeiras\n   FROM franchise_configurations fc', E'\n   FROM franchise_configurations fc');
--     execute 'drop view public.vw_dadosunidade';  -- remover coluna de view exige recriar (conferir dependentes antes)
--     execute 'create view public.vw_dadosunidade with (security_invoker = true) as ' || d;
--     execute 'grant select on public.vw_dadosunidade to authenticated, service_role';
--   end $$;
--   alter table public.franchise_configurations drop column vale_bandeiras;
-- Backup da view antes: docs/db-backups/vw_dadosunidade.2026-11-26-antes-vale-bandeiras.sql

alter table public.franchise_configurations
  add column if not exists vale_bandeiras text[];

comment on column public.franchise_configurations.vale_bandeiras is
  'Bandeiras de vale (refeição e alimentação) aceitas, com o nome do painel. NULL = vales ainda não revisados após 26/11/2026 (o robô não afirma o vale-alimentação); [] = revisou e não marcou bandeira. Lido pelo robô vendedor via vw_dadosunidade.';

do $$
declare d text;
begin
  d := pg_get_viewdef('public.vw_dadosunidade'::regclass, true);
  if position('vale_bandeiras' in d) > 0 then return; end if;
  if position(E'\n   FROM franchise_configurations fc;' in d) = 0 then raise exception 'vw_dadosunidade: final inesperado'; end if;
  d := replace(d, E'\n   FROM franchise_configurations fc;', E',\n    vale_bandeiras\n   FROM franchise_configurations fc');
  execute 'create or replace view public.vw_dadosunidade with (security_invoker = true) as ' || d;
end $$;
