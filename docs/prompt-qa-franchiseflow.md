# Prompt QA — FranchiseFlow (Maxi Massas)

Cole este prompt no Claude Code com o Playwright MCP configurado.

---

```
Voce e um QA Agent rigoroso. Sua missao e testar por completo o aplicativo FranchiseFlow da Maxi Massas.

## URL e Acesso
- URL do app: https://app.maximassas.tech
- Faca login como admin primeiro (eu vou fornecer as credenciais quando o browser abrir)
- Depois teste tambem como usuario franqueado (eu forneço as credenciais)

## Stack de Referencia
- React 18 + Vite + Tailwind CSS + shadcn/ui
- Backend: Supabase Cloud (Auth + Postgres + RLS)
- Roles: admin (ve tudo), franchisee (ve apenas sua franquia), manager
- Rotas: /Dashboard, /Vendas, /Gestao, /MyContacts, /Reports, /Marketing, /Acompanhamento, /Franchises, /FranchiseSettings, /PurchaseOrders, /MyChecklist, /Onboarding, /Tutoriais
- Paginas publicas: /login, /set-password

## Metodologia
1. Navegue por TODAS as paginas e secoes do app usando o Playwright
2. Tire screenshot de cada tela antes e depois de interagir
3. Teste como um usuario real faria — clicando, preenchendo, filtrando
4. Seja CETICO: nao assuma que algo funciona so porque a UI aparece bonita
5. Teste edge cases: campos vazios, valores negativos, caracteres especiais
6. SEMPRE teste em dois viewports: desktop (1280px) e mobile (375px)

## Fluxos Criticos para Testar

### 1. Autenticacao e Permissoes
- Login como admin → deve ver sidebar completa com itens admin (Relatorios, Acompanhamento, Pedidos, Franqueados)
- Login como franqueado → sidebar com 6 itens + bottom nav mobile com 5 slots (FAB "Vender" no centro)
- Verificar se o dropdown de franquias filtra corretamente por perfil (admin ve todas, franqueado ve apenas a dele)
- Verificar que nao existe login com Google (apenas email/senha)
- Testar /set-password — deve funcionar com parametro type=invite e type=recovery
- Testar logout — UI deve reagir instantaneamente (nao esperar o signOut completar)

### 2. Dashboard (/Dashboard)
- Admin: verificar que AdminDashboard carrega com 9 queries paralelas sem erros
- Admin: verificar filtro de franquia e filtro de periodo
- Franqueado: verificar que FranchiseeDashboard mostra dados apenas da franquia do usuario
- Verificar que StatsCards sempre mostra grid-cols-3
- Verificar skeletons de loading (devem espelhar layout real)
- Verificar AlertsPanel — mostra apenas alertas vermelhos (max 3)
- Trocar de aba rapidamente varias vezes — nao deve acumular erros ou mostrar dados misturados (AbortController implementado)

### 3. Registro de Vendas (/Vendas)
- Criar uma venda nova com todos os campos preenchidos (itens, pagamento, entrega)
- Verificar SaleForm: selecionar franquia, adicionar itens do estoque, definir quantidade
- Testar desconto em valor fixo (ex: R$ 6,80) — input deve aceitar centavos (step=0.01)
- Testar desconto em percentual — input deve aceitar valores inteiros
- Testar taxa de entrega — deve aceitar centavos (step=0.01)
- Verificar que card_fee_amount aparece para pagamentos card_machine e payment_link
- Tentar criar venda com campos obrigatorios vazios (deve dar erro claro em portugues)
- Verificar que valores monetarios sao exibidos corretamente (formato BRL: R$ 1.234,56)
- Testar deep-linking: /Vendas?action=nova-venda&contact_id=UUID&phone=X
- Verificar comprovante de venda (SaleReceipt gera PNG via html2canvas)
- Verificar que delivery_fee aparece como receita (NAO deduzida do resultado)
- Valor do card = value + delivery_fee na lista de vendas

### 4. Gestao (/Gestao)
- Verificar 3 abas: Resultado, Estoque, Reposicao
- Tab Resultado: verificar calculo de faturamento (vendas + delivery_fee em linhas separadas)
- Tab Resultado: linhas financeiras com valor zero devem ficar ocultas
- Tab Estoque: verificar lista de produtos com quantidades
- Tab Reposicao: verificar lista de pedidos de compra
- Testar deep-linking: /Gestao?tab=resultado, /Gestao?tab=estoque, /Gestao?tab=reposicao
- Inline edit mobile: verificar que inputs dentro de divs clicaveis funcionam (stopPropagation)

### 5. Contatos (/MyContacts)
- Listar contatos da franquia
- Verificar pipeline de status: novo_lead → em_negociacao → cliente → recorrente → remarketing → perdido
- Verificar ActionPanel com acoes inteligentes
- Criar contato manual — nome deve ser capitalizado automaticamente
- Verificar que telefone aceita formato correto (11 digitos)
- Excluir contato — deve pedir confirmacao inline (NAO window.confirm)
- Verificar que excluir contato preserva vendas associadas (ON DELETE SET NULL)

### 6. Navegacao e UI
- Verificar TODOS os links da sidebar — nenhum deve dar 404 ou tela em branco
- Verificar bottom nav mobile (5 slots com FAB Vender no centro)
- Verificar responsividade em 375px (mobile) e 768px (tablet)
- Verificar que TODOS os botoes tem acao (nenhum botao "morto")
- Verificar loading states — indicador visual durante carregamento
- Verificar que mensagens de erro sao claras e em portugues
- Verificar que toast usa sonner (nao alert/window.confirm)
- Verificar que acoes destrutivas (deletar) pedem confirmacao
- Verificar que icones usam Material Symbols (NAO Lucide icons visualmente)
- Verificar fontes: Inter (body) e Plus Jakarta Sans (headings)
- Avatar no header: deve aparecer apenas no mobile
- Botao "REGISTRAR VENDA": deve aparecer apenas no desktop (hidden md:flex)

### 7. Relatorios (/Reports) — ADMIN
- Verificar que carrega dados com limits altos (Sale/Contact 2000)
- Verificar filtros de data e franquia
- Verificar graficos (recharts) — labels mobile devem ser abreviados
- Verificar exportacao de dados (se existir)
- Testar troca rapida de filtros — nao deve acumular requests

### 8. Acompanhamento (/Acompanhamento) — ADMIN
- Verificar lista de franquias com Health Score
- Health Score: 4 dimensoes (vendas 35, estoque 25, reposicao 20, setup/WhatsApp 20)
- Verificar InventorySheet (admin ve estoque do franqueado via Sheet)
- Verificar que mostra nome da franquia (NAO so nome do dono)

### 9. Pedidos de Compra (/PurchaseOrders) — ADMIN
- Listar pedidos de todas as franquias
- Verificar status pipeline: pendente → confirmado → em_rota → entregue → cancelado
- Verificar que ao marcar "entregue" o estoque incrementa automaticamente

### 10. Franqueados (/Franchises) — ADMIN
- Listar franquias
- Abrir detalhes/configuracoes de uma franquia
- Verificar FranchiseSettings — campos de configuracao
- Verificar integracao WhatsApp: card verde=conectado, cinza=desconectado (NUNCA vermelho)
- WhatsApp card NAO deve mostrar telefone — apenas "Conecte pelo QR Code"

### 11. Onboarding (/Onboarding, /MyChecklist)
- Verificar que e obrigatorio para novos usuarios
- Verificar accordion progressivo com ProgressRing
- Verificar que checkbox funciona no checkbox (nao na linha inteira)
- Verificar dependsOn — itens bloqueados ate pre-requisito cumprido
- Verificar auto-deteccao de itens ja completos (PIX, raio entrega, etc.)

### 12. Marketing (/Marketing)
- Verificar que pagina carrega sem erros
- Verificar conteudo disponivel

### 13. Tutoriais (/Tutoriais)
- Verificar que pagina carrega sem erros

### 14. Meu Vendedor (/FranchiseSettings → Wizard)
- Verificar wizard de 6 passos visuais (Revisao NAO conta como passo — exibe X/5)
- Verificar upload de catalogo (apenas JPG)
- Verificar campos obrigatorios do wizard
- Verificar ReviewSummary ao final
- Verificar DeliveryScheduleEditor (horarios por dia da semana)

### 15. Performance e Estabilidade
- Medir tempo de carregamento de cada pagina principal (target < 3s)
- Trocar rapidamente entre abas/paginas — nao deve haver requests pendentes acumulados
- Verificar que nao ha memory leaks obvios (componentes montando/desmontando)
- Verificar que erros de rede mostram mensagem real (NAO mensagem generica)
- Verificar que campos numericos do Supabase que vem como string sao tratados (parseFloat)

## Formato do Relatorio

Ao final, produza um relatorio estruturado com:

### BUGS CRITICOS (impedem uso)
- [BUG-001] Descricao | Pagina | Steps to reproduce | Screenshot

### BUGS MEDIOS (funciona mas com problemas)
- [BUG-002] Descricao | Pagina | Steps to reproduce | Screenshot

### BUGS MENORES (cosmeticos/UX)
- [BUG-003] Descricao | Pagina | Steps to reproduce | Screenshot

### MELHORIAS DE UX (nao e bug, mas deveria ser melhor)
- [UX-001] Descricao | Sugestao de melhoria

### TELAS TESTADAS
| Pagina | Rota | Desktop | Mobile | Observacoes |
|--------|------|---------|--------|-------------|
| Dashboard | /Dashboard | ok/nok | ok/nok | ... |
| Vendas | /Vendas | ok/nok | ok/nok | ... |
| Gestao | /Gestao | ok/nok | ok/nok | ... |
| Contatos | /MyContacts | ok/nok | ok/nok | ... |
| Relatorios | /Reports | ok/nok | ok/nok | ... |
| Acompanhamento | /Acompanhamento | ok/nok | ok/nok | ... |
| Pedidos | /PurchaseOrders | ok/nok | ok/nok | ... |
| Franqueados | /Franchises | ok/nok | ok/nok | ... |
| Config Franquia | /FranchiseSettings | ok/nok | ok/nok | ... |
| Marketing | /Marketing | ok/nok | ok/nok | ... |
| Tutoriais | /Tutoriais | ok/nok | ok/nok | ... |
| Onboarding | /Onboarding | ok/nok | ok/nok | ... |
| Checklist | /MyChecklist | ok/nok | ok/nok | ... |
| Login | /login | ok/nok | ok/nok | ... |
| Set Password | /set-password | ok/nok | ok/nok | ... |

### VERIFICACAO DE PERMISSOES
| Acao | Admin | Franqueado | Resultado |
|------|-------|------------|-----------|
| Ver todas franquias | deve ver | nao deve ver | ok/nok |
| Criar venda | qualquer franquia | apenas sua | ok/nok |
| Ver relatorios | sim | nao | ok/nok |
| Ver acompanhamento | sim | nao | ok/nok |
| Editar config franquia | sim | apenas sua | ok/nok |

### RESUMO EXECUTIVO
- Total de bugs criticos: X
- Total de bugs medios: X
- Total de bugs menores: X
- Total de melhorias sugeridas: X
- Nota geral do app (1-10): X
- Top 5 prioridades para corrigir

Seja brutalmente honesto. Nao minimize problemas. Se algo parece funcionar mas tem UX ruim, reporte. Se um fluxo e confuso, reporte. Aja como um QA senior exigente.
```
