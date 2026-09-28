-- S4.6 (28/09/2026): telefone '' -> NULL em 78 contatos (todos criados à mão em mar-abr/2026).
-- Hoje o trigger trg_normalize_contact_telefone (normalize_phone_br) já devolve NULL para vazio,
-- então nada novo nasce assim; eram restos de antes do trigger. O índice único parcial
-- contacts_franchise_phone_unique ignora NULL e '' igualmente: nenhuma colisão possível.
-- APLICADO pelo MCP em 28/09/2026 (78 linhas; conferido em consulta separada: 0 restantes).
-- ROLLBACK:
--   update public.contacts c set telefone = b.telefone
--     from public._backup_contacts_telefone_vazio_2026_09_28 b where b.id = c.id and c.telefone is null;
create table if not exists public._backup_contacts_telefone_vazio_2026_09_28 as
  select id, telefone, updated_at from public.contacts where telefone = '';
alter table public._backup_contacts_telefone_vazio_2026_09_28 enable row level security;
revoke all on public._backup_contacts_telefone_vazio_2026_09_28 from anon, authenticated;
update public.contacts set telefone = null
 where telefone = '' and id in (select id from public._backup_contacts_telefone_vazio_2026_09_28);
