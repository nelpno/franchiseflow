<!-- Shardado de apps/dashboard/CLAUDE.md em 16/06/2026 para reduzir tokens de prompt.
     Conteúdo estável (refactor 29/04/2026). Ler ao mexer em DRE / expenses / ASAAS / triggers de despesa.
     Ponteiro fica no CLAUDE.md, seção "Módulo Financeiro v2". -->

### Módulo Financeiro v2 (1A · refactor 29/04/2026 · commits `3e2dec4`, `9ad09b3`, `22c3b3a`)

**Filosofia:** DRE = caixa puro para o franqueado (didático), com 4 fluxos automatizados que reduzem lançamento manual. Diagnóstico Fase 0: só 20/47 franquias lançavam despesa antes — automação resolveu.

**`expenses` schema novo** (migration: `supabase/expense-category-migration.sql` + `expense-category-add-pacote-sistema.sql`):
- `category TEXT NOT NULL DEFAULT 'outros'` (CHECK 12 valores: `compra_produto`, `compra_embalagem`, `compra_insumo`, `aluguel`, `pessoal`, `energia`, `internet_telefone`, `transporte`, `marketing`, `pacote_sistema`, `impostos`, `outros`)
- **Adicionar categoria nova = 3 pontos sincronizados**: array `EXPENSE_CATEGORIES` ([src/lib/expenseCategories.js](src/lib/expenseCategories.js)) + constraint `expenses_category_check` + SQL versionado `supabase/expense-category-add-*.sql`. Ordem: migração no banco PRIMEIRO (DROP+ADD do CHECK é backward-compatible), deploy do front DEPOIS — senão a UI oferece valor que o banco rejeita com CHECK violation. `internet_telefone` adicionada 01/06/2026 (pedido franquia Santos)
- `supplier TEXT NULL` — fornecedor texto livre
- `source TEXT NOT NULL DEFAULT 'manual'` (CHECK 5 valores: `manual`, `purchase_order`, `marketing_payment`, `external_purchase`, `asaas_subscription`) — auditoria. Migration `expense-source-add-asaas-subscription.sql` (01/05/2026) adicionou `asaas_subscription` + UNIQUE INDEX `uq_expenses_asaas_sub_payment` (source_id, expense_date) WHERE source='asaas_subscription'
- `source_id UUID NULL` — FK opcional pro registro origem
- Index: `(franchise_id, category)` + `(source, source_id) WHERE source <> 'manual'`

**Constantes/utils reutilizáveis** (sincronizar com CHECK ao adicionar categoria):
- `EXPENSE_CATEGORIES` em [src/lib/expenseCategories.js](src/lib/expenseCategories.js) — array com `{value, label PT-BR, icon Material, color, help}`. Use em ExpenseForm, "Onde foi o dinheiro", LancarCompraSheet
- `getCategoryMeta(value)` retorna meta da categoria com fallback `outros`

**`calculatePnL()` — só caixa puro** ([src/lib/financialCalcs.js](src/lib/financialCalcs.js), simplificado 29/04 commit `d2ec8bf`):
- Retorna apenas: `vendas`, `freteCobrado`, `totalDescontos`, `totalRecebido`, `taxasCartao`, `outrasDespesas`, `lucroCaixa`, `margemCaixa`, `salesCount`
- `lucroCaixa = totalRecebido - taxasCartao - outrasDespesas` — admin e franqueado VEEM O MESMO NÚMERO. NÃO existe mais `lucro`, `lucroCompetencia`, `custoProdutos`, `gastosCompraProduto`, `gastosOperacionais`
- Param `_saleItems` mantido por compat de assinatura (3 args nas chamadas), mas ignorado
- 24 testes em [src/lib/financialCalcs.test.mjs](src/lib/financialCalcs.test.mjs) — rodar com `node src/lib/financialCalcs.test.mjs`

**Utils novos no mesmo arquivo:**
- `calcularEstoqueResumo(inventoryItems)` → `{custoTotal, vendaPotencial, qtdProdutosAtivos, markupMedioPct}` — fallback client-side do RPC
- `getEstadoFinanceiro({lucroCaixa, valorEstoqueVenda, mediaMensalReceita})` → `{estado, cor, titulo, mensagem, icone}` para banner contextual (4 estados 🟢🔵🟡🔴)

**4 fluxos automatizados de despesa:**

