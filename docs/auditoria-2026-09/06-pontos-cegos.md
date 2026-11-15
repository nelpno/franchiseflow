# 06 — Pontos cegos, desperdício e o que existe sem ser usado

> Auditoria FranchiseFlow 2026-09-07. Diagnóstico read-only: nenhum arquivo de `src/` foi tocado.
> Tudo que está aqui foi lido no código (`arquivo:linha`), medido no Supabase (projeto `sulgicnqqopyhulglakd`,
> MCP + logs de edge das últimas 24 h, 06/09 13:30 → 07/09 13:30 UTC, domingo→segunda) ou no n8n (API,
> 143 workflows / 49 ativos). O que não confirmei está marcado `⚠️ NÃO VERIFICADO`.
> Scripts usados ficaram em `.tmp/audit-2026-09/` (`reach.mjs`, `exports.mjs`, `n8n-capi.mjs`, `n8n-consumers.mjs`).

## Resumo em 12 linhas

1. **O Painel Geral do admin está com as métricas de robô quebradas e ninguém sabe**: `get_bot_conversation_summary`, `get_human_message_counts` e `get_bot_leads_daily` deram **HTTP 500 em 100% das chamadas** das últimas 24 h (statement timeout de 8 s). O erro é engolido porque `supabase.rpc()` não rejeita a promise — o `toast.error` da wave 2 nunca dispara. E a wave 1 espera os 8 s antes de pintar qualquer número.
2. **O cron `aggregate-daily-data` falhou hoje (07/09)** com `numeric field overflow` (`conversion_rate numeric(5,2)`: Itaquera fez 11 vendas com 1 contato = 1100%). `daily_summaries` não tem nenhuma linha de 06/09. Foi a 11ª falha em 171 execuções; nenhum alerta existe.
3. **Uma feature inteira com zero uso na vida**: `MyChecklist` + `daily_checklists` (0 linhas desde a criação, sem item de menu) — e ainda custa **576 requests/dia** porque o `FranchiseeDashboard` consulta a tabela a cada load e a cada poll.
4. **`notifications` = 23% de todo o tráfego do dashboard** (6.021 GET/dia): o `Layout` monta **dois** `NotificationBell` (desktop + mobile), cada um com poll de 2 min. 82% das 8.298 notificações são "Estoque baixo"; 59% nunca foram lidas.
5. **3 despesas de marketing duplicadas no DRE** (Cajamar jul, Santana de Parnaíba ago, Cotia abr = R$ 1.200 contados 2×) — o cenário "auto primeiro, manual depois" não tem guarda nem tela de conferência.
6. **Regra de frete anunciada em 30/08 não está no app**: 14 dos 24 pedidos feitos depois saíram com frete R$ 0.
7. **19 das 54 franquias que pagaram anúncio em setembro não têm WABA** — o CAPI (bot e manual) é no-op para elas; nenhuma tela mostra isso.
8. **36.779 contatos têm `ctwa_clid`** (vieram de anúncio) e **nenhuma tela lê** `contacts.ctwa_clid/meta_*`.
9. Sessão morta não é detectada: a franqueada de Assis ficou **12 h com uma aba polando em 401** (621 GETs de notificações + 380 de vendas/estoque/contatos), e um franqueado tentou **9× salvar venda com 401**.
10. Cajamar tentou **24× em 7 minutos** salvar uma venda datada de amanhã (trigger `sales_bloqueia_data_futura`) — o app não tem "entrega amanhã", só bloqueia.
11. Manual recorrente: fechamento ASAAS→ERP (3 scripts em `.tmp/`), subir orçamento Meta (skill, 54×/mês), baixa manual de pagamento por fora, "quem pagou", acordos do CS por SQL, Clarity (4 pulls em 5 meses, não quinzenal).
12. Código morto voltou a acumular pouco (0 arquivos órfãos; 51 exports sem uso, 12 relevantes); o banco acumulou mais: 1 view sem consumidor (e SECURITY DEFINER), 6 RPCs sem consumidor, 2 triggers vazios, 7 tabelas `backup_*`, 1 índice de 17 MB nunca usado, 12 colunas do Analyzer mortas desde 03/06.

---

## 1. Código órfão (alcançabilidade a partir de `main.jsx`)

**Método:** grafo de `import` resolvido a partir de `src/main.jsx` (`.tmp/audit-2026-09/reach.mjs`), não grep. Resultado: **154 arquivos, 151 alcançáveis, 0 órfãos** (os 3 restantes são `*.test.mjs`). As duas limpezas (29/05 e 02/07) seguraram no nível de arquivo. O acúmulo está no nível de **export** e de **rota**.

### 1.1 Página sem porta de entrada: `MyChecklist`
- **Evidência:** `src/pages.config.js:65,81` registra a rota; `src/Layout.jsx` não tem nenhum item de menu para ela (grep `MyChecklist` em `src/` → só `pages.config.js` e o próprio arquivo). Tabela `daily_checklists`: **0 linhas, `max(created_at)` nulo** — ninguém abriu a tela desde a criação (a tela cria a linha do dia no load, `MyChecklist.jsx:145`). Clarity 3 dias: 0 sessões em `/MyChecklist`.
- **Custo hoje:** `FranchiseeDashboard.jsx:114` faz `DailyChecklist.filter(...)` em todo load e todo poll de 5 min → **576 GET `/rest/v1/daily_checklists`/dia** medidos nos logs, sempre vazios. O resultado (`getValue(3)`) nem é lido — `queryNames` na linha 138 é o único uso.
- **Quem sofre:** franqueado (1 request inútil por load), banco.
- **Correção:** apagar `pages/MyChecklist.jsx`, `components/checklist/*` (5 arquivos: `CHECKLIST_DETAILS`, `ChecklistBlock`, `ChecklistHistory`, `ChecklistItem`, `ChecklistProgress`), a entrada em `pages.config.js` (**o `const … = lazy()` E a chave em `PAGES`** — gotcha tela-branca), `DailyChecklist` em `entities/all.js:226`, a linha 114 do `FranchiseeDashboard` e a tabela `daily_checklists` (+ 3 policies + trigger `set_updated_at`).
- **Esforço:** P. **Risco:** tela branca se sobrar referência — varrer `\bDailyChecklist\b` e `MyChecklist` antes do build; smoke do `/Dashboard` de franqueado.

### 1.2 Exports mortos que ainda carregam custo de leitura/manutenção
Script `.tmp/audit-2026-09/exports.mjs` (nome exportado nunca referenciado em outro arquivo). 51 no total; 36 são re-exports de shadcn (`SidebarRail`, `SheetPortal`…) que não valem o trabalho. Os que valem:

| Export | Arquivo | Por que morreu |
|---|---|---|
| `optimizeConfig` | `src/api/functions.js:47` | webhook `adc276df…` → workflow n8n **"Otimizar Config Ia" está INATIVO** (`XrLBqUuXX77Ypthv`, parado desde 04/04) |
| `getWhatsAppMessages` | `src/api/functions.js:99` | `WhatsAppHistory.jsx` removido; ainda lê `VITE_ZUCKZAPGO_URL` (var que só existe por causa dele) |
| `analyzeLead`, `generateSalesReportsAI` | `src/api/functions.js:123,128` | stubs que só lançam erro ("funcionalidade em migração") desde o Base44 |
| `MarketingFile`, `FranchiseNote`, `ConversationMessage` | `src/entities/all.js:233,239,242` | `marketing_files` é lido por `fetch` cru em `Marketing.jsx:58-68`; `franchise_notes` morreu com o Acompanhamento; `conversation_messages` nunca foi lido pelo front |
| `SALE_REVENUE_COLUMNS` | `src/entities/columns.js` | criada em 02/07 "para travar colunas", nunca consumida |
| `isValidCpfCnpj` | `src/lib/documentUtils.js` | só `cpfCnpjError()` é usado |
| `findFranchise`, `LEGACY_PAYMENT_MAP`, `BOT_PERSONALITIES` | `src/lib/franchiseUtils.js` | `BOT_PERSONALITIES` sobrou da "Personalidade bot UI" removida |
| `ACTION_RULES` | `src/lib/smartActions.js` | exportado sem consumidor externo |
| `printImage` | `src/lib/shareUtils.js` | |
| `isIframe` | `src/lib/utils.js` | resquício do sandbox Base44 (`main.jsx` ainda posta `sandbox:beforeUpdate` para `window.parent`) |
| `DayChipsToggle` | `src/components/vendedor/WizardFields.jsx` | |
| `CATEGORY_BY_VALUE` | `src/lib/expenseCategories.js` | |

- **Correção:** apagar os 4 de `api/functions.js` + `VITE_ZUCKZAPGO_URL` do `.env`/README; apagar 3 entities; deixar shadcn quieto. **Esforço:** P. **Risco:** zero se o grep de uso continuar vazio no momento do corte.

### 1.3 Dependência instalada sem uso
- `lucide-react` (`package.json`) é importado só por 3 shadcn (`ui/checkbox.jsx`, `ui/dialog.jsx`, `ui/select.jsx`) para ícones de fechar/check — a regra do projeto é Material Symbols. Não é órfão, mas é uma lib inteira para 3 ícones. `file-saver` é usado (`ExportButtons.jsx:19`, dinâmico). **Esforço:** P (trocar 3 ícones). **Risco:** visual; conferir dialog/select/checkbox.

---

## 2. Banco sem consumidor e consumidor sem banco

**Método:** inventário de `pg_class`/`pg_proc`/`pg_trigger` cruzado com (a) grep em `src/`, (b) varredura do JSON de **todos os 143 workflows do n8n** (`.tmp/audit-2026-09/n8n-consumers.mjs`), (c) `pg_stat_user_tables`/`pg_stat_statements`.

### 2.1 Tabelas e views sem nenhum consumidor

| Objeto | Linhas | Consumidor real | Veredito |
|---|---|---|---|
| `daily_checklists` | 0 | só a feature morta (§1.1) | apagar |
| `sales_goals` | 0 | nenhum (nem `src/`, nem n8n) | apagar (tabela + 4 policies + trigger) |
| `bot_reports` | 0 | só **Bot Coach Report** (`gDTZPdrsVLhUk031`) — **INATIVO desde 06/04/2026** no n8n (`active=false`). ⚠️ O `CLAUDE.md` raiz e a memória `project_bot_coach_education` dizem "ATIVO, quinzenal dia 1/16" — está errado | apagar tabela; corrigir doc |
| `coach_actions` | 2 (último 09/04) | só "Coach Diário" (`Yzyh9VlD0cE8zXD4`), inativo | apagar |
| `franchise_notes` | 0 | nenhum (Acompanhamento removido 03/07); entity ainda exportada | apagar |
| `cs_worklist` | 19 | nenhum (deprecada em 30/06; `cs_worklist_events` continua viva) | apagar a tabela, manter events |
| `vw_bot_conversations_summary` | view | **nenhum** em `src/` nem em workflow algum. Advisor: **ERROR `security_definer_view`** | `DROP VIEW` |
| `_backup_araras_titularidade_20260805`, `_backup_promotions_combo_20260725`, `_backup_subs_20260806`, `_backup_unit_address_2026_08_26`, `backup_outcome_pre_fix_20260428`, `backup_save1_20260418`, `backup_outcome…` | 7 tabelas, 248 kB | nenhum; sem PK (advisor INFO ×7); ⚠️ inferido: são as 7 de `rls_enabled_no_policy` do advisor (contagem bate, detalhe não extraído) | exportar para `docs/db-backups/` e dropar |
| schema `mcd` (9 relações, 528 kB) | — | ERP legado (fora do escopo do dashboard) — só registro que **vive no mesmo projeto** e aparece no advisor (4 FKs sem índice) | ⚠️ NÃO VERIFICADO uso |
| `marketing_files` | 7 (desde março) | `Marketing.jsx:58-68` via `fetch` cru; 14 GET/dia | feature "Materiais" subutilizada (7 arquivos em 6 meses); 2 índices nunca usados |

### 2.2 RPCs, triggers e índices sem consumidor

| Objeto | Situação | Ação |
|---|---|---|
| `get_network_touch_ranking(date,date)` | 0 consumidores (src + n8n). Criada para uma análise ad hoc | drop |
| `get_franchise_report_data` | só no Bot Coach Report (inativo); `Reports.jsx` removido 03/07 | drop |
| `get_conversations_for_analysis`, `get_unprocessed_conversations` | só Analyzer/Coach (inativos desde 08/06 e 06/04) | drop |
| `deduct_inventory`, `update_contact_address` | 0 consumidores; `stock_decrement` (trigger) já faz o primeiro | drop (e são SECURITY DEFINER executáveis por `anon` sem guard — §6.3) |
| `get_contact_by_phone`, `upsert_bot_contact` | 0 consumidores em qualquer workflow ⚠️ (o `CLAUDE.md` lista como "RPCs normalizadas" do bot; o V5 não as chama) | confirmar com o dono do bot antes de dropar |
| `get_inventory_value_summary` | existe no banco, **nunca é chamada**: `financialCalcs.js:81` só a cita num comentário e `calcularEstoqueResumo()` (l.87) recalcula no cliente | ou usar a RPC ou dropá-la |
| Triggers `on_new_purchase_order` e `on_purchase_order_status_change` em `purchase_orders` | corpo = `RETURN NEW` (comentário: "notificação é feita pelo frontend") | 2 triggers no-op disparando em todo INSERT/UPDATE de pedido — drop |
| Índice `bot_conversations_phone_norm_idx` | **17 MB, 0 leituras** (advisor `unused_index`), mantido em cada um dos ~1.800 upserts/dia do bot | drop |
| Índices `idx_bc_intent`, `idx_bc_quality`, `idx_bc_processed`, `idx_bot_conv_followup` (6,4 MB) | colunas do Analyzer: `processed_at` último = **2026-06-03**; `intent` preenchido em 83k de 208k e nunca mais | drop os 4; as 12 colunas (`summary, intent, sentiment, outcome*, quality_score, quality_notes, tools_used, llm_abandon_reason, topics, improvement_hint, processed_at, processing_model`) podem ficar (histórico) — `outcome` ainda é usado |
| `sales.lead_id` | 0 de 17.936 preenchidos | coluna morta |
| `contacts.campaign_name` | 0 de 56.855 | coluna morta |
| `bot_conversations.followup_*` | `followup_sent_at` 112 linhas, último uso: workflow de follow-up não existe mais (`get_abandoned_for_followup` já foi dropada) | colunas mortas |
| `cs_agreements` (6 linhas, 03/09, `created_by` nulo, `author_name='Nelson'`) | lida por `get_franchise_health_signals`; **escrita só por SQL à mão** (0 consumidores em `src/`) | ver §4 |

