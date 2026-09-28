-- 28/09/2026 — S15.1 · A franqueada confere o que chegou do pedido à fábrica
--
-- Decisões do Nelson (28/09, não reabrir):
--   * quem confirma a entrega é a FRANQUEADA ("Recebi tudo certo" / "Faltou algo");
--   * em "Faltou algo" ela ajusta as quantidades RECEBIDAS por item; o total do pedido e a
--     despesa de compra (compra_produto) saem do que CHEGOU; o FRETE continua o cobrado;
--   * o estoque entra UMA vez só, com a quantidade recebida;
--   * divergência avisa o admin;
--   * sem resposta dela em 2 dias, o pedido vira entregue com as quantidades pedidas e o admin é avisado.
--
-- Como funciona (só para unidade com a chave ui_v2 LIGADA — com ela desligada nada muda):
--   1. O admin marca "entregue" como hoje (lote ou detalhe, qualquer tela, até bundle velho).
--      O trigger novo `a_s15_guard_conferencia` (BEFORE UPDATE, roda ANTES dos outros pelo
--      nome) troca o status para 'em_rota' ("chegou, esperando a unidade conferir"), guarda a
--      data informada em shipped_at, marca awaiting_since = agora e avisa a unidade. Como o
--      status gravado é 'em_rota', os triggers de estoque (purchase_order_status_change) e de
--      despesa (tr_po_generate_expenses) NÃO disparam: nada entra ainda.
--   2. A franqueada chama `confirmar_recebimento_pedido(order_id, itens, client_id)`:
--      grava purchase_order_items.received_quantity, recalcula total_amount pelo que chegou
--      (guarda o original em ordered_total_amount) e passa o pedido para 'entregue' numa
--      transação só, com o pedido travado (FOR UPDATE). Aí os triggers de SEMPRE rodam uma vez:
--      estoque soma coalesce(received_quantity, quantity) e a despesa compra_produto usa o
--      mesmo coalesce; frete = freight_cost (inalterado). delivered_at = shipped_at.
--   3. `concluir_entregas_sem_resposta(48)` (cron no arquivo 2026-09-28-s15-cron.sql, aplicado DEPOIS deste) fecha os
--      'em_rota' com mais de 48 h desde awaiting_since como recebidos completos e avisa o admin.
--
-- Unidade com a chave DESLIGADA: o trigger novo não troca nada (status 'entregue' segue
-- direto, estoque e despesa como hoje; received_quantity fica NULL e o coalesce devolve a
-- quantidade pedida = comportamento idêntico ao de antes).
--
-- Não duplica (estoque nem despesa):
--   * a passagem em_rota -> entregue só acontece dentro da RPC (o trigger novo barra qualquer
--     outro UPDATE que tente, com P0001 'S15_AGUARDA_CONFERENCIA'); a RPC trava a linha e, se
--     o pedido já está entregue+conferido, devolve o que ficou (idempotente) sem tocar em nada;
--   * estoque: on_purchase_order_delivered só roda em old.status <> 'entregue' -> 'entregue';
--   * despesa: generate_expenses_from_purchase_order segue idempotente por expenses_generated_at;
--   * clique repetido / resposta perdida: mesma client_id -> {ja_confirmado, mesmo_envio:true};
--     duas abas: a 2ª espera o lock e recebe {ja_confirmado, mesmo_envio:false}.
--   * colunas da conferência (shipped_at, awaiting_since, received_*, ordered_total_amount) só
--     mudam pela RPC: o trigger devolve o valor antigo em qualquer outro UPDATE (a franqueada
--     tem UPDATE em purchase_orders pela policy po_update).
--
-- Funções alteradas (backup ANTES de aplicar):
--   on_purchase_order_delivered            -> docs/db-backups/on_purchase_order_delivered.2026-09-28-antes.sql (no repo)
--   generate_expenses_from_purchase_order  -> docs/db-backups/generate_expenses_from_purchase_order.2026-09-28-antes.sql (no repo)
--   get_admin_pending_counts               -> docs/db-backups/get_admin_pending_counts.2026-09-28-antes.sql (GERAR antes)
--   get_financeiro_rede                    -> docs/db-backups/get_financeiro_rede.2026-09-28-antes.sql (GERAR antes)
--   O bloco 0 confere o md5 de cada uma (medido em 28/09); se mudou, o arquivo inteiro aborta.
--   * pending_counts: 'em_rota' deixa de contar como "para entregar" (agora é "a fábrica já
--     entregou, falta a unidade conferir"; antes era 0 pedidos nesse status).
--   * financeiro_rede: 'em_rota' passa a somar no "pedidos à fábrica" do mês (senão o pedido
--     sumia do Financeiro por até 2 dias).
--
-- Medido em 28/09 (90 dias, sem unidades de teste): 203 pedidos entregues em 59 unidades
-- (~16 por semana), média R$ 2.632, 17 itens por pedido; 0 pedidos em 'em_rota' hoje; total_amount
-- = soma dos itens em 100%. Chave ui_v2: desligada na rede, LIGADA só em franquiaararaquarasp
-- (teste) — aplicar este arquivo já vale para ela.
--
-- ROLLBACK (na ordem; tudo sem deploy):
--   -- 1) fechar o que estiver esperando conferência (senão fica sem estoque/despesa):
--   select public.s15_confirmar_recebimento(id, null, gen_random_uuid(), true, null)
--     from public.purchase_orders where status = 'em_rota' and awaiting_since is not null;
--   -- 2) desagendar (se agendado): select cron.unschedule('s15-entregas-sem-resposta');
--   drop trigger if exists a_s15_guard_conferencia on public.purchase_orders;
--   drop trigger if exists a_s15_guard_itens on public.purchase_order_items;
--   drop function if exists public.concluir_entregas_sem_resposta(integer);
--   drop function if exists public.confirmar_recebimento_pedido(uuid, jsonb, uuid);
--   drop function if exists public.s15_confirmar_recebimento(uuid, jsonb, uuid, boolean, uuid);
--   drop function if exists public.s15_guard_conferencia();
--   drop function if exists public.s15_guard_itens();
--   drop function if exists public.s15_privilegiado();
--   drop function if exists public.salvar_edicao_pedido(uuid, jsonb, jsonb);   -- o front volta ao caminho antigo sozinho
--   -- 3) reaplicar os 4 backups acima (node supabase/cs-cockpit/_aplica-lf.mjs <arquivo>).
--   -- 4) colunas são aditivas e podem ficar; para tirar:
--   -- alter table public.purchase_order_items drop column if exists received_quantity;
--   -- alter table public.purchase_orders drop column if exists shipped_at, drop column if exists awaiting_since,
--   --   drop column if exists received_confirmed_at, drop column if exists received_confirmed_by,
--   --   drop column if exists received_mode, drop column if exists received_client_id,
--   --   drop column if exists ordered_total_amount;
--   Desligar SEM rollback: desligar a chave ui_v2 da unidade (o trigger para de INICIAR
--   conferências na hora; as que já começaram seguem visíveis para ela e fecham pela RPC ou pelo cron).
--   Guardas da P3 (1ª passada) ficam no bloco 2: entregue terminal, colunas protegidas, franqueada
--   só cancela pendente, itens travados, received_quantity só pela RPC.
--
-- NÃO APLICADO. Aplicar (SQL antes do front): node supabase/cs-cockpit/_aplica-lf.mjs supabase/2026-09-28-s15-conferir-entrega.sql
-- Teste que se desfaz: supabase/2026-09-28-s15-conferir-entrega.teste.sql (mandar ESTE arquivo + o de
-- teste numa requisição só; termina em raise exception 'RESULT ...' e nada fica no banco).
-- Conferir depois (consulta separada):
--   select proname, prosecdef, proconfig, has_function_privilege('anon', oid, 'execute') anon_exec,
--          has_function_privilege('authenticated', oid, 'execute') auth_exec
--     from pg_proc where proname in ('confirmar_recebimento_pedido','s15_confirmar_recebimento',
--                                    'concluir_entregas_sem_resposta','s15_guard_conferencia',
--                                    's15_guard_itens','s15_privilegiado','salvar_edicao_pedido');
--   -> todas com search_path=public; prosecdef=true em todas MENOS salvar_edicao_pedido (invoker);
--      anon_exec=false em todas; auth_exec=true só em confirmar_recebimento_pedido e salvar_edicao_pedido.
--   select tgname from pg_trigger where tgrelid = 'public.purchase_orders'::regclass and not tgisinternal order by 1;
--   -> a_s15_guard_conferencia em 1º (e a_s15_guard_itens em purchase_order_items).
--
-- CRON: arquivo separado supabase/2026-09-28-s15-cron.sql. ORDEM: 1) este arquivo; 2) o do cron.
--   Sem o cron, conferência sem resposta NÃO fecha sozinha (fica em 'Esperando a unidade conferir').

