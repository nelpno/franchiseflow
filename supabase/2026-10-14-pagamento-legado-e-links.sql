-- 14/10/2026 — rodar SÓ DEPOIS da Z3 publicada (a bateria dela usa o cadastro real).
-- 1) "card_machine" legado (invisível no painel: a franqueada não consegue desmarcar) vira crédito + débito.
-- 2) Link de pagamento gravado sem https:// (Limeira, Sant. Parnaíba, Sant. Parnaíba 1), salvo antes do conserto do save.
-- Backup na mesma transação; desfazer no fim do arquivo.

begin;

create table if not exists public._bkp_pagamento_2026_10_14 as
select id, payment_delivery, payment_pickup, payment_link, now() as feito_em
from public.franchise_configurations
where 'card_machine' = any(coalesce(payment_delivery, '{}'))
   or 'card_machine' = any(coalesce(payment_pickup, '{}'))
   or (coalesce(payment_link, '') <> '' and payment_link !~* '^https?://');
alter table public._bkp_pagamento_2026_10_14 enable row level security;

update public.franchise_configurations fc
set payment_delivery = (
      select array_agg(distinct v order by v)
      from unnest(array_remove(fc.payment_delivery, 'card_machine') || array['credit', 'debit']) v)
where 'card_machine' = any(coalesce(fc.payment_delivery, '{}'));

update public.franchise_configurations fc
set payment_pickup = (
      select array_agg(distinct v order by v)
      from unnest(array_remove(fc.payment_pickup, 'card_machine') || array['credit', 'debit']) v)
where 'card_machine' = any(coalesce(fc.payment_pickup, '{}'));

update public.franchise_configurations
set payment_link = 'https://' || payment_link
where coalesce(payment_link, '') <> '' and payment_link !~* '^https?://';

-- conferência: tem de dar 0 / 0 / 0
select count(*) filter (where 'card_machine' = any(coalesce(payment_delivery, '{}'))) as legado_entrega,
       count(*) filter (where 'card_machine' = any(coalesce(payment_pickup, '{}'))) as legado_retirada,
       count(*) filter (where coalesce(payment_link, '') <> '' and payment_link !~* '^https?://') as link_sem_https
from public.franchise_configurations;

commit;

-- DESFAZER:
-- update public.franchise_configurations fc set payment_delivery = b.payment_delivery, payment_pickup = b.payment_pickup, payment_link = b.payment_link
-- from public._bkp_pagamento_2026_10_14 b where b.id = fc.id;
