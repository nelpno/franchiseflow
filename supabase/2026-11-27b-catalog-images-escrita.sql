-- 27/11/2026 (varredura de segurança, achado 1): bucket catalog-images.
-- Antes: qualquer usuário logado inserir/trocar/apagar QUALQUER arquivo (inclusive geral/mododepreparo.jpg,
--   que o robô manda a clientes de todas as unidades, e produtos/*.jpg do cardápio).
-- Depois: admin/gerente grava em qualquer caminho; a franqueada só na pasta da PRÓPRIA unidade
--   (<evolution_instance_id>/..., que é o que o app grava: CatalogUpload.jsx -> `${franchiseId}/catalogo.jpg`).
-- Leitura: sem mudança (bucket público; catalog_images_select continua, necessário ao upsert).
-- Quem grava hoje (mapeado): FranchiseSettings > CatalogUpload (pasta da unidade); scripts com service role
--   (trocar-preparo.mjs etc.) ignoram RLS. Nenhum outro escritor autenticado.
--
-- ROLLBACK (volta ao estado anterior, byte a byte):
--   drop policy catalog_images_insert on storage.objects;
--   drop policy catalog_images_update on storage.objects;
--   drop policy catalog_images_delete on storage.objects;
--   create policy catalog_images_insert on storage.objects for insert to public
--     with check (bucket_id = 'catalog-images' and auth.uid() is not null);
--   create policy catalog_images_update on storage.objects for update to public
--     using (bucket_id = 'catalog-images' and auth.uid() is not null)
--     with check (bucket_id = 'catalog-images' and auth.uid() is not null);
--   create policy catalog_images_delete on storage.objects for delete to public
--     using (bucket_id = 'catalog-images' and auth.uid() is not null);

drop policy catalog_images_insert on storage.objects;
drop policy catalog_images_update on storage.objects;
drop policy catalog_images_delete on storage.objects;

create policy catalog_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images' and (
    (select public.is_admin_or_manager())
    or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])
  ));

create policy catalog_images_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images' and (
    (select public.is_admin_or_manager())
    or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])
  ))
  with check (bucket_id = 'catalog-images' and (
    (select public.is_admin_or_manager())
    or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])
  ));

create policy catalog_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-images' and (
    (select public.is_admin_or_manager())
    or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])
  ));
