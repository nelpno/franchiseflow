-- Permite admin/manager apagar arquivos do bucket marketing-comprovantes.
-- Necessário para limpar o anexo quando admin cancela um marketing_payment.
-- Bucket hoje tem apenas INSERT (auth_upload_comprovantes) e SELECT (public_read_comprovantes).

CREATE POLICY "admin_delete_comprovantes" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'marketing-comprovantes'
    AND (SELECT public.is_admin_or_manager())
  );