-- ============================================================================================
-- 0. Paridade: as 4 funções alteradas têm de estar como em 28/09 (md5 do prosrc, sem \r).
-- ============================================================================================
do $s15$
declare
  v_md5 text;
  r record;
begin
  for r in
    select * from (values
      ('on_purchase_order_delivered',           '90a21421731f883a34ee9316db7b819f'),
      ('generate_expenses_from_purchase_order', 'aed704aa9a8724a5bbc9ca193cde6f99'),
      ('get_admin_pending_counts',              'ed20155fccf6185d73c1362d5e53a539'),
      ('get_financeiro_rede',                   '141f73849c645bb5bdb3d8588bc1de55')
    ) as t(nome, esperado)
  loop
    select md5(p.prosrc) into v_md5
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = r.nome and p.prokind = 'f';
    if v_md5 is distinct from r.esperado then
      raise exception 'S15: a função % mudou desde 28/09 (md5 % <> %). Refaça o backup e revise este arquivo.',
        r.nome, v_md5, r.esperado;
    end if;
  end loop;
end
$s15$;

-- ============================================================================================
-- 1. Colunas (só aditivas)
-- ============================================================================================
alter table public.purchase_order_items
  add column if not exists received_quantity integer;
alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_received_quantity_check;
alter table public.purchase_order_items
  add constraint purchase_order_items_received_quantity_check
  check (received_quantity is null or (received_quantity >= 0 and received_quantity <= quantity));