| Fluxo | Trigger / RPC | Categoria gerada | Idempotência |
|---|---|---|---|
| Pedido Maxi entregue | `tr_po_generate_expenses` (BEFORE UPDATE OF status) | `compra_produto` + `transporte` | `purchase_orders.expenses_generated_at` |
| Marketing confirmado | `tr_mkt_generate_expense` (status=`confirmed`) | `marketing` | `marketing_payments.expense_generated_at` |
| Mensalidade ASAAS | `tr_subscription_payment_expense` (BEFORE UPDATE OF current_payment_id, current_payment_status; dispara quando `current_payment_status='PAID'` — edge function normaliza RECEIVED/CONFIRMED/RECEIVED_IN_CASH→PAID via `mapPaymentStatus()`) | `pacote_sistema` (R$ 150, `source='asaas_subscription'`) | `system_subscriptions.last_paid_payment_id` |
| Compra externa manual | RPC `record_external_purchase()` (sheet `LancarCompraSheet.jsx`) | `compra_produto`/`compra_embalagem`/`compra_insumo` | `source='external_purchase'` |

**Triggers SQL:** todos `BEFORE UPDATE` (permite setar flag de idempotência sem recursão), `SECURITY DEFINER` + `SET search_path='public'` (linter compliance). Arquivos: `supabase/po-expense-trigger.sql`, `marketing-expense-trigger.sql`, `asaas-subscription-expense-trigger.sql`. Não conflitam com triggers existentes (`on_purchase_order_delivered` continua subindo estoque).

**Cleanup ON DELETE (30/04/2026):** apagar uma `marketing_payments` row dispara `tr_mkt_cleanup_expense` (AFTER DELETE) que remove a expense espelho (`source='marketing_payment'`, `source_id=OLD.id`). Padrão a replicar se PO/ASAAS/external precisarem cancelamento — sempre trigger SQL, nunca cleanup em 2 chamadas JS (atomicidade). Pre-flight obrigatório antes de criar trigger novo: `SELECT conname FROM pg_constraint WHERE confrelid='public.expenses'::regclass AND contype='f'` deve retornar vazio. Arquivo: `supabase/marketing-cancel-trigger.sql`.

**Regra de `source` em expenses (01/05/2026):** cada origem distinta tem valor próprio (`marketing_payment`, `purchase_order`, `external_purchase`, `asaas_subscription`). NUNCA reusar source de outra origem só porque "o CHECK aceita" — cleanup triggers ON DELETE filtram por `source + source_id`, e source compartilhado entre tabelas distintas materializa risco de cascade-delete cruzado se UUIDs colidirem. Adicionar valor novo ao CHECK é trivial (`ALTER CONSTRAINT`) e sempre vale a pena. Bug pré-existente em `tr_subscription_payment_expense`: usava `'marketing_payment'` para subscription, conflito com cleanup de marketing.

**Idempotência ASAAS — ponto cego (26/05/2026):** trigger `tr_subscription_payment_expense` marca `NEW.last_paid_payment_id := NEW.current_payment_id` **mesmo quando INSERT cai em `ON CONFLICT DO NOTHING`** (ou se a expense for apagada manualmente depois). Se a guard `IS DISTINCT FROM` "queimar" para um payment_id sem expense persistida, o trigger não retenta naquele ciclo — só na próxima virada de `current_payment_id` (ciclo seguinte). Ocorreu em 11 franquias na migração 01-02/05/2026 (Vila Maria + 10) — corrigido por INSERT manual. Forward não há risco recorrente (cada ciclo ASAAS gera payment_id novo). **Diagnóstico canônico**: JOIN `system_subscriptions ss` × `expenses e` com `e.source='asaas_subscription' AND e.source_id=ss.id AND e.expense_date=ss.current_payment_due_date` — `expense_existe=false` em sub PAID = ponto cego.

**`source_id` em expenses auto-geradas** (referência rápida): ASAAS subscription → `system_subscriptions.id` (UUID da row, NÃO franchise_id). Marketing → `marketing_payments.id`. PO → `purchase_orders.id`. External → `expenses.id` (self, source='external_purchase'). Importante pra INSERT manual replicando trigger e pra cleanup ON DELETE futuro.

**Marketing — competência por `reference_month` (fix 30/04/2026):** trigger `tr_mkt_generate_expense` deriva `expense_date = (reference_month || '-01')::date` (fallback `updated_at`/`CURRENT_DATE` se reference_month NULL/inválido). Despesa cai no mês a que o marketing se refere, **não** na data em que o admin confirmou. Antes usava `updated_at::date` → pagamento ref maio confirmado em 30/04 caía no DRE de abril. Backfill realinhou 27 despesas (3 abril→maio, 24 normalizadas para dia 1 do próprio mês). Mesma regra replicada em `supabase/scripts/backfill-historical-expenses.sql` para re-runs.

