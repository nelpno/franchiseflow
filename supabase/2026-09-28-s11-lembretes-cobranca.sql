-- 2026-09-28 — S11.2 · Lembretes de cobrança pelo WhatsApp do Nelson (admin_nelson)
--
-- Quem manda: workflow n8n "Dashboard - Lembretes de cobrança (admin_nelson)", seg a sáb às 10h.
-- Aqui fica SÓ a regra (quem recebe o quê hoje) e o registro do que saiu; o n8n confere o
-- pagamento no ASAAS (edge check-payment) e chama get_lembretes_cobranca DE NOVO para a unidade
-- antes de enviar (confere na hora do envio).
--
-- Calendário (todas as mensalidades vencem dia 5):
--   verba do anúncio    dia 1 do mês (até o dia 3, se o dia 1 cair no domingo) — sem pagamento do mês
--   mensalidade antes   1 a 2 dias antes do vencimento, fatura PENDING
--   mensalidade atraso  1 a 3 dias depois do vencimento, fatura ainda em aberto
-- "Não infernizar": no máximo 1 mensagem por unidade por dia (os itens do dia vão juntos num
-- texto só); cada item sai uma vez só (por fatura / por mês); nada no domingo nem fora de 8h–19h;
-- pausa por unidade = chave lembrete_cobranca desligada para ela.
--
-- Chave (feature_flags): lembrete_cobranca. Sem linha = DESLIGADO = ninguém recebe.
--   ligar a rede:          select public.set_feature_flag('lembrete_cobranca', null, true, 'liga lembretes');
--   pausar uma unidade:    select public.set_feature_flag('lembrete_cobranca', '<evo>', false, 'pausa: <motivo>');
--   desligar tudo:         select public.set_feature_flag('lembrete_cobranca', null, false, 'emergência');
--
-- Só aditivo (tabela + 3 funções). ROLLBACK:
--   drop function if exists public.get_lembretes_cobranca(date, text, boolean);
--   drop function if exists public.registrar_lembrete_cobranca(text, jsonb, text, text);
--   drop function if exists public.concluir_lembrete_cobranca(uuid, boolean, text);
--   drop table if exists public.cobranca_lembretes;

create table if not exists public.cobranca_lembretes (
  id           uuid primary key default gen_random_uuid(),
  franchise_id text not null,
  dia          date not null,                                  -- dia do envio em Brasília
  itens        jsonb not null,                                 -- [{tipo, ref, ...}]
  texto        text not null,
  destino      text not null check (destino in ('unidade', 'teste')),
  status       text not null default 'enviando' check (status in ('enviando', 'enviado', 'falhou')),
  erro         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 1 mensagem por unidade por dia (só as de verdade; teste para o Nelson não conta)
create unique index if not exists cobranca_lembretes_um_por_dia
  on public.cobranca_lembretes (franchise_id, dia) where destino = 'unidade' and status <> 'falhou';
create index if not exists cobranca_lembretes_franchise_idx on public.cobranca_lembretes (franchise_id, dia desc);

alter table public.cobranca_lembretes enable row level security;
drop policy if exists cobranca_lembretes_admin_select on public.cobranca_lembretes;
create policy cobranca_lembretes_admin_select on public.cobranca_lembretes
  for select to authenticated using ((select public.is_admin_or_manager()));
drop policy if exists cobranca_lembretes_admin_delete on public.cobranca_lembretes;
create policy cobranca_lembretes_admin_delete on public.cobranca_lembretes
  for delete to authenticated using ((select public.is_admin()));
-- escrita só pelas funções (SECURITY DEFINER, chamadas pelo n8n com a chave service)
revoke all on table public.cobranca_lembretes from anon;
grant select, insert, update, delete on table public.cobranca_lembretes to authenticated, service_role;

-- Guard comum: SQL direto (MCP/cron) ou service_role pela API. Nunca franqueada nem anon.
-- (current_user dentro de SECURITY DEFINER é o DONO — não serve de guard.)

create or replace function public.get_lembretes_cobranca(
  p_hoje date default null,          -- simular um dia (teste); null = hoje em Brasília, com trava de horário
  p_franchise_id text default null,  -- só esta unidade (reconferência na hora do envio, ou teste)
  p_teste boolean default false      -- teste: ignora a chave, o is_test e o "já mandei hoje"
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_agora  timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje   date := coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date);
  v_mes    text := to_char(coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date), 'YYYY-MM');
  v_mes_nome text;
  v_out    jsonb := '[]'::jsonb;
  r        record;
  v_itens  jsonb;
  v_nome   text;
  v_loc    text;
  v_texto  text;
  v_antes  jsonb;
  v_atraso jsonb;
  v_verba  jsonb;
  v_pix    constant text := 'Pix CNPJ 00.494.317/0001-21';
  v_so_vencida constant boolean := true;  -- decisão 28/09: só "1 a 3 dias depois do vencimento"