### 2.3 Consumidor sem banco — tela calcula no cliente o que já existe (ou deveria virar RPC)

| Tela | O que faz | O que já existe / deveria existir |
|---|---|---|
| `AdminDashboard.jsx:126` | baixa **90 dias de `sales` da rede inteira** (`fetchAll`) em todo load e a cada 5 min (2.784 GET `/sales`/dia medidos, 2.765 via fetchAll) para somar faturamento/ranking/gráfico no cliente | `daily_summaries` existe para isso e é lida na linha 124 — mas o código só confia nela para `unique_contacts` (l.359-364). Uma RPC `get_network_daily_revenue(since)` (66 × 90 linhas) mata a query pesada |
| `AdminDashboard.jsx:128,179,180` | 3 RPCs de bot que **varrem 115k conversas e 213k mensagens por chamada** (EXPLAIN: 2,9 s e 11,4 s como service_role) → timeout | pré-agregar 1×/dia no cron que já existe (`aggregate_daily_data`) numa tabela `bot_daily_stats(franchise_id, day, total, converted, abandoned, ongoing, with_human)`; as 3 RPCs viram 1 index scan de ≤ 6k linhas |
| `Financeiro.jsx:58-71` | 13 meses de `sales` + `expenses` + estoque da rede via `fetchAll`, agregados no cliente por franquia×mês | `get_franchise_report_data(franchise, start, end)` existe, está morta, e faz exatamente a agregação por franquia — ou uma `get_network_monthly_pnl(months)` |
| `TabResultado.jsx:781-795` | histórico **inteiro** de vendas/despesas/estoque da franquia + loop serial de `sale_items` em chunks de 500 | pior caso hoje: `franquiasaopaulosp2` com 1.069 vendas / 2.434 itens = 2 + 3 páginas + 3 chunks. Cresce linearmente; RPC mensal de DRE (`calculatePnL` em SQL) resolve de vez |
| `Layout.jsx:238`, `AdminDashboard.jsx:125`, `Franchises.jsx:96` | `DailyUniqueContact.filter({date: hoje})` para "contatos hoje" | o `CLAUDE.md` já provou que **93% dessa tabela nasce da própria venda** (trigger `on_sale_created`) — o número é tautológico e continua estampado no header do admin |
| `FranchiseeDashboard.jsx:116` | 200 contatos por load para `SmartActions` | `smartActions.js` só precisa de contatos com `last_purchase_at ≥ 14d` e `last_contact_at ≥ 7d` — um filtro `gte` no banco reduz para dezenas |

---

## 3. Integrações montadas e subaproveitadas

### 3.1 Microsoft Clarity — ligado, ninguém olha
- **Ligado:** sim (`index.html:35-41`, projeto `w6o3hwtbya`, script no `<head>`). Token da API em `.env` (`CLARITY_DATA_EXPORT_TOKEN`), scripts prontos em `.tmp/clarity-app-wide.mjs`, `clarity-detail.mjs`, `clarity-validate.mjs`, `clarity-marketing-ux.mjs`.
- **Alguém olha?** Pulls documentados: 13/04 (`docs/clarity-ux-insights-2026-04-13.md`), 28/05, 08/06 e 07/09 (esta auditoria). **4 em 5 meses**; a "revisão quinzenal" do `CLAUDE.md` teria dado ~10. Cota de 10 req/dia: uso ≈ 0.
- **Próximo uso de graça:**
  1. Cron n8n quinzenal rodando o `clarity-app-wide.mjs` (já parametrizado) e gravando `docs/clarity/YYYY-MM-DD.md` + alerta se `ScriptErrorCount > 0` ou `RageClickCount > N`. Esforço P.
  2. `window.clarity('set', 'franchise', evoId)` e `clarity('identify', user.id)` no `AuthContext` após o login → gravações e heatmaps **filtráveis por franquia** (hoje é impossível saber se o dead click de `/Vendas` é de 1 franqueada ou de 30). Esforço P.
  3. `window.clarity('event', 'page_error')` no `PageErrorBoundary.componentDidCatch` (`PageErrorBoundary.jsx:15`) → tela quebrada vira evento filtrável com gravação. Esforço P. (ver §5)

### 3.2 Meta CAPI em venda manual — ligado e funcionando; o buraco está antes dele
- **Ligado:** `TabLancar.jsx:106-131` (`fireCapiOnConfirm`/`fireCapiBatch`) → webhook n8n `send-capi-on-sale-manual` (`xNBgSwQ6QduaS6jT`): **ativo, 50/50 execuções recentes `success`, editado hoje 13:05**. Existe também um varredor (`VarredorCapiManual`, `pnL7gJhuSzjB2Zl3`, ativo) que apanha vendas com `capi_sent=false`.
- **Cobertura medida (60 d, `sales.source='manual'`, `payment_confirmed=true`):** 5.287 com `capi_sent=true`, 271 sem — 132 sem `contact_id` (pulo por desenho), 118 com contato e sem CAPI.
- **O buraco:** **28 de 67 `franchise_configurations` não têm `whatsapp_business_account_id`**, e **19 delas pagaram marketing em setembro** (Araras, São Miguel Paulista, Rio Preto, Assis, Sorocaba Vila Jardini, Americana, Santana de Parnaíba, Nova Odessa, Mogi, Santo André, Campo Belo, Guarujá, Ubatuba, Guarapiranga, Mauá, Cotia, Cajamar, Bauru, Grajaú). Para essas, o `EnviaPedidoFechado V2` e o CAPI manual pulam em silêncio — a campanha roda sem nenhum Purchase.
- **Próximo uso de graça:** coluna "Atribuição Meta" (✔/✖ por `whatsapp_business_account_id`) em `MarketingPaymentsAdmin.jsx` (hoje o arquivo não menciona WABA) e um sinal `capi_off` no radar do CS. Esforço P. O onboarding do WABA em si é da frente de marketing (`marketing/CLAUDE.md`).
- **Dívida aberta desde 02/07:** `VITE_CAPI_MANUAL_TOKEN` continua inlined no bundle (`TabLancar.jsx:109`). Bloco C do `docs/proxima-sessao-auditoria-2026-07-02.md` nunca foi executado.

### 3.3 ASAAS — ligado; cron novo funciona; o manual está em volta
- `sync-asaas-subscriptions` (jobid 4): 6/6 execuções OK desde 02/09; 64/66 `last_synced_at = hoje`. Estado: 40 PAID / 23 PENDING / 1 OVERDUE / 2 CANCELLED; 0 QR guardado em fatura paga (fix de 01/09 segurou).
- **Sem tela, feito por script** (todos em `.tmp/`, 01/09): fechamento mensal para o ERP (`fechamento-agosto.mjs`, `agosto-final.mjs`), "quem pagou por assinatura" (`quem-pagou-agosto.mjs`), baixa manual `receiveInCash` (`baixa-suzano.mjs`), auditoria de QR (`audita-qr-rede.mjs`). A edge `asaas-billing` tem 9 actions e **nenhuma é `receive-in-cash`** nem "recebido no período".
- **Próximo uso de graça:** action `receive-in-cash` na edge + botão "Dar baixa (pagou por fora)" na linha do `AsaasSetupPanel`; aba "Recebido no mês" lendo `/v3/financialTransactions` (bruto, taxas, por forma de pagamento — o script já tem a lógica). Esforço M.

