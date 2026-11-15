# Auditoria Completa FranchiseFlow (24/03/2026)

5 agentes especializados | 5 areas | 615k tokens de analise

## Resumo Executivo

| Severidade | Qtd | Status |
|-----------|-----|--------|
| CRITICO | 2 | Corrigir IMEDIATAMENTE |
| ALTO | 8 | Corrigir antes do proximo deploy |
| MEDIO | 11 | Corrigir esta semana |
| BAIXO | 8 | Backlog |
| PASS | 15+ | Padroes corretos confirmados |

## CRITICOS (2)

### C1. .env com secrets no repositorio
- Area: Seguranca | Arquivo: .env (raiz)
- SERVICE_ROLE_KEY, MANAGEMENT_TOKEN, N8N_API_KEY, ZUCKZAPGO_ADMIN_TOKEN expostos
- Fix: Verificar .gitignore, rotacionar tokens, limpar git history

### C2. Phone normalization inconsistente
- Area: Business Logic | Arquivos: MyContacts.jsx, whatsappUtils.js
- normalizePhone pode gerar formato diferente do armazenado (11 digitos)
- Fix: Garantir 11 digitos sem 55 em TODOS os pontos de entrada

## ALTOS (8)

### A1. AuthContext fallback silencioso
- AuthContext.jsx:59-66 | Se profile falha, role=franchisee + ids=[]
- Fix: Retry com backoff ou forcar re-login

### A2. RLS mixed-type array
- AuthContext.jsx:53 | managed_franchise_ids mistura UUID e evo_id
- Fix: Workaround conhecido (28 policies), documentar melhor

### A3. URL parameter injection
- Vendas.jsx:14-16 | phone, contact_id, action sem validacao
- Fix: Whitelist actions, validar UUID, normalizePhone()

### A4. localStorage password flags
- AuthContext.jsx:12 | needs_password_setup acessivel
- Fix: Mover para sessionStorage

### A5. Console em producao
- vite.config.js | 68 console statements no bundle
- Fix: terserOptions compress drop_console

### A6. min-h-screen dentro do Layout
- Franchises, Marketing, Reports, MyChecklist
- Fix: Remover min-h-screen (Layout cuida da altura)

### A7. AdminDashboard sem mountedRef/loadError
- AdminDashboard.jsx | 11 states, sem guard unmount, sem UI erro
- Fix: Pattern mountedRef + loadError + retry

### A8. Draft sem validacao 24h
- SaleForm.jsx:28-36 | Draft antigo pode restaurar precos errados
- Fix: Checar savedAt vs 24h

## MEDIOS (11)

| ID | Area | Problema | Arquivo | Fix |
|----|------|----------|---------|-----|
| M1 | Backend | delete() sem timeout | all.js:73 | withTimeout(15000) |
| M2 | Backend | Webhooks sem timeout | functions.js | AbortController 15s |
| M3 | Frontend | Sem mounted guards | Franchises, Marketing | mountedRef pattern |
| M4 | Seguranca | CSS injection via chart colors | chart.jsx:60-76 | Validar hex/rgb |
| M5 | Seguranca | Upload MIME only | CatalogUpload.jsx | Storage policy |
| M6 | Seguranca | Draft sem schema | SaleForm.jsx | Zod validation |
| M7 | Seguranca | PKCE cleanup race | AuthContext.jsx:92 | Validar replaceState |
| M8 | Performance | NODE_OPTIONS Dockerfile | Dockerfile | max-old-space-size=4096 |
| M9 | Performance | Nginx cache incompleto | nginx.conf | no-cache index.html |
| M10 | Business | Onboarding field mismatch | Onboarding.jsx | cfg.unit_address |
| M11 | Business | Edit race condition | TabEstoque.jsx | Debounce |

## BAIXOS (8)

| ID | Problema | Arquivo |
|----|----------|---------|
| B1 | SaleForm error handling misto | SaleForm.jsx |
| B2 | Webhook error messages genericas | functions.js |
| B3 | deleteCascade sem timeout | all.js |
| B4 | setTimeout sem cleanup | ChecklistItem, CatalogUpload |
| B5 | console.error sem toast | SaleForm.jsx:403 |
| B6 | Botoes sem aria-label | AdminHeader.jsx |
| B7 | Console expoe estrutura DB | Multiplos |
| B8 | Missing CSP headers | nginx.conf |

## PASS - Padroes Corretos

- RLS habilitado em TODAS as tabelas
- Queries parametrizadas (sem SQL injection)
- Code splitting excelente (lazy loading + manualChunks)
- Polling intervals adequados (30s/120s/180s)
- Promise.all para data fetching paralelo
- Sem N+1 queries
- Dependencies limpas
- Docker multi-stage build
- Session timeout 5s
- Net value + cost price + stock triggers corretos