alter table public.purchase_orders
  add column if not exists shipped_at            timestamptz,  -- data de entrega que a fábrica informou
  add column if not exists awaiting_since        timestamptz,  -- quando passou a esperar a conferência (base das 48 h). NÃO nulo = conferência S15
  add column if not exists received_confirmed_at timestamptz,
  add column if not exists received_confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists received_mode         text,         -- ok | divergente | automatico
  add column if not exists received_client_id    uuid,         -- id do envio (idempotência)
  add column if not exists ordered_total_amount  numeric;      -- total do que foi PEDIDO (total_amount vira o que chegou)
alter table public.purchase_orders
  drop constraint if exists purchase_orders_received_mode_check;
alter table public.purchase_orders
  add constraint purchase_orders_received_mode_check
  check (received_mode is null or received_mode in ('ok', 'divergente', 'automatico'));

create index if not exists purchase_orders_received_confirmed_by_idx
  on public.purchase_orders (received_confirmed_by);
create index if not exists purchase_orders_aguardando_conferencia_idx
  on public.purchase_orders (awaiting_since) where status = 'em_rota';

-- ============================================================================================
-- 2. Guardas (P3 1ª passada, pontos 1, 2, 3 e 5)
--
--   "Privilegiado" = SQL direto/cron (sem claims + session_user do banco) ou service_role pela
--   API (n8n). Nunca current_user (é o dono da função). "Via RPC" = a conferência ligou
--   s15.confirmando dentro da própria transação.
--
--   purchase_orders, BEFORE INSERT/UPDATE (nome "a_": roda ANTES dos triggers de estoque/despesa):
--     * 'entregue' é TERMINAL: nenhuma saída, nem para admin (só privilegiado).
--     * colunas da conferência + expenses_generated_at: ninguém de fora escreve (volta o antigo;
--       no INSERT, nulas).
--     * depois de entregue: total_amount, ordered_total_amount e freight_cost travados (volta o
--       antigo; a tela velha do admin não sobrescreve o total do que chegou).
--     * franqueada (não admin/gerente): não mexe em total_amount nem freight_cost (volta o
--       antigo) e a ÚNICA mudança de status dela é pendente -> cancelado (o que o app faz hoje,
--       PurchaseOrderHistory "Cancelar pedido"); INSERT só como 'pendente' (os 2 caminhos do app).
--     * conferência S15 = em_rota COM awaiting_since: só a RPC/cron leva a 'entregue'. em_rota
--       SEM awaiting_since (legado; 0 hoje) segue livre como antes.
--     * a chave ui_v2 só decide INICIAR a conferência (desvio entregue -> em_rota).
--   purchase_order_items, BEFORE INSERT/UPDATE:
--     * received_quantity só pela RPC/cron (fora dela: nula no INSERT, a antiga no UPDATE);
--     * itens de pedido em conferência S15 ou entregue: sem INSERT/UPDATE (DELETE segue a RLS,
--       que já é só admin — e a exclusão de franquia continua apagando em cascata).
-- ============================================================================================
create or replace function public.s15_privilegiado()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  return (v_claims is null and session_user in ('postgres', 'supabase_admin'))
      or coalesce(v_claims::jsonb->>'role', '') = 'service_role';
end;
$fn$;
revoke all on function public.s15_privilegiado() from public, anon, authenticated;

create or replace function public.s15_guard_conferencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_via_rpc     boolean := coalesce(current_setting('s15.confirmando', true), '') = 'on';
  v_priv        boolean;
  v_equipe      boolean;
  v_fid         uuid;