### 3.4 Webhooks n8n usados pelo dashboard (`src/api/functions.js`)
| Endpoint | Workflow | Estado |
|---|---|---|
| `a9c45ef7…` (connect/status WhatsApp) | CRIAR USUARIO ZUCK ZAP GO (`brmZAsAykq6hSMpL`) | ativo |
| `adc276df…` (`optimizeConfig`) | Otimizar Config Ia | **inativo** — função morta (§1.2) |
| `franchise-invite`, `staff-invite` | `nbLDyd1KoFIeeJEF`, `jeGBs3eCHxc2EwfG` | ativos (0 execuções na janela de retenção — normal) |
| `send-capi-on-sale-manual` | `xNBgSwQ6QduaS6jT` | ativo |
- **Zuck direto:** só `getWhatsAppMessages` (morta). O dashboard não fala com o ZuckZapGo; fala com o n8n. `VITE_ZUCKZAPGO_URL` pode sair do `.env`.

### 3.5 `notifications` / `NotificationBell` — o sino mais caro e menos lido do app
- **Produtores:** trigger `on_inventory_low_stock` (→ `notify_franchise_users`) = **6.777 das 8.298** notificações ("Estoque baixo"); front: `PurchaseOrderForm.jsx:260`, `MarketingPaymentSection.jsx:168,237` (`notify_admins`), `PurchaseOrders.jsx:432,504` (`notify_franchise_users`). Um workflow n8n ("Gerador de Contrato") também escreve.
- **Consumidor:** só `NotificationBell.jsx:31` (`limit 20`), montado **2×** no `Layout.jsx:462` (desktop) e `:481` (mobile), cada instância com `useVisibilityPolling(…, 120000)` (`NotificationBell.jsx:45`) → **6.021 GET/dia = 22,6% de todo o tráfego autenticado**, para uma lista onde **59% nunca foi lida** e, nos últimos 30 dias, 26 de 68 usuários leram alguma. Franqueadas com 50–68 "Estoque baixo" e 100% não lidas: Mauá, Cajamar, Santo André, Tatuapé, Guarapiranga, Itaquera.
- **Sem retenção:** 3.515 linhas com mais de 90 dias.
- **Próximo uso de graça:** (1) renderizar 1 sino (o container muda, o componente não precisa duplicar) e subir o poll para 5 min — ou trocar por Supabase Realtime (`postgres_changes` em `notifications` filtrado por `user_id`, incluso no plano): −5.500 req/dia; (2) `delete where created_at < now()-'90 days'` no cron horário que já existe; (3) "Estoque baixo" vira **1 notificação/dia por franquia** ("5 produtos abaixo do mínimo") em vez de 1 por produto — a trigger dispara por item; (4) os eventos que **importam** e hoje não notificam ninguém: cron falhou, RPC estourou, mensalidade OVERDUE, pedido sem frete, despesa duplicada, robô parado 7 d (§5).

### 3.6 `versionCheck` e react-query
- `versionCheck.js` bate no `/index.html` a cada 5 min (nginx, não Supabase) — barato, OK.
- `@tanstack/react-query`: provider global, **2 consumidores** (`useSubscriptionStatus.js:33`, `PageNotFound.jsx`). Frente 01 decide o caminho; aqui só registro o custo da ausência: **nenhuma tela tem cache entre navegações** (inventário completo no anexo A).

---

## 4. Trabalho manual recorrente que o app poderia matar

| # | Tarefa | Frequência | Como é feita hoje (evidência) | Vira |
|---|---|---|---|---|
| 1 | Subir orçamento das campanhas Meta com o líquido pago | mensal, ~54 franquias | skill `subir-orcamento-meta-mensal` (manual, por franquia, a partir do dashboard de pagamentos) | n8n/edge: `marketing_payments.status→confirmed` dispara `amount×0,86` no `lifetime_budget` do adset via Marketing API; log em `marketing_payments` (coluna nova `meta_budget_applied_at`) |
| 2 | Fechamento ASAAS → ERP (recebido, taxas, por forma) | mensal | `.tmp/fechamento-agosto.mjs`, `agosto-final.mjs` (01/09) | aba "Recebido no mês" no `Financeiro › Mensalidades` (§3.3) ou cron dia 1 → e-mail/Zuck |
| 3 | "Quem pagou / quem não pagou" por assinatura (dono multi-unidade) | mensal + ad hoc | `.tmp/quem-pagou-agosto.mjs`; caso Anderson/Cataguases | coluna "pago por qual assinatura" já cabe no `AsaasSetupPanel` (tem `asaas_subscription_id`) |
| 4 | Baixa de pagamento feito por fora (`receiveInCash`) | ad hoc (Suzano 01/09) | `.tmp/baixa-suzano.mjs` com a chave do fiscal-bot | action na edge + botão (§3.3) |
| 5 | Conferência de fechamento: `count(marketing confirmed) × count(expenses 'Marketing - AAAA-MM')` | mensal | regra escrita no `CLAUDE.md` raiz; **não é rodada** — prova: 3 duplicatas vivas (§6.4) | check no cron diário + aviso no `ExpenseForm` |
| 6 | Acordos do CS (`cs_agreements`) | por caso | 6 linhas inseridas por SQL em 03/09, `created_by` nulo | campo "Acordo/piso" no `FranchiseDrawer` (a RPC de saúde já lê) |
| 7 | Frete do pedido à fábrica | por pedido (~19/semana) | digitado à mão (`freight_cost`); regra `min(350, max(250, 10%))` anunciada 30/08 | default calculado em `PurchaseOrderForm`/`PurchaseOrders` (§6.5) |
| 8 | Análise mensal de franquia (PDF) | mensal por unidade | skill `analise-franquia` | fora do escopo desta frente; mas os dados (funil, ranking, DRE) já estão em RPC |
| 9 | Pull do Clarity | "quinzenal" (real: 4 em 5 meses) | scripts em `.tmp/` | cron (§3.1) |
| 10 | Revisor semanal do Celso | semanal | skill `revisor-semanal-celso` lendo `cs_worklist_events` | idem — dados já existem |
| 11 | Troca de dono (varrer 2 tabelas) | por caso | checklist no `CLAUDE.md` (Araras) | ação "Transferir titularidade" em `Franchises.jsx` (limpa PIX/telefone/`billing_email`/convite antigo) |
| 12 | Verificação de deploy | por deploy | `.tmp/deploy.mjs` (com API key do Portainer hardcoded), `verify-deploy.mjs`, `verify-content.mjs` | um script versionado em `scripts/` lendo a key do `.env` |
| 13 | Reprocessar `daily_summaries` quando o cron falha | quando alguém nota (hoje: 06/09 perdido) | `select aggregate_daily_data('2026-09-06')` à mão | cron com `ON CONFLICT` já é idempotente — falta o **alerta** (§5) |

---

## 5. Vigilância que não existe — e o que já passou despercebido nas últimas 24 h

O Clarity mostra 0 erros de script. Os logs do Supabase mostram outra coisa. Cada item abaixo foi **medido**, não suposto.

