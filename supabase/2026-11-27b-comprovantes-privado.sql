-- 27/11/2026 (varredura de segurança, achado 2): bucket marketing-comprovantes (comprovantes de Pix/PDF de todas as unidades).
-- Antes: bucket PÚBLICO (qualquer pessoa abria pela URL) e policy public_read_comprovantes deixava qualquer logado
--   listar/baixar os de todas as unidades.
-- Depois: bucket PRIVADO; ler/listar só admin/gerente/customer_success (is_cs_or_admin) ou a franqueada na pasta da
--   própria unidade (<evolution_instance_id>/...). O app abre por URL assinada de 1 h (ComprovanteLink.jsx, commit 3d853aa).
-- ORDEM: aplicar SÓ DEPOIS de o front com URL assinada estar no ar (conferido no chunk Marketing-*.js em 27/11/2026).
-- Escritores/leitores mapeados: MarketingPaymentSection (upload na pasta da unidade; guarda proof_url com a URL pública
--   antiga, de onde o app tira o caminho), MarketingPaymentsAdmin e VerbaAlvoPanel (Ver comprovante), franchiseTeardown e
--   cancelar pagamento (remove; policy admin_delete_comprovantes inalterada). Gatilhos/RPCs só testam proof_url nulo.
--   Nenhum n8n/robô/edge lê o bucket. purchase_orders.payment_proof_url (13 linhas de out/2026, caminho
--   <evo>/pedido_<id>_<ts>) também aponta para este bucket, mas nenhuma tela do app as abre (a URL pública passa a dar 400).
--
-- ROLLBACK:
--   update storage.buckets set public = true where id = 'marketing-comprovantes';
--   drop policy comprovantes_read on storage.objects;
--   create policy public_read_comprovantes on storage.objects for select to public
--     using (bucket_id = 'marketing-comprovantes' and auth.uid() is not null);

drop policy public_read_comprovantes on storage.objects;

create policy comprovantes_read on storage.objects for select to authenticated
  using (bucket_id = 'marketing-comprovantes' and (
    (select public.is_cs_or_admin())
    or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])
  ));

update storage.buckets set public = false where id = 'marketing-comprovantes';
