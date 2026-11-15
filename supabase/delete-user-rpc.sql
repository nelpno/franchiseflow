-- RPC para deletar usuário completamente (auth.users + dados relacionados)
-- SECURITY DEFINER roda como postgres (pode deletar auth.users)
-- Checagem is_admin() garante que só admins podem executar
-- Criada em 2026-03-24 para resolver dados órfãos ao remover staff
--
-- Tabelas limpas:
--   notifications (user_id UUID)
--   audit_logs (user_id UUID)
--   auth.users → cascadeia para profiles automaticamente
--
-- NÃO limpa onboarding_checklists (usa franchise_id, não user_id — limpo pelo deleteFranchiseCascade)

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas admins podem deletar
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem deletar usuários';
  END IF;

  -- Impedir auto-deleção
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível deletar a si mesmo';
  END IF;

  -- Limpar dados relacionados ao usuário
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;

  -- Deletar auth.users (cascadeia para profiles automaticamente)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Authenticated pode chamar, mas is_admin() dentro garante segurança
GRANT EXECUTE ON FUNCTION delete_user_complete(UUID) TO authenticated;
