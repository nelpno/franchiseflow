-- Sentinela: despesa de marketing duplicada que cruza o mes (02/11/2026).
-- Caso Uberaba: a franqueada envia a verba de novembro em 29/10 e lanca na mao
-- "ADS Facebook" R$ 500 no mesmo dia; a despesa automatica sai com data 01/11.
-- A regra antiga so casava despesas do MESMO mes, entao achou o par por sorte
-- (com a verba de outubro) e nao teria achado se outubro nao tivesse verba.
-- Agora: uma linha por despesa MANUAL que tem automatica (marketing_payment)
-- de mesmo valor e mesma unidade no mesmo mes OU lancada ate 3 dias do envio
-- da verba OU com data ate 5 dias da automatica. "mes" = mes da manual
-- (o mes que ficou inflado).
-- ROLLBACK: node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/sentinela_marketing_duplicado.2026-11-02-antes.sql

CREATE OR REPLACE FUNCTION public.sentinela_marketing_duplicado()
 RETURNS TABLE(franquia text, mes text, valor numeric, descricoes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(f.name, m.franchise_id) as franquia,
    to_char(date_trunc('month', m.expense_date), 'MM/YYYY') as mes,
    m.amount as valor,
    m.description || ' | ' || string_agg(distinct a.description, ' | ') as descricoes
  from expenses m
  join expenses a
    on a.franchise_id = m.franchise_id
   and a.amount = m.amount
   and a.category = 'marketing'
   and a.source = 'marketing_payment'
  left join marketing_payments mp on mp.id = a.source_id
  left join franchises f on f.evolution_instance_id = m.franchise_id
  where m.category = 'marketing'
    and coalesce(m.source, 'manual') = 'manual'
    and (date_trunc('month', m.expense_date) = date_trunc('month', a.expense_date)
         or abs(extract(epoch from (m.created_at - coalesce(mp.created_at, a.created_at)))) <= 3 * 86400
         or abs(m.expense_date - a.expense_date) <= 5)
  group by m.id, f.name, m.franchise_id, m.expense_date, m.amount, m.description;
$function$;

-- so a sentinela_diaria (definer) chama; o front nao usa: franqueada logada nao le a rede
revoke execute on function public.sentinela_marketing_duplicado() from public, anon, authenticated;
