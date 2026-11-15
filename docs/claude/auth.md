# Auth (AuthContext.jsx), login, convite e e-mail de senha

> movido do CLAUDE.md em 14/11/2026, texto na íntegra.

- Race conditions: `lastAuthUserRef` + `lastSignedInTimeRef` + safety timeouts (8s init, 10s login). NÃO há mutex
- `onAuthStateChange('SIGNED_IN')`: setar `setIsLoading(true)` ANTES de `loadUserProfile`. Safety timeout 10s
- `onAuthStateChange('SIGNED_OUT')`: guard `lastSignedInTimeRef` (3s). NUNCA `getSession()` dentro do handler
- Login/SetPassword: `setIsLoading(false)` OBRIGATÓRIO no caminho de sucesso
- Detecção convite: `user_metadata.password_set` (PKCE não passa `type=invite`)
- NUNCA `window.location.href` após signIn — `onAuthStateChange` cuida do redirect
- `profileLoadFailed` + `retryProfile()`: se perfil falha 2x, mostra retry UI (8s timeout)
- `resetPasswordForEmail` devolve SUCESSO para e-mail que NÃO existe (anti-enumeração): nunca exibir "email enviado"; mostrar o endereço digitado ("Se X estiver cadastrado...").
- "Não chegou o e-mail" do Auth: a prova está em `query_logs` source `auth_logs` (`POST /recover` ~1 ms sem `auth_event` = nada enviado; ~3,5 s com `user_recovery_requested` = saiu). `auth.audit_log_entries` (sempre vazia) e `recovery_sent_at` mentem. SMTP `fabrica@`, 30/h. → memória `project-diagnostico-email-auth-supabase`
