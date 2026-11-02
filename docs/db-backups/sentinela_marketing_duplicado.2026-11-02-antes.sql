CREATE OR REPLACE FUNCTION public.sentinela_marketing_duplicado()
 RETURNS TABLE(franquia text, mes text, valor numeric, descricoes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(f.name, e.franchise_id) as franquia,
    to_char(date_trunc('month', e.expense_date), 'MM/YYYY') as mes,
    e.amount as valor,
    string_agg(distinct e.description, ' | ') as descricoes
  from expenses e
  left join franchises f on f.evolution_instance_id = e.franchise_id
  where e.category = 'marketing'
  group by 1, 2, 3
  having count(*) > 1
     and count(*) filter (where e.source = 'marketing_payment') >= 1
     and count(*) filter (where e.source is null or e.source = 'manual') >= 1;
$function$