begin
  if v_via_rpc then
    return new;  -- a RPC de conferência sabe o que está fazendo
  end if;
  v_priv := public.s15_privilegiado();

  if tg_op = 'INSERT' then
    if not v_priv then
      new.shipped_at := null; new.awaiting_since := null;
      new.received_confirmed_at := null; new.received_confirmed_by := null;
      new.received_mode := null; new.received_client_id := null;
      new.ordered_total_amount := null; new.expenses_generated_at := null;
      if new.status is distinct from 'pendente' and not coalesce(public.is_admin_or_manager(), false) then
        raise exception 'Pedido: pedido novo sai como pendente.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  -- ---------- UPDATE ----------
  if not v_priv then
    v_equipe := coalesce(public.is_admin_or_manager(), false);

    -- Colunas da conferência e o carimbo da despesa: ninguém de fora escreve.
    new.shipped_at            := old.shipped_at;
    new.awaiting_since        := old.awaiting_since;
    new.received_confirmed_at := old.received_confirmed_at;
    new.received_confirmed_by := old.received_confirmed_by;
    new.received_mode         := old.received_mode;
    new.received_client_id    := old.received_client_id;
    new.ordered_total_amount  := old.ordered_total_amount;
    new.expenses_generated_at := old.expenses_generated_at;

    -- Entregue é terminal (estoque e despesa já entraram; sair daqui abriria a porta de entrar de novo).
    if old.status = 'entregue' then
      if new.status is distinct from 'entregue' then
        raise exception 'Pedido: pedido entregue não muda mais de situação.'
          using errcode = 'P0001', detail = 'S15_ENTREGUE_TERMINAL';
      end if;
      -- Admin/gerente: mudar valor ou frete de pedido entregue é ERRO (P3 2ª passada, ponto 3):
      -- descartar calado fazia a tela mostrar "salvo". A franqueada (o app dela nunca manda
      -- esses campos) continua com o valor antigo devolvido em silêncio.
      if v_equipe and (new.total_amount is distinct from old.total_amount
                       or new.freight_cost is distinct from old.freight_cost) then
        raise exception 'Pedido: o pedido já foi entregue; recarregue a página.'
          using errcode = 'P0001', detail = 'S15_ENTREGUE_FINANCEIRO';
      end if;
      new.total_amount := old.total_amount;
      new.freight_cost := old.freight_cost;
      new.delivered_at := old.delivered_at;
    end if;

    -- Franqueada: valor e frete são da fábrica; status só pendente -> cancelado.
    if not v_equipe then
      new.total_amount := old.total_amount;
      new.freight_cost := old.freight_cost;
      if new.status is distinct from old.status
         and not (old.status = 'pendente' and new.status = 'cancelado') then
        raise exception 'Pedido: só é possível cancelar um pedido que ainda está pendente.'
          using errcode = 'P0001', detail = 'S15_STATUS_FRANQUEADA';
      end if;
    end if;
  end if;

  -- Conferência S15 em curso: só a RPC/cron leva a 'entregue' (estoque e despesa entram UMA vez).
  if old.status = 'em_rota' and old.awaiting_since is not null and new.status = 'entregue' then
    raise exception 'Pedido: este pedido espera a unidade conferir o que chegou. Use "Confirmar recebimento".'
      using errcode = 'P0001', detail = 'S15_AGUARDA_CONFERENCIA';
  end if;

  -- Fábrica marcou entregue numa unidade com o app novo: começa a conferência (a chave só decide INICIAR).
  if new.status = 'entregue' and old.status in ('pendente', 'confirmado')
     and public.feature_flag_enabled('ui_v2', new.franchise_id) then
    new.status := 'em_rota';
    new.shipped_at := case
      when new.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then new.delivered_at
      else now() end;
    new.awaiting_since := now();
    new.delivered_at := old.delivered_at;
    select f.id into v_fid from franchises f where f.evolution_instance_id = new.franchise_id;
    if v_fid is not null then
      perform public.notify_franchise_users(
        v_fid,
        'Seu pedido chegou',
        'Confira o que chegou e toque em "Recebi tudo certo" ou "Faltou algo". Sem resposta em 2 dias, o pedido conta como recebido completo.',
        'info', 'local_shipping', '/Gestao?tab=reposicao');
    end if;
  end if;

  -- Saiu da conferência sem concluir (admin voltou ou cancelou): zera a espera.
  if old.status = 'em_rota' and old.awaiting_since is not null
     and new.status in ('pendente', 'confirmado', 'cancelado') then
    new.shipped_at := null;
    new.awaiting_since := null;
  end if;

  return new;
end;
$fn$;

revoke all on function public.s15_guard_conferencia() from public, anon, authenticated;

drop trigger if exists a_s15_guard_conferencia on public.purchase_orders;
create trigger a_s15_guard_conferencia
  before insert or update on public.purchase_orders
  for each row execute function public.s15_guard_conferencia();

create or replace function public.s15_guard_itens()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status   text;
  v_aguarda  timestamptz;
begin
  if coalesce(current_setting('s15.confirmando', true), '') = 'on' or public.s15_privilegiado() then
    return new;
  end if;

  -- Trava o CABEÇALHO antes de autorizar (P3 2ª passada, ponto 2): se outra transação está
  -- entregando/conferindo este pedido, espera ela terminar e relê o status já gravado. Ordem de
  -- lock em todo o fluxo: cabeçalho (purchase_orders) antes dos itens.
  select po.status, po.awaiting_since into v_status, v_aguarda
    from purchase_orders po where po.id = new.order_id
    for share;
  if v_status = 'entregue' or (v_status = 'em_rota' and v_aguarda is not null) then
    raise exception 'Pedido: os itens de um pedido entregue ou em conferência não mudam.'
      using errcode = 'P0001', detail = 'S15_ITENS_TRAVADOS';
  end if;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    raise exception 'Pedido: item não troca de pedido.' using errcode = 'P0001';
  end if;

  -- O que chegou só a conferência grava.
  if tg_op = 'INSERT' then
    new.received_quantity := null;
  else
    new.received_quantity := old.received_quantity;
  end if;
  return new;