### 5.1 RPCs do Painel Geral em timeout, erro engolido
- **Evidência:** edge logs 24 h: `POST /rest/v1/rpc/get_bot_conversation_summary` 8 chamadas / **8 × HTTP 500**; `get_human_message_counts` 8 / 8 × 500; `get_bot_leads_daily` 15 / 8 × 500. `postgres_logs`: "canceling statement due to statement timeout" nos mesmos instantes (21:39, 21:53, 22:07, 23:36→23:56 a cada 5 min = polling, 00:27, 11:34). `authenticated` tem `statement_timeout=8s`. EXPLAIN ANALYZE do corpo: `get_bot_leads_daily` = **Seq Scan em 208k linhas, 2,9 s** como service_role (e como `authenticated`, sem SECURITY DEFINER, a policy `bot_conv_select` chama `is_admin_or_manager()` **por linha**); `get_human_message_counts` = **11,4 s** (Index Scan em 213k mensagens + HashAggregate com spill em disco). `get_bot_conversation_summary` faz `SELECT DISTINCT conversation_id FROM conversation_messages WHERE direction='human'` **sem janela de data**. É estrutural, não pico: a memória `project_rpc_perf_baseline_2026-04-29` mediu 34 ms/60 ms com 28k conversas; hoje são 208k conversas e 938k mensagens.
- **Por que ninguém viu:** `supabase.rpc()` resolve com `{data:null, error}` — nunca rejeita. `AdminDashboard.jsx:149,183` tratam só `status === "rejected"`, então `w1Failed`/`w2Failed` ficam vazios, `toast.error` nunca dispara e `setBotSummary([])` pinta o `BotSummaryCard` vazio como se fosse "sem dados".
- **Quem sofre:** admin (2 usuários; user `6f1c0626` é quem aparece nos logs).
- **Impacto:** wave 1 (`AdminDashboard.jsx:122`) espera o `allSettled` — **o Painel Geral fica 8 s no skeleton antes de mostrar qualquer número**, e depois mostra o robô zerado. Métrica de bot da rede = cega há tempo indeterminado (⚠️ só tenho 24 h de log).
- **Correção:** (a) curto prazo: `if (res.error) throw res.error` nos 3 `rpc()` (ou checar `.error` no `getValue`) para o erro aparecer; tirar `get_bot_leads_daily` da wave 1 (não gate a primeira pintura); (b) real: pré-agregar diariamente (§2.3) e/ou `get_bot_leads_daily` como SECURITY DEFINER com guard (1 chamada de `is_admin_or_manager()` em vez de 208k) + índice `bot_conversations(started_at)`; adicionar `created_at >= p_since` na CTE `human_convos` do summary. **Esforço:** P (a) + M (b). **Risco:** trocar a semântica dos agregados — comparar os 3 resultados numa janela pequena antes/depois.

### 5.2 Cron `aggregate-daily-data` falhando sem alerta
- **Evidência:** `cron.job_run_details` jobid 1: 07/09 05:00 UTC `failed` — `numeric field overflow… precision 5, scale 2`; **11 falhas em 171 execuções** na vida do job. `daily_summaries` para 06/09: **0 linhas** (05/09: 67; 194 vendas existem no dia). Causa: `conversion_rate` calculado como `sales/contacts×100` em `numeric(5,2)` (máx 999,99) — Itaquera 06/09: 1 contato em `daily_unique_contacts`, 11 vendas → 1100%. Dias com alguma franquia ≥ 10× nos últimos 120 d: **7** (o job inteiro morre por causa de 1 linha).
- **Quem sofre:** franqueado (`FranchiseeDashboard.jsx:108` lê 30 dias de summaries para `MiniRevenueChart`/meta diária → buraco no gráfico) e admin (`AdminDashboard.jsx:124`, 90 d).
- **Correção:** `LEAST(…, 999.99)` ou `conversion_rate numeric(7,2)` + reprocessar `select aggregate_daily_data('2026-09-06')`; sentinela (§5.6). **Esforço:** P. **Risco:** nenhum (idempotente via `ON CONFLICT`).

### 5.3 Sessão morta polando a noite inteira
- **Evidência:** user `97915181` (franqueada de **Assis**): 2.723 requests em **25 horas ativas** (aba nunca fechou), dos quais **621 GET `/notifications` = 401**, 132 `/contacts` 401, 123 `/sales` 401, 123 `/inventory_items` 401 — ou seja, ~10 h de Vendas + 2 sinos polando com token morto. Outro user: **9 × `POST /rpc/save_sale_with_items` = 401** (tentou vender com sessão expirada).
- **Por que ninguém viu:** `NotificationBell.jsx:34-37` `catch { /* silently fail */ }`; `useVisibilityPolling` só para quando `document.hidden`; nenhum ponto central trata 401/`PGRST301` — só mensagens locais em `MyContacts.jsx:141`, `PurchaseOrderForm.jsx:33`, `PurchaseOrders.jsx:171`, `Onboarding.jsx:408` e o mapa em `safeErrorMessage.js:11,19`.
- **Correção:** no `entities/all.js` (`withTimeout` ou um wrapper de erro): se `error.code === 'PGRST301'` ou `status === 401` → `supabase.auth.refreshSession()` 1×, senão `logout()` com toast "Sessão expirada" e parar os pollings. **Esforço:** P/M. **Risco:** logout indevido em 401 transitório — só deslogar após refresh falhar.

### 5.4 Venda com data de amanhã: 24 tentativas em 7 minutos
- **Evidência:** user `e67b24d2` (**Cajamar**), 06/09 22:46→22:53 BRT: **24 × `POST /rpc/save_sale_with_items` 400**; `postgres_logs`: "A data da venda (07/09/2026) esta no futuro. Hoje e 06/09/2026." (trigger `sales_bloqueia_data_futura`). `SaleForm.jsx:819` faz `throw error` → toast; a pessoa insistiu 24 vezes.
- **Leitura (revista em 08/09/2026 — a primeira estava errada em dois pontos):**
  1. **Não foram 24 tentativas dela: foram 8 cliques × 3.** O `withRetry` do `SaleForm` retentava um erro de regra com 2 s e 4 s de espera, cuspindo dois toasts "Tentando novamente em…" por rodada. Corrigido: `ehErroDeRegra()` (23xxx, 42501, P0001) corta o retry na hora.
  2. **É bug, sim — a trava é larga demais.** Data futura não é só "reserva sem pagamento": boa parte da rede lança a venda com a data da ENTREGA para o pedido ficar no topo da lista do dia certo. Em 180 dias isso são **663 vendas de 30 franquias**, 628 delas ≤ 7 dias à frente. O trigger virou **janela de 14 dias** (`supabase/2026-09-08-sales-data-futura-janela-14-dias.sql`).
  3. E **ninguém via o motivo**: `23514` não estava no `CODE_MAP` e o `catch` do `SaleForm` nem consultava o erro. Agora a mensagem do trigger chega inteira na tela (whitelist `PREFIXOS_SEGUROS`).
- **Como apareceu:** não pelo log — pelos 3 áudios da franqueada do Guarujá em 08/09 (18:22, 18:24, 18:25). Um evento `sale_blocked_future_date` continua valendo para não depender de a pessoa reclamar.

### 5.5 Erros que o bot gera contra o banco (fora do dashboard, mas no mesmo projeto)
- `service_role POST /rest/v1/contacts` → **804 × 409/dia**; `rpc/log_conversation_message` → **672 × 409/dia**. O n8n usa INSERT onde deveria ser UPSERT (`on_conflict`) — 1.476 erros/dia que contam como request e como log. ⚠️ NÃO VERIFICADO qual nó; escopo do bot.
- `conversation_messages` GET (service_role) com `avg 478 ms, max 8,1 s` — alguém no n8n lê mensagens sem índice adequado. ⚠️ escopo do bot.