**RPCs novas:**
- `get_inventory_value_summary(p_franchise_id)` — agregado de estoque (custo + venda potencial + markup) para card "Em Estoque"
- `record_external_purchase(franchise_id, type, unit_cost, qty, supplier?, expense_date?, inventory_item_id?, description?)` — atomic: cria expense + opcionalmente sobe estoque com **custo médio ponderado** (proteção div/0). `SECURITY DEFINER` valida `is_admin_or_manager() OR p_franchise_id = ANY(managed_franchise_ids())`. Tipos: `produto` (sobe estoque), `embalagem`/`insumo` (só expense)

**Backfill aplicado (29/04/2026):**
- Heurística regex em description (89/137 = 65%) — script [supabase/scripts/categorize-existing-expenses.mjs](supabase/scripts/categorize-existing-expenses.mjs) com `--dry-run` default e `--apply`. Importante: padrões mais específicos ANTES de mais genéricos (transporte/embalagem ANTES de compra_produto, senão "Sacolas Maxi" pega "maxi"). Use `normalize()` (NFD strip diacritics) antes de regex porque `\b` em JS não trata acentos
- Backfill retroativo de POs+Marketing (116 expenses, R$ 159k) — script [supabase/scripts/backfill-historical-expenses.sql](supabase/scripts/backfill-historical-expenses.sql) executado uma vez. Análise prévia confirmou ZERO match com despesas manuais existentes (ver `audit-prepull` no script). Idempotente futuro via `*_generated_at` flags

**TabResultado redesign** ([src/components/minha-loja/TabResultado.jsx](src/components/minha-loja/TabResultado.jsx)):
- Hero metric: `lucroCaixa` grande + delta `(curr - prev)/abs(prev) * 100` vs mês anterior
- Banner contextual: 4 estados via `getEstadoFinanceiro` (verde/azul/amarelo/vermelho com cores Tailwind via lookup `BANNER_COLORS`)
- 3 cards horizontais: `Em Estoque` (com link compacto "X parados há 28+ dias →" para /Gestao?tab=estoque) / `Caixa do mês` (Vendas + Frete + Descontos detalhados) / `Mais Vendidos` (top 3 com markup, "Ver todas" → /Vendas)
- "Onde foi o dinheiro" — agrupa expenses + taxasCartao por categoria com ícone+barra `style={backgroundColor: ${meta.color}15}`
- Evolução 6 meses (recharts `ComposedChart` com 2 eixos Y): Receita (barras cinza, esq) + Lucro (linha vermelha, dir) + Média móvel 3m (linha tracejada). Tooltip mostra margem %
- `mediaMensalReceita` (3-6 meses) usado como input de `getEstadoFinanceiro`. Sem histórico, banner cai em fallback `valorEstoqueVenda > 1000`
- Empty state com CTA "Lançar despesa"
- Despesas list mostra **badge "auto"** (`bg-[#d4af37]/15`) quando `source !== 'manual'`

**ExpenseForm** ([src/components/minha-loja/ExpenseForm.jsx](src/components/minha-loja/ExpenseForm.jsx)):
- Select de categoria PRIMEIRO campo (decisão visual antes da descrição), com texto de ajuda contextual
- Input supplier opcional (max 120 chars)
- **Aviso visual** quando editando despesa auto-gerada (`source !== 'manual'`): "Esta despesa foi gerada automaticamente... evite mudar a categoria"
- CREATE força `source='manual'`. UPDATE NÃO sobrescreve `source` (preserva auto-geradas)
- Audit log enriquecido com `category` e `supplier`

**LancarCompraSheet** ([src/components/minha-loja/LancarCompraSheet.jsx](src/components/minha-loja/LancarCompraSheet.jsx)):
- Sheet bottom (responsivo: rounded-t-2xl, sm:max-w-2xl sm:mx-auto)
- 3 tipos radio buttons (produto/embalagem/insumo) com ícone+cor
- Item autocomplete só aparece se tipo=produto
- Mostra "novo custo médio sugerido" calculado client-side antes de submit
- Submit chama RPC `record_external_purchase` via `@/api/supabaseClient` (atenção ao import path correto)
- Datalist `recentSuppliers` (top 10 últimos usados)

**Preview rota** [/PreviewResultado](src/pages/PreviewResultado.jsx) — mantido pra histórico/comparação visual com 4 cenários mockados (verde/azul/amarelo/vermelho). Acessível via URL direta (não tem link na sidebar).

**Insights de uso (Clarity 3 dias antes do redesign):**
- 62% mobile (267 sess) vs 37% PC (158) — confirmou mobile-first
- /Financeiro engagement 1057s — admin lê muito, NÃO pode quebrar (estratégia non-breaking pague)
- /FranchiseSettings tem 120 dead clicks + 7 rage — backlog de UX (fora de escopo deste ciclo)
