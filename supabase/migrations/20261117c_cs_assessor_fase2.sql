-- Assessor do CS, fase 2 (17/11/2026): o log guarda a resposta, o modelo, os anexos (só tipo e tamanho),
-- as propostas geradas e confirmadas, e o feedback 👍/👎 de quem perguntou. O select continua só para admin
-- e para o dono da linha (migração 20261117b). Feedback e confirmação entram por RPC que confere a linha.
--
-- ROLLBACK:
--   drop function public.cs_assessor_feedback(uuid, smallint, text);
--   drop function public.cs_assessor_proposta_confirmada(uuid, jsonb);
--   alter table public.cs_assessor_log drop column resposta, drop column modelo, drop column anexos, drop column propostas,
--     drop column propostas_confirmadas, drop column nota, drop column comentario, drop column feedback_em;
alter table public.cs_assessor_log
  add column if not exists resposta text,
  add column if not exists modelo text,
  add column if not exists anexos jsonb not null default '[]'::jsonb,
  add column if not exists propostas jsonb not null default '[]'::jsonb,
  add column if not exists propostas_confirmadas jsonb not null default '[]'::jsonb,
  add column if not exists nota smallint check (nota in (-1, 1)),
  add column if not exists comentario text,
  add column if not exists feedback_em timestamptz;

create or replace function public.cs_assessor_feedback(p_log_id uuid, p_nota smallint, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_n int;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Assessor: sem permissão' using errcode = '42501';
  end if;
  if p_nota is null or p_nota not in (-1, 1) then
    raise exception 'Assessor: nota inválida' using errcode = '22023';
  end if;
  update public.cs_assessor_log
     set nota = p_nota,
         comentario = nullif(left(trim(coalesce(p_comentario, '')), 1000), ''),
         feedback_em = now()
   where id = p_log_id and user_id = (select auth.uid());
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Assessor: resposta não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.cs_assessor_proposta_confirmada(p_log_id uuid, p_proposta jsonb)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_n int;
begin
  if not coalesce((select public.is_cs_or_admin()), false) then
    raise exception 'Assessor: sem permissão' using errcode = '42501';
  end if;
  update public.cs_assessor_log
     set propostas_confirmadas = propostas_confirmadas || jsonb_build_array(jsonb_build_object(
           'id', left(coalesce(p_proposta->>'id', ''), 40),
           'tipo', left(coalesce(p_proposta->>'tipo', ''), 20),
           'franchise_id', left(coalesce(p_proposta->>'franchise_id', ''), 80),
           'editado', coalesce((p_proposta->>'editado')::boolean, false),
           'em', now()))
   where id = p_log_id and user_id = (select auth.uid());
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Assessor: resposta não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.cs_assessor_feedback(uuid, smallint, text) from public, anon;
revoke all on function public.cs_assessor_proposta_confirmada(uuid, jsonb) from public, anon;
grant execute on function public.cs_assessor_feedback(uuid, smallint, text) to authenticated, service_role;
grant execute on function public.cs_assessor_proposta_confirmada(uuid, jsonb) to authenticated, service_role;