### 5.6 O que dá para montar barato
1. **Sentinela diária em SQL** (função `sentinela_diaria()` no `pg_cron` às 08:10 BRT, logo após o sync do ASAAS) que faz `notify_admins()` — e opcionalmente `pg_net` → Zuck — quando: `cron.job_run_details` teve `failed` nas últimas 24 h; `daily_summaries` do dia anterior tem < `count(franchises active)` linhas; existe franquia com média ≥ 3 vendas/dia (30 d) e 0 vendas há 2 dias; `expenses` marketing duplicada no mês (§6.4); `purchase_orders` confirmados com `freight_cost = 0`; `marketing_payments` confirmados sem WABA. Esforço M, tudo em SQL, sem deploy de front.
2. **`PageErrorBoundary.componentDidCatch` reportando**: `window.clarity?.('event','page_error')` + `Notification`? Não — melhor `supabase.from('client_errors').insert({user_id, route, message, stack, ua})` com policy INSERT para `authenticated`. Esforço P. Hoje `vite.config.js:15` tem `drop: ['console','debugger']` — **`console.error` some do bundle de produção**, então nem o DevTools do franqueado mostra nada (item 3.3 de 02/07, ainda aberto).
3. **`rpc()` que falha vira erro visível**: helper `rpcOrThrow()` em `entities/all.js` (as RPC helpers da linha 249+ já fazem isso; os 3 `supabase.rpc` diretos do `AdminDashboard` não).
4. **Contador de 4xx/5xx por dia** no próprio Supabase: a query de logs desta auditoria (`query_logs` por `status_code ≥ 400`) cabe num n8n diário. Esforço P.

---

## 6. Dívida documentada e nunca cobrada — o que já estourou

| # | Gotcha no `CLAUDE.md` | Gatilho real | Medido em 07/09 | Status |
|---|---|---|---|---|
| 6.1 | "Vendas carrega só os ~1000 contatos mais recentes" (`Vendas.jsx:88-95`, sem `fetchAll`) | franquia > 1000 contatos | **30 franquias > 1000** (Guarujá 2.887, SP2 2.384, SP6 2.194…); p50 da rede = 753 | **ESTOUROU**, mitigado pelo snapshot `customer_name/contact_phone` na venda (trigger 16/06). Residual: `contactsMap` incompleto para WhatsApp/endereço de cliente antigo |
| 6.2 | "`fetchAll` em `bot_conversations` 28k = 20 s → RPC" | crescimento | 208.599 conversas (7,4×) / 938k mensagens; **as RPCs que substituíram o fetchAll agora estouram 8 s** (§5.1) | **ESTOUROU de novo, um nível acima** |
| 6.3 | "`limit N` em queries 1-row-por-franquia vira teto silencioso" | rede > N | `OnboardingChecklist.list(…, 200)` (`Franchises.jsx:99`), `FranchiseConfiguration.list(…, 200)` (`Onboarding.jsx:95`, `MarketingPaymentsAdmin.jsx:112`), `MarketingPayment.filter(…, 200)` (`MarketingPaymentsAdmin.jsx:110`), `PurchaseOrder.list(…, 500)` (`AdminDashboard.jsx:263`) | não estourou (67 franquias). **Novo teto achado:** `PurchaseOrders.jsx:144` `PurchaseOrder.list("-ordered_at")` **sem limit e sem `fetchAll`** → cap de 1.000 do PostgREST; hoje 371 pedidos, ~40/mês → **~16 meses** |
| 6.4 | "Fechamento de mês compara `count(marketing confirmed)` × `count(expenses 'Marketing - AAAA-MM')`" (regra de 19/08) | mensal | contagens batem (set 54/53, ago 54/54…), **mas o inverso não é checado**: 22 franquia-meses com > 1 despesa de marketing; **3 duplicatas confirmadas** — Cajamar 07/2026 (auto R$ 600 + manual "Marketing" R$ 600, mesmo dia), Santana de Parnaíba 08/2026 (auto 400 + manual "Tráfego pago" 400), Cotia 04/2026 (auto 200 + manual "Marketing" 200); + 1 competência errada (Americana ref 2026-05 com `expense_date=2026-04-30`) | **ESTOUROU**: DRE de 3 franquias com R$ 1.200 contados 2×. A guarda de 19/08 só cobre "manual antes do auto" (Campinas set/26 funcionou) |
| 6.5 | "Frete = `min(350, max(250, 10%))`… `freight_cost` é lançado À MÃO" (30/08) | todo pedido | pedidos desde 30/08: **24; 14 com frete 0; 3 entre R$ 0 e 250; 7 dentro da regra**. 60 d: 129 entregues, 34 com frete 0 | **ESTOUROU**: a regra anunciada ao grupo não está no app |
| 6.6 | "`daily_summaries` só é populada às 02h; nunca hoje" | diário | **06/09 nunca foi populado** (cron falhou, §5.2) | **ESTOUROU** |
| 6.7 | "`daily_unique_contacts` NÃO é captação (93% nasce da venda)" | — | ainda exibido como "contatos hoje" em `Layout.jsx:238`, `AdminDashboard.jsx:125/389`, `Franchises.jsx:96` | **decisão documentada, não aplicada** |
| 6.8 | "`TabResultado` carrega o histórico inteiro" | franquia grande | pior caso 1.069 vendas / 2.434 itens (SP2): 2+3 páginas + 3 chunks seriais | ainda cabe; cresce ~60 vendas/mês na maior |
| 6.9 | "`MyContacts` `fetchAll` `select('*')` sem virtualização" (02/07, "deferido") | > 1000 contatos | 30 franquias em 2–3 páginas; 800 requests paginados de `/contacts`/dia | **estourou o gatilho**, sem fix |
| 6.10 | "View `vw_dadosunidade`: SECURITY INVOKER" (`CLAUDE.md` do dashboard) | — | `pg_class.reloptions` = **nulo (DEFINER)**; advisor **ERROR** para `vw_dadosunidade`, `vw_bot_inventory_items_lite` e `vw_bot_conversations_summary` (Bloco C item 4, 02/07) | **doc errada**; só `vw_bot_inventory_items` tem `security_invoker=true` |
| 6.11 | Bloco C de 02/07 (repo privado, rotacionar `VITE_CAPI_MANUAL_TOKEN`, CORS da edge, views DEFINER) | — | token continua em `TabLancar.jsx:109`; views idem | **nunca executado** ⚠️ repo/CORS não verificados aqui |
| 6.12 | "RLS policies com `auth.uid()`: sempre `(select auth.uid())`" (linter 15/04) | — | os helpers **`is_admin()`/`is_admin_or_manager()`/`managed_franchise_ids()` aparecem SEM `(select …)` em ~100 policies** (só `cs_*` e `product_weights` estão certos); STABLE ⇒ avaliados **por linha**. Prova: `profiles` (70 linhas) tem **7,24 bilhões de `idx_scan` e 2,4 M seq scans** em `pg_stat_user_tables` | **custo de CPU permanente** (§7) |
| 6.13 | "Fase 0: RPCs de PII revogadas de anon" | — | **45 funções SECURITY DEFINER continuam executáveis por `anon`**, 28 sem nenhum guard interno — entre elas `deduct_inventory` (zera estoque de qualquer franquia), `update_contact_address`, `notify_admins` (spam), `aggregate_daily_data`, `upsert_bot_conversation`, `get_network_touch_ranking`, `get_conversations_for_analysis`, `get_franchise_funnel_stats`, `get_network_funnel_benchmark` (leem métricas da rede) e 12 funções de trigger | **parcialmente cobrada** — frente 02 (segurança) deve fechar com `REVOKE EXECUTE … FROM anon, public` em lote |