begin
  if not coalesce(
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
       or (v_claims is not null and v_claims::jsonb ->> 'role' = 'service_role'),
       false) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Nada no domingo; fora de 8h–19h só com dia simulado (teste)
  if extract(isodow from v_hoje) = 7 then
    return v_out;
  end if;
  if p_hoje is null and not (extract(hour from v_agora) between 8 and 18) then
    return v_out;
  end if;

  v_mes_nome := (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                       'setembro','outubro','novembro','dezembro'])[extract(month from v_hoje)::int];

  for r in
    select f.evolution_instance_id as evo,
           f.owner_name,
           f.name as unidade,
           regexp_replace(coalesce(fc.personal_phone_for_summary, ''), '\D', '', 'g') as telefone,
           s.asaas_subscription_id, s.subscription_status,
           s.current_payment_id, s.current_payment_status, s.current_payment_due_date, s.current_payment_value
      from franchises f
      join franchise_configurations fc on fc.franchise_evolution_instance_id = f.evolution_instance_id
      left join system_subscriptions s on s.franchise_id = f.evolution_instance_id
     where f.status = 'active'
       and length(regexp_replace(coalesce(fc.personal_phone_for_summary, ''), '\D', '', 'g')) between 10 and 13  -- sem telefone não há para quem mandar
       and (p_franchise_id is null or f.evolution_instance_id = p_franchise_id)
       and (p_teste or not coalesce(f.is_test, false))
       and (p_teste or public.feature_flag_enabled('lembrete_cobranca', f.evolution_instance_id))
       and (p_teste or not exists (
             select 1 from cobranca_lembretes l
              where l.franchise_id = f.evolution_instance_id and l.dia = v_hoje
                and l.destino = 'unidade' and l.status <> 'falhou'))
  loop
    v_antes := null; v_atraso := null; v_verba := null;

    -- Mensalidade: só assinatura ativa no ASAAS (sem ela não há o que pagar — S5.2)
    if r.asaas_subscription_id is not null and coalesce(r.subscription_status, '') <> 'CANCELLED'
       and r.current_payment_id is not null and r.current_payment_due_date is not null then
      -- Decisão Nelson 28/09: por enquanto SÓ o lembrete de vencida (o "2 dias antes" e a verba
      -- ficam desligados aqui; para voltar, trocar v_so_vencida para false).
      if not v_so_vencida and r.current_payment_status = 'PENDING'
         and r.current_payment_due_date - v_hoje between 1 and 2 then
        v_antes := jsonb_build_object('tipo', 'mensalidade_antes', 'ref', r.current_payment_id,
                                      'vencimento', r.current_payment_due_date, 'valor', r.current_payment_value);
      elsif r.current_payment_status in ('PENDING', 'OVERDUE')
         and v_hoje - r.current_payment_due_date between 1 and 3 then
        v_atraso := jsonb_build_object('tipo', 'mensalidade_atraso', 'ref', r.current_payment_id,
                                       'vencimento', r.current_payment_due_date, 'valor', r.current_payment_value);
      end if;
    end if;

    -- Verba do anúncio: dia 1 a 3, sem pagamento do mês (qualquer status menos recusado), e só
    -- para quem pagou verba em algum dos 3 meses anteriores (quem não anuncia não é cobrado).
    if not v_so_vencida and extract(day from v_hoje) between 1 and 3
       and not exists (select 1 from marketing_payments m
                        where m.franchise_id = r.evo and m.reference_month = v_mes and m.status <> 'rejected')
       and exists (select 1 from marketing_payments m
                    where m.franchise_id = r.evo and m.status = 'confirmed'
                      and m.reference_month >= to_char(v_hoje - interval '3 months', 'YYYY-MM')
                      and m.reference_month < v_mes) then
      v_verba := jsonb_build_object('tipo', 'verba', 'ref', v_mes);
    end if;

    -- Cada item sai uma vez só (envio de verdade que não falhou)
    if not p_teste then
      if v_antes is not null and exists (
           select 1 from cobranca_lembretes l, jsonb_array_elements(l.itens) i
            where l.franchise_id = r.evo and l.destino = 'unidade' and l.status <> 'falhou'
              and i ->> 'tipo' = 'mensalidade_antes' and i ->> 'ref' = v_antes ->> 'ref') then
        v_antes := null;
      end if;
      if v_atraso is not null and exists (
           select 1 from cobranca_lembretes l, jsonb_array_elements(l.itens) i
            where l.franchise_id = r.evo and l.destino = 'unidade' and l.status <> 'falhou'
              and i ->> 'tipo' = 'mensalidade_atraso' and i ->> 'ref' = v_atraso ->> 'ref') then
        v_atraso := null;
      end if;
      if v_verba is not null and exists (
           select 1 from cobranca_lembretes l, jsonb_array_elements(l.itens) i
            where l.franchise_id = r.evo and l.destino = 'unidade' and l.status <> 'falhou'
              and i ->> 'tipo' = 'verba' and i ->> 'ref' = v_mes) then
        v_verba := null;
      end if;
    end if;

    continue when v_antes is null and v_atraso is null and v_verba is null;

    v_nome := coalesce(nullif(split_part(trim(coalesce(r.owner_name, '')), ' ', 1), ''), r.unidade);
    v_nome := initcap(lower(v_nome));
    v_loc := case when public.feature_flag_enabled('ui_v2', r.evo) then 'em Mais › Pagamentos' else 'na tela Início' end;

    -- Textos aprovados pelo Nelson na Mesa (28/09); juntos quando caem no mesmo dia.
    if v_antes is not null and v_verba is not null then
      v_texto := format(E'Oi, %s! Começou %s. Dois lembretes:\n\n'
        || E'A mensalidade da Equipe Digital Maxi vence dia %s. O Pix e o boleto estão no app, %s.\n\n'
        || E'A verba do anúncio do mês (mínimo R$ 200) vai no %s. Depois é só anexar o comprovante no app, em Marketing.\n\nObrigado!',
        v_nome, v_mes_nome, to_char((v_antes ->> 'vencimento')::date, 'DD/MM'), v_loc, v_pix);
    elsif v_atraso is not null and v_verba is not null then
      v_texto := format(E'Oi, %s, tudo bem? Ainda não encontrei o pagamento da mensalidade da Equipe Digital Maxi, que venceu dia %s. Se já pagou, pode desconsiderar.\n\n'
        || E'E começou %s: a verba do anúncio do mês (mínimo R$ 200) vai no %s, com o comprovante anexado no app, em Marketing.\n\nQualquer coisa, é só me chamar aqui.',
        v_nome, to_char((v_atraso ->> 'vencimento')::date, 'DD/MM'), v_mes_nome, v_pix);
    elsif v_antes is not null then
      v_texto := format('Oi, %s! A mensalidade da Equipe Digital Maxi vence dia %s. O Pix e o boleto estão no app, %s. Obrigado!',
        v_nome, to_char((v_antes ->> 'vencimento')::date, 'DD/MM'), v_loc);
    elsif v_verba is not null then
      v_texto := format('Oi, %s! Começou %s. Para o anúncio seguir no ar, a verba do mês (mínimo R$ 200) vai no %s. Depois é só anexar o comprovante no app, em Marketing.',
        v_nome, v_mes_nome, v_pix);
    else
      v_texto := format('Oi, %s, tudo bem? Ainda não encontrei o pagamento da mensalidade da Equipe Digital Maxi, que venceu dia %s. Se já pagou, pode desconsiderar. Qualquer coisa, é só me chamar aqui.',
        v_nome, to_char((v_atraso ->> 'vencimento')::date, 'DD/MM'));
    end if;

    v_itens := (select coalesce(jsonb_agg(x) filter (where x is not null), '[]'::jsonb)
                  from unnest(array[v_antes, v_atraso, v_verba]) x);

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'franchise_id', r.evo,
      'telefone', r.telefone,
      'itens', v_itens,
      'texto', v_texto,
      'tem_mensalidade', (v_antes is not null or v_atraso is not null)));
  end loop;

  return v_out;
