-- RPC que retorna posição do franqueado no ranking do dia
-- Sem expor faturamento de outras franquias (seguro via RLS)
-- Drop old UUID version if exists
drop function if exists get_franchise_ranking(date, uuid);

create or replace function get_franchise_ranking(p_date date, p_franchise_id text)
returns json
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  result json;
begin
  -- Security: caller must own this franchise or be admin/manager
  if not (
    is_admin_or_manager()
    or p_franchise_id = any(managed_franchise_ids())
  ) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  -- Tempo real: agrega direto de sales (faturamento = value + delivery_fee - discount_amount)
  select json_build_object(
    'position', sub.position,
    'total_franchises', sub.total
  ) into result
  from (
    select
      agg.franchise_id,
      rank() over (order by agg.total desc) as position,
      count(*) over () as total
    from (
      select
        s.franchise_id,
        sum(coalesce(s.value, 0) + coalesce(s.delivery_fee, 0) - coalesce(s.discount_amount, 0)) as total
      from sales s
      where s.sale_date = p_date
      group by s.franchise_id
    ) agg
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

grant execute on function get_franchise_ranking(date, text) to authenticated;
