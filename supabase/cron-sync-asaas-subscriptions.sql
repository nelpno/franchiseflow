-- Sync diario das assinaturas ASAAS (01/09/2026)
--
-- POR QUE EXISTE: o webhook do ASAAS ignora de proposito a fatura do ciclo seguinte
-- (PAYMENT_CREATED com vencimento > 7 dias) para nao sobrescrever o status pago do mes
-- corrente. Sem nada que re-sincronize depois, `system_subscriptions` congela na ultima
-- fatura paga: em 01/09/2026 eram 39 de 64 franquias presas em agosto, e o QR PIX
-- guardado era o da cobranca ja liquidada -- o ASAAS responde 400 em /pixQrCode de
-- fatura paga, entao o app do banco recusava com "O QR Code nao e valido".
--
-- O roll-forward do FinancialObligationsCard conserta a franquia que ABRE o painel.
-- Este cron conserta as outras, antes de alguem tentar pagar.
--
-- A chave vive no Vault (nome `asaas_sync_key`), nunca neste arquivo.
-- Desligar: select cron.unschedule('sync-asaas-subscriptions');

create extension if not exists pg_net with schema extensions;

create or replace function public.cron_sync_asaas_subscriptions()
returns bigint
language plpgsql
security definer
set search_path = 'public, extensions, vault'
as $$
declare
  v_key text;
  v_req bigint;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'asaas_sync_key';

  if v_key is null then
    raise exception 'segredo asaas_sync_key ausente no Vault';
  end if;

  select net.http_post(
    url     := 'https://sulgicnqqopyhulglakd.supabase.co/functions/v1/asaas-billing',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey', v_key),
    body    := jsonb_build_object('action', 'check-payment-batch'),
    timeout_milliseconds := 240000
  ) into v_req;

  return v_req;  -- id em net._http_response
end;
$$;

revoke all on function public.cron_sync_asaas_subscriptions() from public, anon, authenticated;

select cron.unschedule('sync-asaas-subscriptions')
 where exists (select 1 from cron.job where jobname = 'sync-asaas-subscriptions');

-- 08:05 BRT (11:05 UTC): depois da virada do dia e antes do horario comercial
select cron.schedule(
  'sync-asaas-subscriptions',
  '5 11 * * *',
  $cron$select public.cron_sync_asaas_subscriptions()$cron$
);
