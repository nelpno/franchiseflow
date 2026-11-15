-- 2º número para os avisos do robô à unidade (pedido do Ricardo/Tatuapé, Nelson 13/10/2026).
-- Aditivo: coluna nova + coluna nova no fim da vw_dadosunidade (mesma normalização do personal_phone_wa).
alter table public.franchise_configurations add column if not exists personal_phone_extra text;
comment on column public.franchise_configurations.personal_phone_extra is
  '2º número que recebe os avisos do robô (avisa_franqueado, pedido fechado, avisos de preço/desconto). Opcional.';

do $$
declare d text;
begin
  d := pg_get_viewdef('public.vw_dadosunidade'::regclass);
  if d ilike '%personal_phone_wa_extra%' then return; end if;
  d := regexp_replace(d, '\s*FROM franchise_configurations fc;?\s*$',
    $x$, CASE WHEN COALESCE(personal_phone_extra, ''::text) = ''::text THEN ''::text
      WHEN regexp_replace(personal_phone_extra, '\D', '', 'g') ~~ '55%' AND length(regexp_replace(personal_phone_extra, '\D', '', 'g')) = 13
        THEN regexp_replace(personal_phone_extra, '\D', '', 'g')
      ELSE '55' || regexp_replace(personal_phone_extra, '\D', '', 'g') END AS personal_phone_wa_extra
    FROM franchise_configurations fc$x$);
  if d not ilike '%personal_phone_wa_extra%' then raise exception 'regex não casou no fim da view'; end if;
  execute 'create or replace view public.vw_dadosunidade with (security_invoker = true) as ' || d;
end $$;