end;
$$;

-- Reserva o envio ANTES de mandar (o índice único barra a 2ª mensagem do dia). Devolve o id
-- do registro, ou null se a unidade já recebeu hoje.
create or replace function public.registrar_lembrete_cobranca(
  p_franchise_id text, p_itens jsonb, p_texto text, p_destino text)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_id uuid;
begin
  if not coalesce(
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
       or (v_claims is not null and v_claims::jsonb ->> 'role' = 'service_role'),
       false) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  insert into cobranca_lembretes (franchise_id, dia, itens, texto, destino)
  values (p_franchise_id, (now() at time zone 'America/Sao_Paulo')::date, p_itens, p_texto, p_destino)
  on conflict (franchise_id, dia) where destino = 'unidade' and status <> 'falhou' do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.concluir_lembrete_cobranca(p_id uuid, p_ok boolean, p_erro text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  if not coalesce(
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
       or (v_claims is not null and v_claims::jsonb ->> 'role' = 'service_role'),
       false) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update cobranca_lembretes
     set status = case when p_ok then 'enviado' else 'falhou' end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'falha no envio'), 300) end,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.get_lembretes_cobranca(date, text, boolean) from public, anon, authenticated;
revoke all on function public.registrar_lembrete_cobranca(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.concluir_lembrete_cobranca(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.get_lembretes_cobranca(date, text, boolean) to service_role;
grant execute on function public.registrar_lembrete_cobranca(text, jsonb, text, text) to service_role;
grant execute on function public.concluir_lembrete_cobranca(uuid, boolean, text) to service_role;

notify pgrst, 'reload schema';

-- ── P3 (28/09/2026, 1ª passada) ─────────────────────────────────────────────────────────
-- Resposta ambígua do WhatsApp (o envio pode ter saído) NÃO pode liberar novo envio: vira
-- 'incerto', que conta como enviado (bloqueia o dia e o item). Só 'falhou' — falha ANTES do
-- POST (número fora do WhatsApp) — libera tentar de novo.
-- ROLLBACK desta parte: drop function if exists public.concluir_lembrete_cobranca(uuid, boolean, text, boolean);
--   e recriar a de 3 argumentos acima; alter table ... drop constraint cobranca_lembretes_status_check,
--   add constraint cobranca_lembretes_status_check check (status in ('enviando','enviado','falhou')).
alter table public.cobranca_lembretes drop constraint if exists cobranca_lembretes_status_check;
alter table public.cobranca_lembretes add constraint cobranca_lembretes_status_check
  check (status in ('enviando', 'enviado', 'falhou', 'incerto'));

drop function if exists public.concluir_lembrete_cobranca(uuid, boolean, text);
create or replace function public.concluir_lembrete_cobranca(
  p_id uuid, p_ok boolean, p_erro text default null, p_incerto boolean default false)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  if not coalesce(
       (v_claims is null and session_user in ('postgres', 'supabase_admin'))
       or (v_claims is not null and v_claims::jsonb ->> 'role' = 'service_role'),
       false) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update cobranca_lembretes
     set status = case when p_ok then 'enviado' when p_incerto then 'incerto' else 'falhou' end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'falha no envio'), 300) end,
         updated_at = now()
   where id = p_id and status = 'enviando';
end;
$$;
revoke all on function public.concluir_lembrete_cobranca(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.concluir_lembrete_cobranca(uuid, boolean, text, boolean) to service_role;
notify pgrst, 'reload schema';
