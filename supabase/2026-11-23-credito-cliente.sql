-- Crédito do cliente (troco que fica, pagou a mais, produto faltou, permuta). Pedido do Ricardo (Tatuapé), 21/11/2026.
-- Desenho aprovado pelo Nelson em 23/11: docs/arquitetura-beneficios.md (raiz da Maxi) § "Crédito do cliente".
--
-- Ideia central: a tabela guarda SÓ as entradas; o uso sai da própria venda (sales.credito_usado, que fica DENTRO
-- do discount_amount). Saldo = Σ entradas − Σ credito_usado das vendas do contato. Apagar/editar a venda devolve o
-- crédito sozinho, sem segunda contabilidade.
--
-- Trava: gatilho sales_credito_trava (BEFORE INSERT/UPDATE em sales), não só dentro do save_sale_with_items, para
-- valer em qualquer caminho de gravação. Trava o contato (for update) e recusa uso acima do saldo.
-- Apagar uma entrada só pela RPC cliente_credito_apagar (confere que o saldo não fica negativo); a tabela não tem
-- política de DELETE para a franqueada, então o delete_franchise_cascade (que apaga por franchise_id) segue livre.
--
-- Aplicar: node supabase/cs-cockpit/_aplica-lf.mjs supabase/2026-11-23-credito-cliente.sql
-- Backups antes: docs/db-backups/save_sale_with_items.2026-11-23-antes-credito.sql
--                docs/db-backups/sales_beneficio_uso.2026-11-23-antes-credito.sql
--
-- ROLLBACK (nesta ordem; a coluna e a tabela podem ficar, sem uso, se já houver dado):
--   select public.set_feature_flag('credito_cliente', null, false, 'rollback');
--   node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/save_sale_with_items.2026-11-23-antes-credito.sql
--   node supabase/cs-cockpit/_aplica-lf.mjs docs/db-backups/sales_beneficio_uso.2026-11-23-antes-credito.sql
--   create or replace trigger sales_beneficio_uso after update of desconto_origem, desconto_codigo, discount_amount on public.sales
--     for each row when ((new.desconto_origem is not null) or (old.desconto_origem is not null)) execute function sales_beneficio_uso();
--   drop trigger if exists sales_credito_trava on public.sales; drop function if exists public.sales_credito_trava();
--   drop function if exists public.cliente_credito_apagar(uuid);
--   drop view if exists public.cliente_credito_saldos;
--   -- só se nenhuma venda usou crédito (select count(*) from sales where credito_usado > 0 = 0):
--   alter table public.sales drop constraint if exists sales_credito_usado_chk; alter table public.sales drop column if exists credito_usado;
--   alter table public.sales drop constraint sales_desconto_origem_chk, add constraint sales_desconto_origem_chk check (desconto_origem is null
--     or desconto_origem = any (array['cupom','promocao','fidelidade','cashback','manual']));
--   drop table if exists public.cliente_creditos;

begin;

