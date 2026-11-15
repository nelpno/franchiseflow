-- 2026-09-07 — Auditoria, Onda 0 — FALHA DE SEGURANCA
--
-- Provado executando como um franqueado real (transacao revertida, 07/09/2026):
--   update profiles set role='admin' where id = <o proprio>   -> 1 linha atualizada
--   update profiles set managed_franchise_ids = managed_franchise_ids || '<unidade alheia>'
--     -> passou a LER 12 vendas de franquia de outro dono
--   update marketing_payments set status='confirmed' where franchise_id = <a propria>
--     -> dispara tr_mkt_generate_expense e AUTO-APROVA a verba de marketing dela
--
-- Por que passava: `profiles_update` e `marketing_payments_update` sao
-- `USING (is_admin() OR id = auth.uid())` com WITH CHECK **nulo**. Quando o WITH CHECK
-- e omitido, o Postgres reusa o USING — e a linha depois do update continua sendo "a
-- minha linha", entao passa. A tela nunca oferece isso, mas o `anon key` esta no bundle
-- por design: quem tiver uma sessao de franqueado faz direto no PostgREST.
--
-- Por que a correcao NAO e uma policy: WITH CHECK so enxerga a linha NOVA. "a coluna
-- role nao pode ter mudado" exige comparar OLD com NEW — isso e trigger.
-- E por que nao e `REVOKE UPDATE (role) ... FROM authenticated`: o admin tambem e
-- `authenticated`, e ele PRECISA escrever essas colunas (Franchises -> Editar Permissoes,
-- Franchises.jsx:337,412,504).
--
-- Rollback no fim do arquivo.

-- ── 1. profiles: so admin muda role e managed_franchise_ids ───────────────────
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- service_role / triggers internos / cron nao tem auth.uid(): nao sao o vetor de
  -- ataque (service_role ja ignora RLS por definicao) e precisam poder escrever.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Alteracao de papel so pode ser feita por um administrador'
      using errcode = '42501';
  end if;

  if new.managed_franchise_ids is distinct from old.managed_franchise_ids then
    raise exception 'Alteracao de unidades vinculadas so pode ser feita por um administrador'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_profile_privilege_columns on public.profiles;
create trigger trg_guard_profile_privilege_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();

-- ── 2. marketing_payments: so admin confirma/recusa e mexe no valor ───────────
-- O franqueado PODE anexar comprovante depois do pagamento ja confirmado (commit
-- 8f4c94d, 06/09/2026) — entao a trava e por COLUNA, nao por status da linha.
create or replace function public.guard_marketing_payment_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or public.is_admin_or_manager() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- a policy de INSERT so confere franchise_id; sem isto o franqueado insere
    -- direto com status 'confirmed' e a despesa e gerada pelo trigger.
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'Pagamento de marketing entra como pendente; a confirmacao e da franqueadora'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Confirmar ou recusar pagamento de marketing e exclusivo da franqueadora'
      using errcode = '42501';
  end if;

  if new.amount is distinct from old.amount
     or new.franchise_id is distinct from old.franchise_id
     or new.reference_month is distinct from old.reference_month then
    raise exception 'Valor, unidade e mes de referencia nao podem ser alterados apos o registro'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_marketing_payment_approval on public.marketing_payments;
create trigger trg_guard_marketing_payment_approval
  before insert or update on public.marketing_payments
  for each row execute function public.guard_marketing_payment_approval();

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- drop trigger if exists trg_guard_profile_privilege_columns on public.profiles;
-- drop trigger if exists trg_guard_marketing_payment_approval on public.marketing_payments;
-- drop function if exists public.guard_profile_privilege_columns();
-- drop function if exists public.guard_marketing_payment_approval();
