-- 08 — migração one-time cs_worklist -> cs_tasks (source='manual'). Idempotente por signal_key.
-- Ordem: (1) migrar linhas manual, (2) religar eventos antigos por signal_key.
-- NÃO chama reconcile aqui (via service_role auth.uid() é null e a RPC exige is_cs_or_admin);
-- o reconcile roda no 1º load do board (usuário CS/admin autenticado).
-- cs_worklist é mantida (deprecada) até validar o board com dados reais.

insert into cs_tasks (franchise_id, title, column_status, source, signal_key, created_by, created_at, updated_at, resolved_at, moved_to_column_at)
select w.franchise_id, 'Acompanhamento (migrado)',
  case w.status when 'a_contatar'      then 'a_fazer'
                when 'contatado'        then 'aguardando_retorno'
                when 'reuniao_marcada'  then 'aguardando_retorno'
                when 'resolvido'        then 'feito' end,
  'manual', 'migrated:'||w.franchise_id, w.updated_by, w.updated_at, w.updated_at,
  w.resolved_at, coalesce(w.last_contact_at, w.updated_at)
from cs_worklist w
where not exists (select 1 from cs_tasks t where t.signal_key = 'migrated:'||w.franchise_id);

-- religar eventos antigos (task_id null) ao cartão migrado, casando por signal_key
update cs_worklist_events e set task_id = t.id
from cs_tasks t
where t.signal_key = 'migrated:'||e.franchise_id and e.task_id is null;