---

## 7. Custo de operação — medido, não estimado

**Fonte:** edge logs, 24 h (dom→seg), `role=authenticated` = tráfego do dashboard.

| | valor |
|---|---|
| Requests totais no projeto | 66.999 (31.491 service_role = bot/n8n; **26.626 dashboard**; 8.624 sem role = auth/storage) |
| Usuários distintos no dashboard | 46 |
| Por usuário/dia | média **579**; top 5: 2.746 (Imirim), 2.723 (Assis, 25 h ativas), 1.933, 1.458, 1.409 |
| Por hora (pico, 15h UTC) | 4.190 |

**Para onde vão os 26.626:**

| path | req/dia | % | causa no código |
|---|---:|---:|---|
| `GET /notifications` | 6.021 | 22,6% | 2 sinos × poll 120 s (`Layout.jsx:462,481`, `NotificationBell.jsx:45`) |
| `GET /contacts` | 3.417 | 12,8% | `Vendas.jsx:90` (todos os contatos da franquia a cada load + poll 5 min), `MyContacts.jsx:181-190` fetchAll (800 paginados), `FranchiseeDashboard.jsx:116` (200) |
| `GET /sales` | 2.784 | 10,5% | 2.765 via fetchAll: `Vendas.jsx:52` (6 meses, **sem `franchise_id`** — RLS filtra), `AdminDashboard.jsx:126` (90 d rede), `FranchiseeDashboard.jsx:105` (3 meses), `TabResultado.jsx:781` (tudo), `Financeiro.jsx:58` (13 meses) |
| `GET /inventory_items` | 2.746 | 10,3% | `Vendas.jsx:53`, `Gestao.jsx:92` (fetchAll **sem `franchise_id`**), `FranchiseeDashboard.jsx:111`, `TabResultado.jsx:788` |
| `GET /sale_items` | 1.231 | 4,6% | `Gestao.jsx:97` (90 d fetchAll) + chunks seriais de `TabResultado`/`Financeiro` |
| `GET /franchises` | 1.101 | 4,1% | quase toda tela faz `Franchise.list()` (Layout, Vendas, Gestao, MyContacts, Settings, Onboarding, Marketing…) — sem cache |
| `GET /franchise_configurations` | 957 | | idem |
| `GET /purchase_orders` | 865 | | `FranchiseeDashboard.jsx:120` (50), `PurchaseOrderHistory.jsx:55` (tudo), `TabReposicao.jsx:43` |
| `GET /onboarding_checklists` | 781 | | `Layout.jsx:174` + `FranchiseeDashboard.jsx:122` em todo load, mesmo com onboarding concluído |
| `GET /daily_summaries` | 702 | | dashboards |
| `GET /daily_checklists` | **576** | 2,2% | **feature morta** (§1.1) |
| `POST /rpc/get_franchise_ranking` | 578 | | 1 por load/poll do franqueado; 74.739 chamadas desde março |
| `GET /system_subscriptions` | 484 | | react-query (o único cache) |
| RPCs de bot (3) | 31 | | **100% em 500** |

**Requests por navegação típica do franqueado** (anexo A): abrir o app (AuthContext 2 + Layout 2 + 2 sinos) → Dashboard (10 + 2 RPC + 1) → Vendas (4, + contatos paginados) → Gestão (4 + TabResultado 4 + chunks + histórico 2) ≈ **40–45 requests**, repetidos integralmente a cada volta porque nenhuma tela guarda estado. Uma aba de Vendas aberta 8 h: 96 polls × 3 = ~290 + 2 sinos × 240 = 480 → **~770 requests/dia parada**.

**CPU do Postgres à toa (desde o reset de 20/03):**
- `profiles`: 7,24 bilhões de index scans e 2,4 M seq scans em uma tabela de 70 linhas = helpers de RLS avaliados por linha (§6.12). Fix: `(select is_admin_or_manager())` nas ~100 policies — script SQL único; medir com `EXPLAIN ANALYZE` de `select count(*) from sales` como franqueado antes/depois.
- `sales`: 170k seq scans / 1,48 bi tuplas lidas — coerente com `get_franchise_ranking` (74.739 chamadas, varre o dia inteiro); hoje `idx_sales_franchise_date` atende via bitmap (1 ms), então o grosso é histórico. `inventory_items`: 224k seq scans (2.201 linhas; barato por chamada, caro em volume).
- `auto_close_stale_bot_conversations`: 3.616 execuções × 557 ms = 2.013 s — UPDATE horário sem índice parcial em `(status, updated_at)`. Índice parcial `WHERE status IN ('started',…)` derruba para ms. Esforço P.

**Extrapolação para dia útil:** ⚠️ NÃO VERIFICADO — a janela foi domingo→segunda; o Clarity indica ~1,5–2× mais sessões em dia útil.

---

## AS 10 COISAS QUE EU DESLIGARIA, APAGARIA OU AUTOMATIZARIA AMANHÃ
*(ordenadas por tempo economizado por semana; a base da estimativa está em cada linha)*

| # | O quê | Ganho/semana | Esforço |
|---|---|---|---|
| 1 | **Sentinela diária** (§5.6.1): cron falhou, RPC em 500, `daily_summaries` com buraco, franquia com venda média ≥ 3/dia e 0 há 2 dias, despesa de marketing duplicada, pedido sem frete, pagante sem WABA → `notify_admins` + Zuck | ~2 h (cada incidente "descoberto pela reclamação" custou uma sessão inteira: 01/09 QR, 19/08 assinatura, 26/08 ficha; hoje há 3 problemas ativos que ninguém sabia) | M |
| 2 | **Automatizar "subir orçamento Meta"** a partir de `marketing_payments` confirmado (§4.1) | ~45 min (54 confirmações/mês × 2–3 min + conferência) | M |
| 3 | **Fechamento ASAAS como tela/cron** + `receive-in-cash` na edge (§3.3, §4.2–4) | ~40 min (fechamento 1–2 h/mês + "quem pagou" + baixas manuais) | M |
| 4 | **Frete automático no pedido** — default `min(350, max(250, 0,10×total))` em `PurchaseOrderForm.jsx` e edição admin em `PurchaseOrders.jsx`; manter override para "valor combinado" (§6.5) | ~20 min (≈19 pedidos/semana corrigidos à mão; 14 de 24 saíram errados) + receita de frete que hoje não é cobrada | P |
| 5 | **Consertar as 3 RPCs de bot + `aggregate_daily_data`** (§5.1, §5.2): pré-agregar diário, `rpc()` que falha vira erro visível, `conversion_rate` com teto | ~20 min de espera do admin (8 s × ~20 loads/dia) + as métricas de robô da rede voltam a existir | P (fix) + M (pré-agregação) |
| 6 | **Guarda contra despesa de marketing duplicada**: no `ExpenseForm` (aviso quando já existe `source='marketing_payment'` no mês) e no sentinela (§6.4) | ~15 min/mês de conferência + R$ 1.200 já duplicados no DRE de 3 franquias | P |
| 7 | **Clarity quinzenal automático** (§3.1) + `clarity('set','franchise',…)` + evento no `PageErrorBoundary` | ~15 min (30 min a cada 2 semanas que hoje simplesmente não acontece) | P |
| 8 | **Detectar sessão morta** (401/PGRST301 → refresh → logout com aviso; parar polling) (§5.3) | ~10 min de franqueado + suporte (12 h de 401 em Assis; 9 vendas com 401) e −1.000 req/dia inúteis | P/M |
| 9 | **Apagar o morto** (§1, §2): `MyChecklist` + `daily_checklists` + 5 componentes; 4 funções de `api/functions.js`; 3 entities; 6 RPCs (`get_network_touch_ranking`, `get_franchise_report_data`, `get_conversations_for_analysis`, `get_unprocessed_conversations`, `deduct_inventory`, `update_contact_address`); `vw_bot_conversations_summary`; 7 tabelas backup; `sales_goals`, `bot_reports`, `coach_actions`, `franchise_notes`, `cs_worklist`; índice de 17 MB + 4 do Analyzer; 2 triggers vazios; corrigir `CLAUDE.md` (Bot Coach Report inativo, `vw_dadosunidade` DEFINER) | ~10 min (menos ruído no advisor e no contexto de cada sessão; −576 req/dia; −24 MB de índice mantido a cada insert do bot) | P |
| 10 | **Notificações**: 1 sino, poll 5 min ou Realtime, retenção 90 d, "Estoque baixo" em digest diário (§3.5) | ~5 min (o sino passa a valer a pena ser olhado) e −5.500 req/dia (−21% do tráfego do dashboard) | P |