end;
$fn$;

revoke all on function public.s15_guard_itens() from public, anon, authenticated;

drop trigger if exists a_s15_guard_itens on public.purchase_order_items;
create trigger a_s15_guard_itens
  before insert or update on public.purchase_order_items
  for each row execute function public.s15_guard_itens();

-- ============================================================================================
-- 3. Estoque e despesa pelo que CHEGOU (coalesce: sem conferência = quantidade pedida, igual antes)
-- ============================================================================================
create or replace function public.on_purchase_order_delivered()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'entregue' and old.status != 'entregue' then
    -- S15: soma o que CHEGOU (received_quantity); sem conferência, a quantidade pedida.
    update inventory_items ii
    set quantity = ii.quantity + coalesce(poi.received_quantity, poi.quantity)
    from purchase_order_items poi
    where poi.order_id = new.id
      and poi.inventory_item_id = ii.id;

    -- Front já grava delivered_at no mesmo UPDATE (data escolhida na tela). Só usar "agora"
    -- quando NADA foi passado (coluna ausente do SET, ou igual ao valor já salvo).
    if new.delivered_at is not distinct from old.delivered_at then
      new.delivered_at = now();
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.generate_expenses_from_purchase_order()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_total_cost NUMERIC := 0;
  v_freight NUMERIC := 0;
  v_po_short TEXT;
  v_delivered_date DATE;
BEGIN
  -- Só dispara quando muda PARA 'entregue' E ainda não gerou (idempotente)
  IF NEW.status = 'entregue'
     AND (OLD.status IS NULL OR OLD.status <> 'entregue')
     AND NEW.expenses_generated_at IS NULL THEN

    -- S15: compra = o que CHEGOU (received_quantity); sem conferência, a quantidade pedida.
    SELECT COALESCE(SUM(unit_price * COALESCE(received_quantity, quantity)), 0)
      INTO v_total_cost
      FROM public.purchase_order_items
     WHERE order_id = NEW.id;

    v_freight := COALESCE(NEW.freight_cost, 0);
    v_po_short := substring(NEW.id::text from 1 for 8);
    v_delivered_date := COALESCE(NEW.delivered_at::date, CURRENT_DATE);

    -- Expense compra_produto
    IF v_total_cost > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id, 'compra_produto', 'Maxi Massas',
        'Pedido #' || v_po_short || ' - Maxi Massas',
        v_total_cost, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    -- Expense transporte (frete)
    IF v_freight > 0 THEN
      INSERT INTO public.expenses (
        franchise_id, category, supplier, description,
        amount, expense_date, source, source_id, created_by
      ) VALUES (
        NEW.franchise_id, 'transporte', 'Maxi Massas',
        'Frete pedido #' || v_po_short,
        v_freight, v_delivered_date,
        'purchase_order', NEW.id, NEW.confirmed_by
      );
    END IF;

    -- Marca como gerado (BEFORE UPDATE, pode setar NEW direto)
    NEW.expenses_generated_at := NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================================
