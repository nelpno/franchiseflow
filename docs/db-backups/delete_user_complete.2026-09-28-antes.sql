-- Backup do corpo VIVO antes da S20.2 (Onda 6). Reaplicar este arquivo = voltar.
-- delete_user_complete(p_user_id uuid) · dono postgres · md5(prosrc) ba6a21c89d1f99ad0d24b04f9e056676
CREATE OR REPLACE FUNCTION public.delete_user_complete(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem deletar usuários';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível deletar a si mesmo';
  END IF;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;
  DELETE FROM franchise_notes WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$
;

alter function public.delete_user_complete(p_user_id uuid) owner to postgres;
revoke all on function public.delete_user_complete(p_user_id uuid) from public;
grant execute on function public.delete_user_complete(p_user_id uuid) to postgres;
grant execute on function public.delete_user_complete(p_user_id uuid) to service_role;
grant execute on function public.delete_user_complete(p_user_id uuid) to authenticated;