Fora do top 10 mas prontos: `cs_agreements` por UI (§4.6); coluna "Atribuição Meta" no admin de marketing (§3.2); `(select helper())` nas policies (§6.12, −bilhões de scans em `profiles`); `REVOKE` em lote das 45 SECURITY DEFINER executáveis por `anon` (§6.13, entregar à frente 02); índice parcial para `auto_close_stale_bot_conversations` (§7).

---

## Anexo A — Inventário de chamadas por tela (load + polling + cascatas)

Levantado por subagente lendo cada arquivo; linhas conferidas por amostragem (`AdminDashboard`, `FranchiseeDashboard`, `Layout`, `NotificationBell`, `Vendas`, `Gestao`, `MyContacts`).

**Transversal (toda tela):** `AuthContext.jsx:155` `getSession` → `:47` `profiles` (cascata). `Layout.jsx:238-239` (admin: `daily_unique_contacts` hoje + `sales` hoje `columns:'id'`); `Layout.jsx:155` `Franchise.list()` → `:174` `OnboardingChecklist.filter` (franqueado, cascata). `NotificationBell.jsx:31` `limit 20`, poll 120 s, **2 instâncias** (`Layout.jsx:462,481`). `useSubscriptionStatus.js:37` react-query (staleTime 24 h se PAGO, 5 min senão; único cache do app).

| Tela | Load | Polling (`useVisibilityPolling`) | Cache | Cascatas |
|---|---|---|---|---|
| **Vendas** | `:51` `Franchise.list` · `:52` `Sale.list` 6 meses **fetchAll, sem franchise_id**, 24 colunas · `:53` `InventoryItem.list` sem franchise_id · `:90` `Contact.filter` franquia inteira (sem janela) | `:120` 300 s → `handleRefreshSales` (Sale + Inventory + Contact) | não | `Franchise.list` → `franchiseId` → `Contact.filter` |
| **Gestao** | round 1 `:73-74` `User.me` + `Franchise.list` → round 2 `:92` `InventoryItem.list` fetchAll sem franchise_id + `:97` `SaleItem.list` 90 d fetchAll · `:166` `Contact.filter` · **TabResultado** `:781-795` Sale/Expense/Inventory fetchAll **sem janela** + AuditLog 20 → `:810` loop serial `SaleItem` chunks 500 · **PurchaseOrderHistory** `:55` todos os pedidos → `:67` itens | `:58` 300 s → `loadData` (só as 4 da página) | não | 4 níveis |
| **Dashboard (admin)** | wave 1 `:114-128` (6: franchises, summaries 90 d fetchAll, duc hoje, **sales 90 d rede fetchAll**, configs, `rpc get_bot_leads_daily`) → wave 2 `:179-180` (2 RPCs) · lazy `:261-263` (contacts **rede inteira fetchAll**, inventory fetchAll, POs 500) · `:340` funil | `:232` 300 s → tudo (lazy pula contacts) | não | wave1 → wave2 |
| **Dashboard (franqueado)** | `:105-126` 10 chamadas em `allSettled` (sales 3 meses fetchAll, summaries 30, inventory, **daily_checklists**, contacts 200, `rpc get_franchise_ranking`, POs 50, onboarding 1, config 1, marketing 1) + `:305` ranking mensal + `:341` funil + subscription | `:187` 300 s → as 10 | só subscription | `evoId` → tudo |
| **MyContacts** | `:211` `Franchise.list` → `:181/186` `Contact.list/filter` **fetchAll `select` 16 colunas, sem janela** (admin: rede inteira) | não | não | 2 níveis + retry 1 s |
| **FranchiseSettings** | `:149-151` configs + franchises + me → `:223` POST n8n status WhatsApp | não | não | 3 níveis |
| **Financeiro** | `:45` `User.me` → `:57-71` franchises + sales 13 m fetchAll + expenses 13 m fetchAll + inventory fetchAll → `:130` loop serial `SaleItem` chunks · Mensalidades `AsaasSetupPanel.jsx:192-194` · Por Unidade = TabResultado | `:154` 300 s → base + chunks | não | 3 níveis |
| **Franchises** | `:95-99` franchises, duc hoje, `User.list`, `User.me`, onboarding 200 | não | não | — |
| **PurchaseOrders** | `:108` pesos · `:144` `PurchaseOrder.list("-ordered_at")` **sem limit/fetchAll (cap 1000)** · `:145` franchises · `:148` configs | não | não | — |
| **CustomerSuccess** | `:70` `reconcile_cs_auto_tasks` (1,6 s) → `:71` `cs_tasks` + `get_franchise_health_signals` (1 s) · `:38` funil lazy | `:82` 300 s → só `getCsTasks` | não | série |
| **Marketing** | `:908` `marketing_files` via `fetch` cru · `:909` franchises (admin) · `MarketingPaymentSection.jsx:80` 12 pagamentos · admin `MarketingPaymentsAdmin.jsx:110-112` (200/100/200) | não | não | — |
| **Onboarding** | nível 1 `:93-95` → `:119` `OnboardingChecklist.list()` (admin, sem limit) → nível 2 `:207` → nível 3 `:160-162` (config, **todos os POs**, inventário) | não | não | 3 níveis |
| **MyChecklist** | `:100` me → `:103` franchises → `:129` checklists 7 d → `:145` **create no load** — 100% serial | não | não | 4 níveis |

## Anexo B — Objetos de banco × consumidor (n8n ativo / src)

`vw_dadosunidade`, `vw_bot_inventory_items`, `vw_bot_inventory_items_lite`, `get_customer_intelligence`, `upsert_bot_conversation`, `log_conversation_message`, `bot_message_dedup`, `product_photos`, `daily_unique_contacts` (TrackDailyUnique) → **bot V5 / sub-workflows ativos**. `capi_sent` → EnviaPedidoFechado V2, SendCapiOnSaleManual, VarredorCapiManual. `notifications` → também "Gerador de Contrato". Todo o resto de §2 não aparece em nenhum workflow ativo.