-- 4. Núcleo da conferência (interno: nem franqueada nem anon executam direto)
-- ============================================================================================
create or replace function public.s15_confirmar_recebimento(
  p_order_id   uuid,
  p_itens      jsonb,     -- null/[] = tudo certo; [{item_id, received_quantity}] = o que mudou
  p_client_id  uuid,      -- id do envio gerado no aparelho (idempotência)
  p_automatico boolean,   -- true = sem resposta em 48 h (ignora p_itens)
  p_user       uuid       -- quem confirmou (null no automático)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_po             purchase_orders%rowtype;
  v_item           jsonb;
  v_id             uuid;
  v_qtd            integer;
  v_ids            uuid[]    := '{}';
  v_qtds           integer[] := '{}';
  v_invalidos      integer;
  v_mesmo          boolean;
  v_total_pedido   numeric;
  v_total_recebido numeric;
  v_dif            integer;
  v_modo           text;
  v_nome           text;
  v_fid            uuid;
begin
  if p_order_id is null or p_client_id is null then
    raise exception 'Pedido: confirmação sem identificador. Atualize a página e tente de novo.'
      using errcode = 'P0001';
  end if;
  if p_itens is not null and jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Pedido: quantidades recebidas em formato inválido.' using errcode = 'P0001';
  end if;

  -- Formato dos itens (antes do lock: não depende do banco).
  if not coalesce(p_automatico, false) then
    for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
    loop
      begin
        v_id  := (v_item->>'item_id')::uuid;
        v_qtd := (v_item->>'received_quantity')::integer;
      exception when others then
        raise exception 'Pedido: quantidade recebida inválida.' using errcode = 'P0001';
      end;
      if v_id is null or v_qtd is null or v_qtd < 0 then
        raise exception 'Pedido: quantidade recebida inválida.' using errcode = 'P0001';
      end if;
      if v_id = any(v_ids) then
        raise exception 'Pedido: o mesmo produto veio duas vezes.' using errcode = 'P0001';
      end if;
      v_ids  := v_ids  || v_id;
      v_qtds := v_qtds || v_qtd;
    end loop;
  end if;

  -- Trava o pedido: duas abas / clique repetido / cron ao mesmo tempo fazem fila aqui.
  select * into v_po from purchase_orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido: não encontrado. Atualize a página.' using errcode = 'P0001';
  end if;

  -- Já conferido: devolve o que ficou, sem tocar em nada.
  if v_po.status = 'entregue' and v_po.received_confirmed_at is not null then
    select not exists (
             select 1 from unnest(v_ids, v_qtds) as p(id, q)
               join purchase_order_items i on i.id = p.id and i.order_id = p_order_id
              where i.received_quantity is distinct from p.q)
       and not exists (
             select 1 from purchase_order_items i
              where i.order_id = p_order_id and not (i.id = any(v_ids))
                and i.received_quantity is distinct from i.quantity)
      into v_mesmo;
    return jsonb_build_object(
      'id', v_po.id, 'ja_confirmado', true,
      'mesmo_envio', (v_po.received_client_id is not distinct from p_client_id) and v_mesmo,
      'modo', v_po.received_mode,
      'total_amount', v_po.total_amount,
      'total_pedido', v_po.ordered_total_amount);
  end if;

  if v_po.status <> 'em_rota' or v_po.awaiting_since is null then
    raise exception '%', case v_po.status
        when 'entregue'  then 'Pedido: a fábrica já deu este pedido como entregue. Se faltou algo, fale com a fábrica.'
        when 'cancelado' then 'Pedido: este pedido foi cancelado.'
        else 'Pedido: este pedido ainda não saiu da fábrica.' end
      using errcode = 'P0001', detail = 'S15_NAO_AGUARDA';
  end if;

  -- Cada item informado tem de ser DESTE pedido e ficar entre 0 e o que foi pedido.
  select count(*) into v_invalidos
    from unnest(v_ids, v_qtds) as p(id, q)
    left join purchase_order_items i on i.id = p.id and i.order_id = p_order_id
   where i.id is null or p.q > i.quantity;
  if v_invalidos > 0 then
    raise exception 'Pedido: confira as quantidades. Cada produto vai de 0 até o que foi pedido.'
      using errcode = 'P0001';
  end if;

  -- Daqui até o fim da troca de status, as guardas deixam a conferência escrever.
  perform set_config('s15.confirmando', 'on', true);
  update purchase_order_items i
     set received_quantity = coalesce(
           (select p.q from unnest(v_ids, v_qtds) as p(id, q) where p.id = i.id),
           i.quantity)
   where i.order_id = p_order_id;

  select coalesce(sum(i.quantity * i.unit_price), 0),
         coalesce(sum(i.received_quantity * i.unit_price), 0),
         count(*) filter (where i.received_quantity <> i.quantity)
    into v_total_pedido, v_total_recebido, v_dif
    from purchase_order_items i
   where i.order_id = p_order_id;

  v_modo := case when coalesce(p_automatico, false) then 'automatico'
                 when v_dif > 0 then 'divergente'
                 else 'ok' end;

  -- em_rota -> entregue: dispara, UMA vez, estoque (+recebido) e despesa (compra = recebido,
  -- frete = o cobrado). delivered_at = a data que a fábrica informou.
  update purchase_orders
     set status                = 'entregue',
         delivered_at          = coalesce(v_po.shipped_at, now()),
         ordered_total_amount  = round(v_total_pedido, 2),
         total_amount          = round(v_total_recebido, 2),
         received_confirmed_at = now(),
         received_confirmed_by = p_user,
         received_mode         = v_modo,
         received_client_id    = p_client_id
   where id = p_order_id;
  perform set_config('s15.confirmando', 'off', true);

  if v_modo in ('divergente', 'automatico') then
    select f.name, f.id into v_nome, v_fid from franchises f where f.evolution_instance_id = v_po.franchise_id;
    if v_modo = 'divergente' then
      perform public.notify_admins(
        'Entrega com diferença',
        coalesce(v_nome, v_po.franchise_id) || ': chegou R$ '
          || replace(to_char(round(v_total_recebido, 2), 'FM999999990.00'), '.', ',')
          || ' de R$ ' || replace(to_char(round(v_total_pedido, 2), 'FM999999990.00'), '.', ',')
          || ' (' || v_dif || case when v_dif = 1 then ' produto' else ' produtos' end
          || ' com diferença). O total do pedido e a despesa já saíram pelo que chegou.',
        'warning', 'warning', '/PurchaseOrders?secao=entregues');
    else
      perform public.notify_admins(
        'Entrega sem conferência',
        coalesce(v_nome, v_po.franchise_id)
          || ': a unidade não conferiu em 2 dias. O pedido contou como recebido completo.',
        'info', 'local_shipping', '/PurchaseOrders?secao=entregues');
      if v_fid is not null then
        perform public.notify_franchise_users(
          v_fid,
          'Pedido dado como recebido',
          'Sem conferência em 2 dias, o pedido contou como recebido completo e o estoque foi atualizado. Se faltou algo, fale com a fábrica.',
          'info', 'inventory', '/Gestao?tab=reposicao');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'id', p_order_id, 'ja_confirmado', false, 'mesmo_envio', true,
    'modo', v_modo,
    'total_amount', round(v_total_recebido, 2),
    'total_pedido', round(v_total_pedido, 2),
    'itens_com_diferenca', v_dif);