-- 1. Entradas de crédito ----------------------------------------------------------------------------------------
create table if not exists public.cliente_creditos (
  id uuid primary key default gen_random_uuid(),
  franchise_id text not null references public.franchises(evolution_instance_id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0 and valor <= 1000),
  motivo text not null check (motivo in ('troco', 'pagou_a_mais', 'faltou_produto', 'permuta', 'outro')),
  observacao text check (observacao is null or char_length(observacao) <= 140),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists cliente_creditos_contact_idx on public.cliente_creditos (contact_id);
create index if not exists cliente_creditos_franchise_idx on public.cliente_creditos (franchise_id);

-- A unidade vem SEMPRE do contato (a tela não escolhe): crédito num cliente que a pessoa não enxerga = recusado.
create or replace function public.cliente_creditos_antes_inserir()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_fr text;
begin
  select franchise_id into v_fr from contacts where id = new.contact_id;
  if v_fr is null then
    raise exception 'Crédito do cliente: cliente não encontrado.' using errcode = 'P0001';
  end if;
  new.franchise_id := v_fr;
  new.criado_por := coalesce(auth.uid(), new.criado_por);
  new.observacao := nullif(btrim(new.observacao), '');
  return new;
end;
$$;
create or replace trigger cliente_creditos_antes_inserir before insert on public.cliente_creditos
  for each row execute function public.cliente_creditos_antes_inserir();

alter table public.cliente_creditos enable row level security;
drop policy if exists cliente_creditos_select on public.cliente_creditos;
create policy cliente_creditos_select on public.cliente_creditos for select
  using ((select public.is_admin_or_manager()) or franchise_id = any ((select public.managed_franchise_ids())::text[]));
drop policy if exists cliente_creditos_insert on public.cliente_creditos;
create policy cliente_creditos_insert on public.cliente_creditos for insert
  with check ((select public.is_admin_or_manager()) or franchise_id = any ((select public.managed_franchise_ids())::text[]));
-- Sem UPDATE nem DELETE direto: errou o valor = apagar pela RPC (que confere o saldo) e lançar de novo.
revoke all on table public.cliente_creditos from anon, public;
grant select, insert, update, delete on table public.cliente_creditos to authenticated, service_role;

-- 2. Uso na venda ------------------------------------------------------------------------------------------------
alter table public.sales add column if not exists credito_usado numeric(10,2) not null default 0;
alter table public.sales drop constraint if exists sales_credito_usado_chk;
alter table public.sales add constraint sales_credito_usado_chk
  check (credito_usado >= 0 and credito_usado <= coalesce(discount_amount, 0) + 0.01);
create index if not exists sales_credito_usado_idx on public.sales (contact_id) where credito_usado > 0;

alter table public.sales drop constraint if exists sales_desconto_origem_chk;
alter table public.sales add constraint sales_desconto_origem_chk check (desconto_origem is null
  or desconto_origem = any (array['cupom', 'promocao', 'fidelidade', 'cashback', 'manual', 'credito']));

-- 3. Saldo por cliente (a tela lê daqui) ----------------------------------------------------------------------------
create or replace view public.cliente_credito_saldos with (security_invoker = true) as
select e.contact_id, e.franchise_id, e.entradas, coalesce(u.usado, 0)::numeric(10,2) as usado,
       (e.entradas - coalesce(u.usado, 0))::numeric(10,2) as saldo, e.ultima_entrada
  from (select contact_id, min(franchise_id) as franchise_id, sum(valor)::numeric(10,2) as entradas, max(created_at) as ultima_entrada
          from public.cliente_creditos group by contact_id) e
  left join (select contact_id, sum(credito_usado) as usado
               from public.sales where credito_usado > 0 and contact_id is not null group by contact_id) u
    on u.contact_id = e.contact_id;
revoke all on public.cliente_credito_saldos from anon, public;
grant select on public.cliente_credito_saldos to authenticated, service_role;

-- 4. Trava -----------------------------------------------------------------------------------------------------------
create or replace function public._brl(v numeric) returns text language sql immutable as $$
  select 'R$ ' || replace(to_char(round(coalesce(v, 0), 2), 'FM999999990.00'), '.', ',')
$$;
revoke all on function public._brl(numeric) from public, anon;

create or replace function public.sales_credito_trava()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_fr text;
  v_saldo numeric;
begin
  if coalesce(new.credito_usado, 0) <= 0 then return new; end if;
  if tg_op = 'UPDATE' and new.credito_usado <= coalesce(old.credito_usado, 0) then
    if new.contact_id is not distinct from old.contact_id then return new; end if;
    -- Cliente apagado (FK on delete set null, roda por dentro de outro gatilho): a venda fica como estava.
    if new.contact_id is null and pg_trigger_depth() > 1 then return new; end if;
  end if;
  if new.contact_id is null then
    raise exception 'Crédito do cliente: escolha o cliente da venda para usar o crédito dele.' using errcode = 'P0001';
  end if;
  select franchise_id into v_fr from contacts where id = new.contact_id for update;
  if v_fr is null or v_fr is distinct from new.franchise_id then
    raise exception 'Crédito do cliente: este cliente não é desta unidade.' using errcode = 'P0001';
  end if;
  select coalesce((select sum(valor) from cliente_creditos where contact_id = new.contact_id), 0)
       - coalesce((select sum(credito_usado) from sales
                    where contact_id = new.contact_id and credito_usado > 0 and id <> new.id), 0)
    into v_saldo;
  if new.credito_usado > v_saldo + 0.005 then
    raise exception 'Crédito do cliente: este cliente tem % de crédito para esta venda, e ela tenta usar %. Feche a venda, abra de novo e confira o saldo.',
      public._brl(greatest(v_saldo, 0)), public._brl(new.credito_usado) using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.sales_credito_trava() from public, anon;
create or replace trigger sales_credito_trava before insert or update of credito_usado, contact_id on public.sales
  for each row execute function public.sales_credito_trava();

-- 5. Apagar uma entrada (digitou errado) ----------------------------------------------------------------------------
create or replace function public.cliente_credito_apagar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c record;
  v_saldo numeric;
begin
  select * into c from cliente_creditos where id = p_id;
  if c.id is null then
    raise exception 'Crédito do cliente: lançamento não encontrado.' using errcode = 'P0001';
  end if;
  if not ((select public.is_admin_or_manager()) or c.franchise_id = any ((select public.managed_franchise_ids())::text[])) then
    raise exception 'Sem permissão para esta ação.' using errcode = '42501';
  end if;
  perform 1 from contacts where id = c.contact_id for update;
  select coalesce((select sum(valor) from cliente_creditos where contact_id = c.contact_id and id <> c.id), 0)
       - coalesce((select sum(credito_usado) from sales where contact_id = c.contact_id and credito_usado > 0), 0)
    into v_saldo;
  if v_saldo < -0.005 then
    raise exception 'Crédito do cliente: esse crédito já foi usado numa venda. Para desfazer, abra a venda, toque em "Não usar" no crédito e salve; depois apague aqui.'
      using errcode = 'P0001';
  end if;
  delete from cliente_creditos where id = c.id;
  return jsonb_build_object('apagado', c.id, 'saldo', round(v_saldo, 2));
end;
$$;
revoke all on function public.cliente_credito_apagar(uuid) from public, anon;
grant execute on function public.cliente_credito_apagar(uuid) to authenticated, service_role;

-- 6. Crédito não é uso de cupom/promoção: o registro de uso (beneficio_usos) guarda só o desconto SEM o crédito -------
create or replace function public.sales_beneficio_uso()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_canal text;
  v_valor numeric;
begin
  if tg_op = 'DELETE' then
    update beneficio_usos set venda_apagada_em = now() where sale_id = old.id and venda_apagada_em is null;
    return old;
  end if;
  -- 23/11/2026: crédito do cliente fica dentro do discount_amount, mas não é benefício (não conta como uso).
  v_valor := coalesce(new.discount_amount, 0) - coalesce(new.credito_usado, 0);
  if new.desconto_origem is null or new.desconto_origem = 'credito' or v_valor <= 0 then
    delete from beneficio_usos where sale_id = new.id;
    return new;
  end if;
  v_canal := case when new.source = 'bot' then
               case when exists (select 1 from conversation_messages m
                                  where m.franchise_id = new.franchise_id and m.direction = 'in'
                                    and m.created_at between new.created_at - interval '24 hours' and new.created_at
                                    and public.normalize_phone_key(m.contact_phone) = public.normalize_phone_key(new.contact_phone)
                                    and m.content like '%#PED-%') then 'cardapio' else 'conversa' end
             else 'manual' end;
  insert into beneficio_usos (franchise_id, tipo, codigo, sale_id, telefone, valor, canal, criado_em)
  values (new.franchise_id, new.desconto_origem, new.desconto_codigo, new.id, public.normalize_phone_br(new.contact_phone),
          v_valor, v_canal, coalesce(new.created_at, now()))
  on conflict (sale_id) do update set tipo = excluded.tipo, codigo = excluded.codigo, valor = excluded.valor, telefone = excluded.telefone;
  return new;
end;
$function$;
create or replace trigger sales_beneficio_uso after update of desconto_origem, desconto_codigo, discount_amount, credito_usado on public.sales
  for each row when ((new.desconto_origem is not null) or (old.desconto_origem is not null)) execute function public.sales_beneficio_uso();

-- 7. save_sale_with_items grava credito_usado (enumera colunas; tela antiga que não manda a chave não mexe no valor) ----
-- (corpo gerado a partir do backup vivo; só as duas linhas marcadas "23/11 crédito" mudaram)
CREATE OR REPLACE FUNCTION public.save_sale_with_items(p_sale_id uuid DEFAULT NULL::uuid, p_sale_data jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_client_id UUID;
  v_item JSONB;
BEGIN
  IF p_sale_id IS NOT NULL THEN
    UPDATE sales SET
      value = (p_sale_data->>'value')::numeric,
      contact_id = CASE WHEN p_sale_data->>'contact_id' IS NOT NULL AND p_sale_data->>'contact_id' != ''
                        THEN (p_sale_data->>'contact_id')::uuid ELSE NULL END,
      source = COALESCE(p_sale_data->>'source', 'manual'),
      payment_method = p_sale_data->>'payment_method',
      card_fee_percent = (p_sale_data->>'card_fee_percent')::numeric,
      card_fee_amount = (p_sale_data->>'card_fee_amount')::numeric,
      fee_passed_to_customer = NULLIF(p_sale_data->>'fee_passed_to_customer', '')::boolean,
      delivery_method = p_sale_data->>'delivery_method',
      delivery_fee = COALESCE((p_sale_data->>'delivery_fee')::numeric, 0),
      discount_amount = COALESCE((p_sale_data->>'discount_amount')::numeric, 0),
      discount_type = p_sale_data->>'discount_type',
      discount_input = (p_sale_data->>'discount_input')::numeric,
      -- 23/11 crédito: parte do discount_amount que é crédito do cliente (sem a chave = tela antiga: mantém)
      credito_usado = CASE WHEN p_sale_data ? 'credito_usado' THEN round(COALESCE(NULLIF(p_sale_data->>'credito_usado', '')::numeric, 0), 2) ELSE LEAST(sales.credito_usado, COALESCE((p_sale_data->>'discount_amount')::numeric, 0)) END,
      -- 11b: motivo do desconto (só muda se a tela mandar; tela antiga não apaga)
      desconto_origem = CASE WHEN p_sale_data ? 'desconto_origem' THEN NULLIF(p_sale_data->>'desconto_origem', '') ELSE sales.desconto_origem END,
      desconto_codigo = CASE WHEN p_sale_data ? 'desconto_codigo' THEN NULLIF(upper(btrim(p_sale_data->>'desconto_codigo')), '') ELSE sales.desconto_codigo END,
      net_value = (p_sale_data->>'net_value')::numeric,
      sale_date = (p_sale_data->>'sale_date')::date,
      observacoes = p_sale_data->>'observacoes',
      customer_address = CASE WHEN p_sale_data ? 'customer_address'
                              THEN NULLIF(p_sale_data->>'customer_address', '')
                              ELSE sales.customer_address END,
      customer_neighborhood = CASE WHEN p_sale_data ? 'customer_neighborhood'
                                   THEN NULLIF(p_sale_data->>'customer_neighborhood', '')
                                   ELSE sales.customer_neighborhood END
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda % nao encontrada ou sem permissao', p_sale_id;
    END IF;

    DELETE FROM sale_items WHERE sale_id = p_sale_id;
    v_sale_id := p_sale_id;
  ELSE
    v_client_id := NULLIF(p_sale_data->>'client_id', '')::uuid;

    INSERT INTO sales (id, franchise_id, value, contact_id, source, payment_method,
      card_fee_percent, card_fee_amount, fee_passed_to_customer, delivery_method, delivery_fee,
      discount_amount, discount_type, discount_input, net_value, sale_date, observacoes,
      customer_address, customer_neighborhood, payment_confirmed, confirmed_at, desconto_origem, desconto_codigo, credito_usado)
    VALUES (
      COALESCE(v_client_id, gen_random_uuid()),
      p_sale_data->>'franchise_id',
      (p_sale_data->>'value')::numeric,
      CASE WHEN p_sale_data->>'contact_id' IS NOT NULL AND p_sale_data->>'contact_id' != ''
           THEN (p_sale_data->>'contact_id')::uuid ELSE NULL END,
      COALESCE(p_sale_data->>'source', 'manual'),
      p_sale_data->>'payment_method',
      (p_sale_data->>'card_fee_percent')::numeric,
      (p_sale_data->>'card_fee_amount')::numeric,
      NULLIF(p_sale_data->>'fee_passed_to_customer', '')::boolean,
      p_sale_data->>'delivery_method',
      COALESCE((p_sale_data->>'delivery_fee')::numeric, 0),
      COALESCE((p_sale_data->>'discount_amount')::numeric, 0),
      p_sale_data->>'discount_type',
      (p_sale_data->>'discount_input')::numeric,
      (p_sale_data->>'net_value')::numeric,
      (p_sale_data->>'sale_date')::date,
      p_sale_data->>'observacoes',
      NULLIF(p_sale_data->>'customer_address', ''),
      NULLIF(p_sale_data->>'customer_neighborhood', ''),
      -- S6.2: venda que nasce recebida grava o recebimento NA MESMA transação (só no INSERT;
      -- a nova tentativa que cai no ON CONFLICT não mexe no recebimento; editar também não).
      COALESCE(NULLIF(p_sale_data->>'payment_confirmed', '')::boolean, false),
      CASE WHEN COALESCE(NULLIF(p_sale_data->>'payment_confirmed', '')::boolean, false) THEN now() END,
      NULLIF(p_sale_data->>'desconto_origem', ''),
      NULLIF(upper(btrim(p_sale_data->>'desconto_codigo')), ''),
      -- 23/11 crédito
      round(COALESCE(NULLIF(p_sale_data->>'credito_usado', '')::numeric, 0), 2)
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_sale_id;

    IF v_sale_id IS NULL THEN
      -- Ja gravada numa tentativa anterior: devolve o id, sem duplicar venda nem itens.
      SELECT id INTO v_sale_id FROM sales WHERE id = v_client_id;
      IF v_sale_id IS NULL THEN
        RAISE EXCEPTION 'Venda % nao encontrada ou sem permissao', v_client_id;
      END IF;
      RETURN v_sale_id;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, inventory_item_id, product_name, quantity, unit_price, cost_price)
    VALUES (
      v_sale_id,
      (v_item->>'inventory_item_id')::uuid,
      v_item->>'product_name',
      COALESCE((v_item->>'quantity')::int, 1),
      (v_item->>'unit_price')::numeric,
      (v_item->>'cost_price')::numeric
    );
  END LOOP;

  RETURN v_sale_id;
END;
$function$
;

commit;
