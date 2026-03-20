-- RPC que retorna posição do franqueado no ranking do dia
-- Sem expor faturamento de outras franquias (seguro via RLS)
create or replace function get_franchise_ranking(p_date date, p_franchise_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'position', sub.position,
    'total_franchises', sub.total
  ) into result
  from (
    select
      ds.franchise_id,
      rank() over (order by coalesce(ds.sales_value, 0) desc) as position,
      count(*) over () as total
    from daily_summaries ds
    where ds.date = p_date
  ) sub
  where sub.franchise_id = p_franchise_id;

  if result is null then
    select json_build_object(
      'position', null,
      'total_franchises', (select count(*) from franchises where status = 'active')
    ) into result;
  end if;

  return result;
end;
$$;

grant execute on function get_franchise_ranking(date, uuid) to authenticated;