end;
$fn$;

revoke all on function public.s15_confirmar_recebimento(uuid, jsonb, uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.s15_confirmar_recebimento(uuid, jsonb, uuid, boolean, uuid) to service_role;

-- ============================================================================================
-- 4b. Edição do pedido pelo admin numa transação (P3 2ª passada, ponto 1)
--   Antes: cabeçalho e itens em chamadas separadas; se outro admin entregasse no meio, ficava
--   total ≠ itens/despesa. Agora: trava o pedido, recusa se não está pendente/confirmado
--   (P0001 detail S15_PEDIDO_MUDOU -> a tela diz "O pedido mudou, recarregue"), grava os itens e
--   recalcula total_amount = soma dos itens NO SERVIDOR. p_patch aceita só freight_cost e
--   estimated_delivery (chave ausente = não mexe; null = limpa).
--   SECURITY INVOKER: a RLS do admin/gerente já deixa (po_update, poi_update).
--   O front cai no caminho antigo só se esta função não existir (PGRST202/42883 citando o nome).
-- ============================================================================================
create or replace function public.salvar_edicao_pedido(
  p_order_id uuid,
  p_itens    jsonb default '[]'::jsonb,   -- [{id, quantity}] só os itens que mudaram
  p_patch    jsonb default '{}'::jsonb    -- {freight_cost?, estimated_delivery?}
)
returns jsonb
language plpgsql
set search_path = public
as $fn$
declare
  v_po    purchase_orders%rowtype;
  v_item  jsonb;
  v_id    uuid;
  v_qtd   integer;
  v_ids   uuid[]    := '{}';
  v_qtds  integer[] := '{}';
  v_bad   integer;
  v_frete numeric;
  v_prev  date;
  v_out   jsonb;
begin
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_itens is null then p_itens := '[]'::jsonb; end if;
  if p_patch is null then p_patch := '{}'::jsonb; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Pedido: edição em formato inválido.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('freight_cost', 'estimated_delivery')) then
    raise exception 'Pedido: campo que não se edita por aqui.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    begin
      v_id  := (v_item->>'id')::uuid;
      v_qtd := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Pedido: quantidade inválida.' using errcode = 'P0001';
    end;
    if v_id is null or v_qtd is null or v_qtd < 0 or v_qtd > 10000 or v_id = any(v_ids) then
      raise exception 'Pedido: quantidade inválida.' using errcode = 'P0001';
    end if;
    v_ids := v_ids || v_id;
    v_qtds := v_qtds || v_qtd;
  end loop;

  begin
    v_frete := case when p_patch ? 'freight_cost' then (p_patch->>'freight_cost')::numeric end;
    v_prev  := case when p_patch ? 'estimated_delivery' then nullif(p_patch->>'estimated_delivery', '')::date end;
  exception when others then
    raise exception 'Pedido: frete ou previsão inválidos.' using errcode = 'P0001';
  end;
  if v_frete is not null and v_frete < 0 then
    raise exception 'Pedido: frete inválido.' using errcode = 'P0001';
  end if;

  -- Cabeçalho primeiro (mesma ordem de lock da conferência e da guarda dos itens).
  select * into v_po from purchase_orders where id = p_order_id for update;
  if not found or v_po.status not in ('pendente', 'confirmado') then
    raise exception 'Pedido: o pedido mudou (foi entregue ou cancelado). Recarregue a página.'
      using errcode = 'P0001', detail = 'S15_PEDIDO_MUDOU';
  end if;

  select count(*) into v_bad
    from unnest(v_ids) as p(id)
    left join purchase_order_items i on i.id = p.id and i.order_id = p_order_id
   where i.id is null;
  if v_bad > 0 then
    raise exception 'Pedido: um dos itens não é deste pedido. Recarregue a página.' using errcode = 'P0001';
  end if;

  update purchase_order_items i
     set quantity = p.q
    from unnest(v_ids, v_qtds) as p(id, q)
   where i.id = p.id and i.order_id = p_order_id;

  update purchase_orders po
     set total_amount = (select round(coalesce(sum(i.quantity * i.unit_price), 0), 2)
                           from purchase_order_items i where i.order_id = p_order_id),
         freight_cost = case when p_patch ? 'freight_cost' then v_frete else po.freight_cost end,
         estimated_delivery = case when p_patch ? 'estimated_delivery' then v_prev else po.estimated_delivery end
   where po.id = p_order_id
   returning to_jsonb(po.*) into v_out;
  return v_out;
