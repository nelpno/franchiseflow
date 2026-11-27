-- Teste do achado 2 (marketing-comprovantes): tudo dentro de um DO que termina em RAISE EXCEPTION (nada grava).
-- v_aplica=false mostra o "antes". Troque os 3 uuids por profiles reais (franchisee de franquiabaurusp, admin, manager).
do $t$
declare
  v_aplica boolean := true;
  v_fr  text := '<uuid de um profile franchisee com franquiabaurusp em managed_franchise_ids>';
  v_adm text := '<uuid de um profile admin>';
  r text := '';
  n int; n_own int; n_other int;
begin
  if v_aplica then
    drop policy public_read_comprovantes on storage.objects;
    create policy comprovantes_read on storage.objects for select to authenticated
      using (bucket_id = 'marketing-comprovantes' and ((select public.is_cs_or_admin())
        or (storage.foldername(name))[1] = any ((select public.managed_franchise_ids())::text[])));
    update storage.buckets set public = false where id = 'marketing-comprovantes';
  end if;
  r := r || 'bucket public=' || (select public from storage.buckets where id='marketing-comprovantes') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', v_fr, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='marketing-comprovantes';
  select count(*) into n_own from storage.objects where bucket_id='marketing-comprovantes' and name like 'franquiabaurusp/%';
  select count(*) into n_other from storage.objects where bucket_id='marketing-comprovantes' and name like 'franquiasantossp/%';
  r := r || 'franqueada Bauru ve ' || n || ' no bucket (propria=' || n_own || ', Santos=' || n_other || '); ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='marketing-comprovantes';
  r := r || 'admin ve ' || n || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from storage.objects where bucket_id='marketing-comprovantes';
  r := r || 'anon ve ' || n || '; ';
  reset role;
  raise exception 'RESULTADO(aplica=%): %', v_aplica, r;
end
$t$;
