-- Teste do achado 1 (catalog-images). Roda dentro de um DO que termina em RAISE EXCEPTION: nada grava.
-- DELETE direto em storage.objects e barrado por trigger de STATEMENT (protect_delete), entao o resultado dos 'delete' abaixo NAO prova nada:
-- a prova da policy de DELETE e a de UPDATE (mesma expressao USING) + o texto em pg_policies.
-- Trocar `v_aplica` por false para ver o "antes" (sem aplicar as policies novas).
do $t$
declare
  v_aplica boolean := true;
  v_fr  text := '<uuid de um profile franchisee com franquiabaurusp em managed_franchise_ids>'; -- franqueada de Bauru (franquiabaurusp)
  v_adm text := '<uuid de um profile admin>';
  v_mgr text := '<uuid de um profile manager>';
  r text := '';
  n int;
begin
  if v_aplica then
    drop policy catalog_images_insert on storage.objects;
    drop policy catalog_images_update on storage.objects;
    drop policy catalog_images_delete on storage.objects;
    create policy catalog_images_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'catalog-images' and ((select public.is_admin_or_manager())
        or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])));
    create policy catalog_images_update on storage.objects for update to authenticated
      using (bucket_id = 'catalog-images' and ((select public.is_admin_or_manager())
        or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])))
      with check (bucket_id = 'catalog-images' and ((select public.is_admin_or_manager())
        or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])));
    create policy catalog_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'catalog-images' and ((select public.is_admin_or_manager())
        or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])));
  end if;

  -- ===== franqueada =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_fr, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','geral/teste-franq.jpg'); r := r || 'fr insert geral=PASSOU; ';
  exception when others then r := r || 'fr insert geral=BLOQ(' || sqlstate || '); '; end;
  update storage.objects set updated_at=now() where bucket_id='catalog-images' and name='geral/mododepreparo.jpg'; get diagnostics n = row_count; r := r || 'fr update geral=' || n || 'linhas; ';
  begin delete from storage.objects where bucket_id='catalog-images' and name='geral/mododepreparo.jpg'; get diagnostics n = row_count; r := r || 'fr delete geral=' || case when n=0 then 'BLOQ(0 linhas); ' else 'PASSOU; ' end; exception when sqlstate '42501' then r := r || 'fr delete geral=INCONCLUSIVO (trigger protect_delete de statement); '; end;
  update storage.objects set updated_at=now() where bucket_id='catalog-images' and name='produtos/canelone_bolonhesa_2026-11.jpg'; get diagnostics n = row_count; r := r || 'fr update produtos=' || n || '; ';
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','franquiasantossp/x.jpg'); r := r || 'fr insert OUTRA unidade=PASSOU; ';
  exception when others then r := r || 'fr insert OUTRA unidade=BLOQ(' || sqlstate || '); '; end;
  update storage.objects set updated_at=now() where bucket_id='catalog-images' and name='franquiasantossp/catalogo.jpg'; get diagnostics n = row_count; r := r || 'fr update OUTRA=' || n || '; ';
  begin delete from storage.objects where bucket_id='catalog-images' and name='franquiasantossp/catalogo.jpg'; get diagnostics n = row_count; r := r || 'fr delete OUTRA=' || case when n=0 then 'BLOQ(0 linhas); ' else 'PASSOU; ' end; exception when sqlstate '42501' then r := r || 'fr delete OUTRA=INCONCLUSIVO (trigger protect_delete de statement); '; end;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','franquiabaurusp/teste.jpg'); r := r || 'fr insert PROPRIA=PASSOU; ';
  exception when others then r := r || 'fr insert PROPRIA=BLOQ(' || sqlstate || '); '; end;
  update storage.objects set updated_at=now() where bucket_id='catalog-images' and name='franquiabaurusp/catalogo.jpg'; get diagnostics n = row_count; r := r || 'fr update PROPRIA(catalogo.jpg)=' || n || '; ';
  begin delete from storage.objects where bucket_id='catalog-images' and name='franquiabaurusp/teste.jpg'; get diagnostics n = row_count; r := r || 'fr delete PROPRIA(teste.jpg)=' || case when n=0 then 'BLOQ(0 linhas); ' else 'PASSOU; ' end; exception when sqlstate '42501' then r := r || 'fr delete PROPRIA(teste.jpg)=INCONCLUSIVO (trigger protect_delete de statement); '; end;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','default/x.jpg'); r := r || 'fr insert default/=PASSOU; ';
  exception when others then r := r || 'fr insert default/=BLOQ(' || sqlstate || '); '; end;
  reset role;

  -- ===== admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','geral/teste-admin.jpg'); r := r || 'adm insert geral=PASSOU; ';
  exception when others then r := r || 'adm insert geral=BLOQ(' || sqlstate || '); '; end;
  update storage.objects set updated_at=now() where bucket_id='catalog-images' and name='geral/mododepreparo.jpg'; get diagnostics n = row_count; r := r || 'adm update geral=' || n || '; ';
  begin delete from storage.objects where bucket_id='catalog-images' and name='geral/teste-admin.jpg'; get diagnostics n = row_count; r := r || 'adm delete geral(teste)=' || case when n=0 then 'BLOQ(0 linhas); ' else 'PASSOU; ' end; exception when sqlstate '42501' then r := r || 'adm delete geral(teste)=INCONCLUSIVO (trigger protect_delete de statement); '; end;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','franquiasantossp/x2.jpg'); r := r || 'adm insert pasta de unidade=PASSOU; ';
  exception when others then r := r || 'adm insert pasta de unidade=BLOQ(' || sqlstate || '); '; end;
  reset role;

  -- ===== gerente =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','produtos/teste-mgr.jpg'); r := r || 'mgr insert produtos=PASSOU; ';
  exception when others then r := r || 'mgr insert produtos=BLOQ(' || sqlstate || '); '; end;
  reset role;

  -- ===== anon =====
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin insert into storage.objects(bucket_id,name) values ('catalog-images','geral/teste-anon.jpg'); r := r || 'anon insert geral=PASSOU; ';
  exception when others then r := r || 'anon insert geral=BLOQ(' || sqlstate || '); '; end;
  reset role;

  raise exception 'RESULTADO(aplica=%): %', v_aplica, r;
end
$t$;