end;
$fn$;

revoke all on function public.salvar_edicao_pedido(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_edicao_pedido(uuid, jsonb, jsonb) to authenticated, service_role;

-- ============================================================================================
-- 5. RPC da franqueada (e do admin, que pode confirmar por ela)
-- ============================================================================================
create or replace function public.confirmar_recebimento_pedido(
  p_order_id  uuid,
  p_itens     jsonb default null,
  p_client_id uuid  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_fid text;
begin
  if v_uid is null then
    raise exception 'Pedido: sua sessão expirou. Entre de novo.' using errcode = '42501';
  end if;
  select po.franchise_id into v_fid from purchase_orders po where po.id = p_order_id;
  -- coalesce: sem perfil, o "or" vira NULL e o "not" deixaria passar (regra 17/09).
  if v_fid is null
     or not coalesce(public.is_admin_or_manager() or v_fid = any(public.managed_franchise_ids()), false) then
    raise exception 'Pedido: não encontrado. Atualize a página.' using errcode = '42501';
  end if;
  return public.s15_confirmar_recebimento(p_order_id, p_itens, p_client_id, false, v_uid);
end;
$fn$;

revoke all on function public.confirmar_recebimento_pedido(uuid, jsonb, uuid) from public, anon;
grant execute on function public.confirmar_recebimento_pedido(uuid, jsonb, uuid) to authenticated, service_role;

-- ============================================================================================
-- 6. Sem resposta em 48 h: vira entregue com as quantidades pedidas e avisa o admin (cron)
-- ============================================================================================
create or replace function public.concluir_entregas_sem_resposta(p_horas integer default 48)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_n      integer := 0;
  r        record;
begin
  -- Nunca current_user (é o dono). SQL direto/cron = sem claims + session_user do banco;
  -- pela API, só service_role (authenticated nem tem EXECUTE).
  if not (
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
    or coalesce(v_claims::jsonb->>'role', '') = 'service_role'
  ) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_horas is null or p_horas < 24 then
    raise exception 'S15: o prazo mínimo é de 24 horas.' using errcode = 'P0001';
  end if;

  for r in
    select po.id
      from purchase_orders po
     where po.status = 'em_rota'
       and po.awaiting_since is not null   -- só conferência S15 (em_rota legado fica de fora)
       and po.awaiting_since <= now() - make_interval(hours => p_horas)
     order by po.awaiting_since
     for update skip locked   -- a franqueada conferindo agora: pula, ela ganha
  loop
    perform public.s15_confirmar_recebimento(r.id, null, gen_random_uuid(), true, null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;

revoke all on function public.concluir_entregas_sem_resposta(integer) from public, anon, authenticated;
grant execute on function public.concluir_entregas_sem_resposta(integer) to service_role;

-- ============================================================================================
-- 7. Painéis do admin que olham o status (troca cirúrgica sobre o corpo vivo, conferido no bloco 0)
-- ============================================================================================
do $s15$
declare
  v_def  text;
  v_novo text;
  v_de   text;
  v_para text;
begin
  -- get_admin_pending_counts: conferência S15 (em_rota COM awaiting_since) é "a unidade confere",
  -- não "para entregar"; em_rota legado (sem awaiting_since) continua contando como antes.
  v_de   := $q$where po.status in ('confirmado', 'em_rota') and$q$;
  v_para := $q$where (po.status = 'confirmado' or (po.status = 'em_rota' and po.awaiting_since is null)) and$q$;
  select pg_get_functiondef('public.get_admin_pending_counts()'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'S15: trecho de get_admin_pending_counts não encontrado exatamente 1 vez.';
  end if;
  v_novo := replace(v_def, v_de, v_para);
  execute v_novo;

  -- get_financeiro_rede: só a conferência S15 entra a mais (em_rota legado fica como antes).
  v_de   := $q$on po.status in ('entregue', 'confirmado')$q$;
  v_para := $q$on (po.status in ('entregue', 'confirmado') or (po.status = 'em_rota' and po.awaiting_since is not null))$q$;
  select pg_get_functiondef('public.get_financeiro_rede(text)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'S15: trecho de get_financeiro_rede não encontrado exatamente 1 vez.';
  end if;
  v_novo := replace(v_def, v_de, v_para);
  execute v_novo;
end
$s15$;
