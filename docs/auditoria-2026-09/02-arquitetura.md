# 02 — Arquitetura e integridade do código

> Auditoria FranchiseFlow, 2026-09-07. Fable 5.1. Só diagnóstico — nenhum arquivo de `src/` foi tocado.
> Método: leitura de código + ESLint com regra ligada + testes RLS reais no Supabase (`sulgicnqqopyhulglakd`),
> cada mutação envolvida numa transação abortada por `RAISE EXCEPTION` (nada gravado).
> Tudo que não confirmei está marcado `⚠️ NÃO VERIFICADO`.

---

## 🔴 Achado 0 (fora do escopo pedido, mas é o mais grave que encontrei) — RLS deixa o franqueado virar admin e ler a rede inteira

Isto não é "gate de rota" (item 7) — é a **defesa real** furada, medido em produção.

**Evidência (testes reais, revertidos):**
- Policy `profiles_update`: `USING (is_admin() OR id = (select auth.uid()))`, **sem `WITH CHECK` e sem restrição de coluna** (query de policies). O franqueado tem `UPDATE` na própria linha de `profiles` — e `role` e `managed_franchise_ids` são colunas dessa linha, com `column_privileges` de UPDATE concedidos a `authenticated`.
- Rodei como um franqueado real (`sub = a72829b1…`, jwt `authenticated`):
  - `update profiles set role='admin' where id = <o próprio>` → **`rows_updated=1, role_depois=admin`**. Vira admin sozinho.
  - `update profiles set managed_franchise_ids = array_append(…, '<unidade de outro dono>')` → `rows_updated=1`, e logo depois `select count(*) from sales where franchise_id='<a outra>'` retornou **12** — ou seja, **passou a enxergar as vendas de uma franquia que não é dele** (todas as ~28 policies de negócio confiam em `managed_franchise_ids()`).
- `marketing_payments_update`: `USING (is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids()))`, sem restrição de coluna. Como franqueado: `update marketing_payments set status='confirmed'` na própria unidade → `rows_updated=1`, e isso **dispara o trigger `tr_mkt_generate_expense`** (auto-confirma marketing e lança a despesa no DRE sem o admin aprovar). O app só expõe `create` + anexar `proof_url` ([MarketingPaymentSection.jsx:159,225](../../src/components/marketing/MarketingPaymentSection.jsx#L159)); a RLS permite muito mais.

**Quem sofre:** admin/franqueadora (integridade da rede e do DRE), e todo franqueado (privacidade dos dados).
**Impacto:** qualquer franqueado com o token dele e um cliente REST (o próprio supabase-js no console) escala a admin, lê/edita a rede toda e auto-confirma mensalidade de marketing. É exploração de 1 linha.
**Correção:** `WITH CHECK` em `profiles_update` que **congela `role` e `managed_franchise_ids`** para não-admin (`is_admin() OR (role = old.role AND managed_franchise_ids = old.managed_franchise_ids)` — via função `SECURITY DEFINER` que compara com a linha atual, já que policy não vê `OLD`), ou `REVOKE UPDATE (role, managed_franchise_ids) ON profiles FROM authenticated` e mover essas escritas para RPC `SECURITY DEFINER` com guard `is_admin()`. Para `marketing_payments`: tirar `status` do UPDATE do franqueado (RPC de confirmação só admin, ou coluna congelada por CHECK). **Esforço:** M. **Regressão:** `handleSavePermissions`/`handleUnlinkUser` ([Franchises.jsx:483](../../src/pages/Franchises.jsx#L483)) escrevem `managed_franchise_ids` — mas rodam com admin logado, então o `is_admin()` do CHECK cobre. Testar: repetir os 3 scripts de escalação acima e exigir `rows_updated=0`.

---

## 1. Camadas — onde o contrato `entities/all.js` vaza

`entities/all.js` (455 linhas) é a porta única prometida, mas **13 arquivos importam `@/api/supabaseClient` direto** e furam de 4 jeitos:

| Vazamento | Onde | Natureza |
|---|---|---|
| `supabase.storage` cru | [Marketing.jsx:351-353](../../src/pages/Marketing.jsx#L351), [MarketingPaymentSection.jsx:153-202](../../src/components/marketing/MarketingPaymentSection.jsx#L153), [MarketingPaymentsAdmin.jsx:207](../../src/components/marketing/MarketingPaymentsAdmin.jsx#L207), [CatalogUpload.jsx:92-115](../../src/components/vendedor/CatalogUpload.jsx#L92) | upload/getPublicUrl/remove sem timeout padrão nem tratamento centralizado |
| `supabase.rpc` fora do adapter | AdminDashboard (`get_bot_leads_daily`/`get_bot_conversation_summary`/`get_human_message_counts` [:128-180](../../src/components/dashboard/AdminDashboard.jsx#L128)), `notify_admins` (MarketingPaymentSection, PurchaseOrderForm), `notify_franchise_users` (PurchaseOrders [:432,504](../../src/pages/PurchaseOrders.jsx#L432)), `record_external_purchase` (LancarCompraSheet), `save_sale_with_items` ([SaleForm.jsx:815](../../src/components/minha-loja/SaleForm.jsx#L815)), `delete_user_complete` (Franchises) | RPCs com contrato só no call-site; renomear um parâmetro no banco quebra calado |
| `supabase.from(...).delete()` na tela | [PurchaseOrders.jsx:561-564](../../src/pages/PurchaseOrders.jsx#L561) | delete em lote de `purchase_order_items`/`purchase_orders` (justificado no comentário, mas contorna `Entity.delete` que detecta RLS 0-rows) |
| **REST cru com token do localStorage** | [Marketing.jsx:41-100](../../src/pages/Marketing.jsx#L41) (`directList`/`directInsert`/`directDelete`, `getAccessToken()` lê `sb-<ref>-auth-token`) | bypass TOTAL do supabase-js "porque trava em marketing_files" — reimplementa auth, timeout e erro na mão |

Além disso: a entity `MarketingFile` **existe e ninguém usa** (grep 0 fora de `all.js`) — o acesso a `marketing_files` foi todo para o REST cru. E `createEntity.list/filter` **ignora silenciosamente qualquer chave `filter:`** (só honra `columns/signal/fetchAll/gte/lte`) — bug já documentado no CLAUDE.md, mas segue sendo uma armadilha de contrato.

**`columns` enxuto sem pre-flight:** 40 call-sites com `columns:`. Os de dinheiro estão travados em `SALE_PNL_COLUMNS`/`SALE_REVENUE_COLUMNS` ([columns.js](../../src/entities/columns.js)), mas os demais são strings soltas repetidas (`SALES_COLUMNS` em Vendas, `CONTACT_COLUMNS` em MyContacts, `INVENTORY_COLUMNS` em Gestao) — cada uma copiada, nenhuma validada contra `information_schema`. Recomendação barata: mover as 3 constantes nomeadas para `entities/columns.js` (fonte única, como as de venda).

**Correção geral (P→M):** um `storage.js` fininho no adapter (upload/publicUrl/remove com timeout), e mover `notify_admins`/`notify_franchise_users`/`record_external_purchase`/`save_sale_with_items`/`delete_user_complete` para helpers exportados de `all.js` (como já é `getFranchiseRanking` etc). O REST cru de Marketing é o mais caro de manter — mas trocá-lo exige reproduzir a "trava" alegada; deixar como está e só **documentar/testar** é aceitável no curto prazo.

---

## 2. Arquivos de 1200-1600 linhas — costura de corte

Regra que usei: só corto quando há **fronteira já existente** (componente interno, bloco de estado isolado) ou **lógica testável presa dentro de JSX**. Onde é só "arquivo grande porém coeso", digo para deixar.

| Arquivo | LOC | Costura natural | Ganho concreto |
|---|---|---|---|
| **PurchaseOrders** | 1664 | 29 `useState` num componente; 5 Dialogs já isolados por estado (`dialogOpen`, `confirmAction`, `confirmBulkAction`, `confirmDeleteAction`, `newProductOpen`). `formatBRL` local ([:41](../../src/pages/PurchaseOrders.jsx#L41)) duplica `formatters.js`. | Extrair `OrderDetailDialog`, `BulkActionBar`, `NewProductDialog` → página cai a ~900 e cada dialog fica testável. **G**, alto valor (é a tela de 1664 com só 4 sessões/Clarity — ver frente 05). |
| **Franchises** | 1508 | 30 `useState`, **9 overlays** (fiscal, editar, 3 confirmações, permissões, add-staff, convite, sheet de detalhe). Blocos independentes: gestão de equipe, dados fiscais, permissões. | Extrair `StaffPanel`, `EditFiscalDialog`, `PermissionsDialog`, `FranchiseDetailSheet`. Página → ~700. **G**. |
| **TabEstoque** | 1509 | Render duplo já marcado: mobile cards [:729](../../src/components/minha-loja/TabEstoque.jsx#L729) / desktop table [:937](../../src/components/minha-loja/TabEstoque.jsx#L937), + dialog add/edit + `getCategoryFromName`. | `InventoryTable`, `InventoryCards`, `ProductFormDialog`. Reduz risco de divergência mobile×desktop (gotcha do projeto: paridade dos 3 botões). **M-G**. |
| **SaleForm** | 1382 | `ProductSearch` (76-189) e `ContactAutocomplete` (212-368) **já são componentes internos**; e há **cálculo de dinheiro dentro do JSX** (subtotal/discount/cardFee/netValue [:587-618](../../src/components/minha-loja/SaleForm.jsx#L587)) hoje **sem teste**. | Extrair os 2 componentes para arquivos **e** puxar a matemática para `lib/saleCalc.js` testável. É o coração do app (296 sessões/Clarity). **G, prioridade alta**. |
| **Marketing** | 1311 | `UploadDialog` (240-667, **427 linhas**) e `FileCard` (668-880) são componentes internos; `directList/Insert/Delete` são camada de dados. | Extrair os 2 componentes + mover o REST para lib. Página → ~430. **M**. |
| **FranchiseSettings** | 1304 | 5 blocos `currentStep === N` renderizando `WizardStep` ([:730-1180](../../src/pages/FranchiseSettings.jsx#L730)). | Um componente por passo (`StepUnidade`, `StepOperacao`, `StepEntrega`, `StepVendedor`, `StepRevisao`). **M**. |
| **TabResultado** | 1256 | **9 sub-componentes já definidos no topo do arquivo** (HeroMetric, CardEmEstoque, CardCaixa, CardMaisVendidos, OndeFoiODinheiro, EvolucaoCard, ResumoAnoCard). | Mover cada um para arquivo. Mantém recharts no chunk próprio. **M**, baixo risco (recorte mecânico). |
| **TabLancar** | 1210 | Helpers locais (`getPaymentIcon`/`getPaymentLabel`/`formatDateSafe`/`formatTimeSafe`) + linha de venda expansível + share/print. | Extrair `SaleRow` e `useSaleShare`. **M**. |

**Não corte por corte:** o que rende de verdade é (a) `SaleForm` → tirar a matemática para lib testável, e (b) `TabResultado` → recorte mecânico dos 9 cards. Os demais são higiene; priorize por tráfego (frentes 04/05).

---

## 3. Estado e efeitos — onde ainda dá pra travar/deslogar/abrir a unidade errada

`AuthContext.jsx` (292 linhas) admite explicitamente "não há mutex" e resolve corridas com refs + timeouts (8s init, 10s login) + guarda de 3s no `SIGNED_OUT`. Mapa dos buracos que restam:

1. **Loading eterno mascarado como "erro de conexão".** No path de retry do perfil, `loadUserProfile` faz `setTimeout(800)` + retry único ([AuthContext.jsx:72-92](../../src/lib/AuthContext.jsx#L72)); se as duas tentativas caírem no timeout de leitura (15s do adapter) e o safety de 8s disparar antes, o usuário vê `ProfileRetryScreen` mesmo com sessão válida. Não é trava infinita (o safety mata), mas é "erro" falso. Baixa frequência; **⚠️ NÃO reproduzido em runtime.**
2. **`SIGNED_OUT` legítimo engolido.** A guarda ignora `SIGNED_OUT` se um `SIGNED_IN` ocorreu <3s antes ([:219](../../src/lib/AuthContext.jsx#L219)). Se o logout real acontecer nessa janela (raro), o app fica "logado" com sessão morta até o próximo refresh. Aceitável, mas é o preço do "sem mutex".
3. **A franquia errada — o caminho que sobrou.** `resolveActiveFranchise` está correto e é usado em **6 telas** (Gestao, MyContacts, Vendas, FranchiseSettings, MyChecklist e o helper). Mas o **Layout inicializa a seleção com `userFranchises[0]`** quando não há nada salvo ([Layout.jsx:165](../../src/Layout.jsx#L165)) — para multi-unidade isso **escolhe a primeira do banco antes de o usuário decidir**. As telas que passam por `resolveActiveFranchise` se protegem (devolvem `null` → `FranchisePicker`), mas as que leem `ctxFranchise` **direto** não: `FranchiseeDashboard` usa `ctxFranchise?.id` sem picker ([FranchiseeDashboard.jsx:73](../../src/components/dashboard/FranchiseeDashboard.jsx#L73)), e `MarketingPaymentSection` usa `ctxFranchise?.evolution_instance_id` ([:60](../../src/components/marketing/MarketingPaymentSection.jsx#L60)). Hoje há **1 dono multi-unidade** na base (medido) — então o Layout preencher `[0]` faz o **Dashboard e o pagamento de marketing abrirem a unidade que o banco listou primeiro**, sem o `FranchisePicker` que as outras telas mostram. É a mesma classe do bug Araras×Limeira, num canto que o fix não cobriu.
   **Correção:** o Layout **não** deve setar `[0]` para multi-unidade — deixar `null` e deixar o `FranchisePicker`/seletor decidir (igual às 6 telas já corrigidas). **P.** Regressão: single-unidade continua auto-selecionando (aí `[0]` é a única, correta). Testar com o dono de 2 unidades: abrir direto `/Dashboard` sem seleção salva.
4. **`selectedFranchise` no localStorage guarda só o `id`** ([:23](../../src/lib/AuthContext.jsx#L23)) e é reidratado casando `id` **ou** `evolution_instance_id` — ok. Mas se a franquia salva foi desvinculada, `resolveActiveFranchise` cai em `null` (bom) enquanto o Layout ainda pode ter setado `[0]` (ruim) — mesma raiz do item 3.

---

## 4. Tela branca (`no-undef` desligado) — quantas hoje e a guarda que fecha

**Medição (ESLint 9 com `no-undef` + `react/jsx-no-undef` LIGADOS sobre `src/`):** **0 ocorrências hoje** (130 arquivos lintados). O relatório está em `.tmp/…/src-strict.json`. Ou seja, o risco é **latente**, não presente — o buraco é o processo, não o estado atual.

**Prova de que o buraco existe** (canário fora de `src/`, [.tmp/canary/Canario.jsx](../../.tmp/canary/Canario.jsx) — usa `safeErrorMessage`, `formatBRL` e `<Skeleton>` sem importar):
- Com a **config atual do projeto** (`npm run lint`): **exit 0, zero erro** — o símbolo faltando passa reto (confirma o gotcha).
- Com a config do projeto **+ as 2 regras herdadas**: acusa os **3**:
  ```
  Canario.jsx:4 [no-undef] 'safeErrorMessage' is not defined.
  Canario.jsx:5 [no-undef] 'formatBRL' is not defined.
  Canario.jsx:6 [react/jsx-no-undef] 'Skeleton' is not defined.
  ```
Causa raiz confirmada no [eslint.config.js:40-62](../../eslint.config.js#L40): o bloco `rules:` do projeto **substitui** o `rules` do `pluginJs.configs.recommended` (spread `...pluginJs.configs.recommended` vem ANTES, o `rules:` explícito vence), e nunca declara `no-undef`/`react/jsx-no-undef`. Some junto o `react-in-jsx-scope:off` → símbolo global é aceito.

**Guarda mais barata (P) — herdar a config e ligar só as 2 regras:**
```js
// eslint.strict.config.js  (novo, ao lado do eslint.config.js)
import base from "./eslint.config.js";
export default base.map((c) => ({
  ...c,
  rules: { ...(c.rules || {}), "no-undef": "error", "react/jsx-no-undef": "error" },
}));
```
```jsonc
// package.json → scripts
"lint:undef": "eslint --config eslint.strict.config.js --no-config-lookup src",
```
Rodar no pre-push/CI **antes** de `.tmp/deploy.mjs`. **Provado:** essa exata config dá `exit 0` em `src/` (nada quebra hoje) e `exit 1` com os 3 erros no canário. Não mexe no `npm run lint` do dia a dia (que segue `--quiet`), então não polui o fluxo — é um gate separado. Alternativa mais forte seria ligar `no-undef` no config principal, mas aí o `no-unused-vars:off` + globals do browser precisam ser reconferidos; o wrapper evita esse risco. **Não** confiar em `tsc` para isso: `npm run typecheck` hoje cospe **1693 erros** (1275× TS2322 etc, ruído de JS em `checkJs`) e os únicos TS2304 são de `node_modules/file-saver` — inútil como sentinela de símbolo faltando.

---

## 5. Duplicação de regra de negócio — cada uma é um bug futuro

| Regra | Fonte canônica | Cópias que vão divergir |
|---|---|---|
| **Formatação BRL** | `formatters.js` (`formatBRL`) | `new Intl.NumberFormat("pt-BR"…)` inline em **9 arquivos**: SaleForm:191, SaleReceipt:9, TabLancar:49, TabResultado:52, TabEstoque:556, MyContacts:94, PurchaseOrders:43, PurchaseOrderForm:25 + `formatBRL` local em PurchaseOrders:41. Semânticas sutilmente diferentes já morderam o projeto (o `lib/formatBRL.js` foi removido por isso). |
| **Label/ícone de pagamento** | `franchiseUtils.getPaymentMethodLabel` | `PAYMENT_METHODS.find(...)` inline em SaleForm:924, SaleReceipt:14, TabLancar:72/77, ReviewSummary:53 + `getPaymentLabel`/`getPaymentIcon` locais em TabLancar. |
| **`feeableMethods`** (quais métodos têm taxa) | — não existe fonte única | Lista `["credit","debit","nfc","payment_link","meal_voucher"]` **hardcoded 3×** dentro do SaleForm ([:611,790,791,1195](../../src/components/minha-loja/SaleForm.jsx#L611)). Adicionar um método (o CLAUDE.md já avisa que toca N lugares) esquece uma dessas. |
| **Rótulo mês (`MMM/yyyy` + strip do ponto)** | — | `formatMonthLabel` **copiado idêntico** em FranchiseeDashboard:32 e TabLancar:41. |
| **`formatPhone`** | `whatsappUtils.formatPhone` | Reimplementado local em [SaleForm.jsx:196](../../src/components/minha-loja/SaleForm.jsx#L196) (mesma lógica, mão trocada). |
| **Parse de DATE→hora local** (`+"T12:00:00"`) | `dateOnly.parseDateOnly` existe e resolve isso | `new Date(x + "T12:00:00")` espalhado em 6 arquivos (FinancialObligationsCard, SubscriptionPaywall, SubscriptionPaymentSheet, MarketingPaymentsAdmin, FranchiseDrawer, Marketing). |
| **Label entrega/retirada** | `salesExport.DELIVERY_LABEL` | strings soltas "Entrega"/"Retirada" em SaleForm, ReviewSummary, WizardStepper. |
| **`isAdmin` (role check)** | — não há helper de front | `role === 'admin' || role === 'manager'` recopiado em **8 arquivos** (Layout, Dashboard, TabEstoque, Marketing, MyContacts, Onboarding, FranchiseSettings, MarketingPaymentsAdmin — este último só `'admin'`, divergência real). |

Nota positiva: **dinheiro de venda** (`getSaleNetValue`/`calculatePnL`) e **frete/marketing** (`marketingLiquid`, `getMarketingTargetMonth`) **estão** centralizados e reusados — a duplicação restante é de *apresentação* (formatação, labels), não de cálculo. Ainda assim, "quais métodos têm taxa" (feeableMethods) é regra de negócio hardcoded 3× no arquivo mais crítico.

**Correção:** consolidar formatação BRL/telefone/data nas libs que já existem (P cada, mecânico), criar `PAYABLE_FEE_METHODS` em `franchiseUtils` e um `isAdmin(user)` helper. Baixo risco; ganho é parar a sangria.

---

## 6. Cobertura de teste — o que mexe com dinheiro/estoque/permissão e não tem teste

Existem 5 `*.test.mjs`. **Só `financialCalcs.test.mjs` tem estrutura real** (27 blocos `test()`, 54 asserts). Os outros usam `assert` no top-level: addressUtils (33 asserts), documentUtils (20), franchiseUtils (17) — funcionam via `node --test`? **Não** — sem `test()` eles rodam como script solto (o `node --test` não os coleta como casos). E **`productWeight.test.mjs` tem 0 asserts** (34 linhas) — é um arquivo de teste que **não testa nada**. ⚠️ confirme rodando `node --test src/lib/`.

Ordenado por risco (mexe com dinheiro/estoque/permissão e **não** tem cobertura):

1. **Matemática do `SaleForm`** (subtotal, desconto %/fixo, taxa de cartão repassada×absorvida, `netValue`) — hoje dentro do JSX ([:587-618](../../src/components/minha-loja/SaleForm.jsx#L587)), 0 teste. É o dinheiro que entra. → extrair `lib/saleCalc.js` e testar. **Risco máximo.**
2. **`stockSuggestion.js`** (`weeklyTurnoverMap`, `suggestionFor`) — decide o que a franquia compra da fábrica, LOOKBACK/coverage/min_stock; 0 teste, consumido por 3 telas.
3. **`salesExport.js`** — soma de totais + resolução nome/telefone; 0 teste (usa `getSaleNetValue` testado, mas o agregado e o snapshot de contato não).
4. **`smartActions.js`** — regras de reativação (guardas de 7/14/30 dias); 0 teste.
5. **`saveFiscalData.js`** — monta `unit_address` a partir do estado mesclado (o fix de 26/08 que já quebrou 2×); depende de `resolveDeliveryAddress` (esse tem asserts) mas o **merge de patch** não é testado.
6. **`whatsappUtils.normalizePhone`** — invariante de telefone canônico; 0 teste real.

**Correção (M):** dar a `financialCalcs.test.mjs` companhia — `saleCalc.test.mjs`, `stockSuggestion.test.mjs`, `salesExport.test.mjs`. E consertar os 4 test files que não coletam casos (envolver em `test()`), senão eles dão falsa sensação de cobertura.

---

## 7. Segurança/permissão no cliente vs RLS

O item 0 já é o pior caso. Complementos verificados:

- **Gates de rota são só UX.** `ADMIN_ONLY_PAGES`/`CS_PAGES` ([App.jsx:22-28](../../src/App.jsx#L22)) redirecionam no cliente; a RLS é quem protege. As policies de negócio estão **consistentes e corretas** para `sales/expenses/inventory/purchase_orders/contacts/etc` (todas `is_admin_or_manager() OR franchise_id = ANY(managed_franchise_ids())`) — **desde que `managed_franchise_ids` não seja auto-editável** (item 0). O elo fraco é `profiles`, não as tabelas de negócio.
- **`PurchaseOrders` não tem gate de papel no componente** (é `ADMIN_ONLY_PAGES` na rota, e a RLS de `purchase_orders_delete` é `is_admin()`), então o delete depende 100% da RLS — o que está certo. Mas o botão de exclusão em massa ([:561](../../src/pages/PurchaseOrders.jsx#L561)) faz `supabase.from().delete().in(...)` sem `.select('id')`, então uma falha de RLS viria como sucesso silencioso de 0 linhas. Baixo risco (só admin chega lá), mas some com a rede de segurança do `Entity.delete`.
- **Grants amplos a `anon`:** `catalog_products`, `franchises`, `profiles`, `sales`, `product_weights` têm `INSERT/UPDATE/DELETE` concedidos a `anon` no nível de tabela — a defesa é **só** a RLS (anon não tem `auth.uid()`, então os `CHECK is_admin_or_manager()` barram). Funciona hoje, mas é superfície desnecessária: `REVOKE` o que anon não precisa. **⚠️** não testei escrita anônima real (não tenho a anon key aqui), mas as policies indicam bloqueio.
- **Funil/ranking** (`get_franchise_ranking_monthly`, `get_franchise_funnel_stats`) são `SECURITY DEFINER` com `has_search_path=true` e filtro obrigatório por `p_franchise_id` embutido — ok. `save_sale_with_items`/`auto_populate_inventory`/`get_bot_leads_daily` são `SECURITY INVOKER` (rodam sob RLS do chamador) — ok.

---

## 8. Dependências — instalado e não usado / usado de jeito caro

- **`html2canvas` (197 KB bruto):** usado em **1 lugar** ([shareUtils.js:8](../../src/lib/shareUtils.js#L8)), dinâmico — ok, não entra no caminho crítico.
- **Plugin HTML do jsPDF é peso morto:** o chunk `index.es-*.js` (**155 KB**) é o plugin HTML/`canvg` do jsPDF, puxado só por importar `jspdf`. O código **nunca chama `doc.html(...)`** (grep 0) — só `autoTable`. Ou seja, ~155 KB de `canvg` viajam no chunk `export` sem uso. Investigar import seletivo (`jspdf/dist/jspdf.es.min.js` sem o plugin) para não arrastar o canvg. **⚠️ NÃO VERIFICADO** que dá para remover sem quebrar o build — precisa testar o import.
- **`export` chunk = 836 KB** (jspdf+autotable+xlsx+file-saver) — dinâmico, correto (só carrega no `ExportButtons`).
- **`@tanstack/react-query`:** instalado, `QueryClientProvider` envolve o app, mas **só 2 consumidores** (`useSubscriptionStatus`, `PageNotFound`). Todo o resto é `useState`+`useEffect`+`AbortController` na mão. Decisão honesta (a frente 01 aprofunda o custo): **ou** adota nas 5 telas de maior tráfego (cache entre navegações, o polling vira `refetchInterval`) **ou** remove a dep. Recomendo **adotar**, não remover — já está montado e resolve o "sair de Vendas e voltar refaz tudo"; remover joga fora infra que já custou.
- **Radix:** todos os 12 pacotes `@radix-ui/*` são usados (cada um em 1 componente `ui/`). `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react` (só dentro de `ui/`) — todos com uso real. **Nenhuma dep órfã** no `package.json` atual (a limpeza de 02/07 pegou as 26 mortas).
- `ui/` sobreviventes com **0 importadores** fora de `ui/`: nenhum crítico, mas `separator` (1), `switch` (1), `sidebar` (1), `tooltip` (2), `collapsible` (2), `tabs` (2) têm baixíssimo uso — candidatos a revisão na frente 06, não aqui.

---

## Resumo priorizado (impacto × alcance ÷ esforço)

| # | Achado | Quem | Esforço | Prioridade |
|---|---|---|---|---|
| 0 | RLS: franqueado escala a admin + lê a rede + auto-confirma marketing (`profiles`/`marketing_payments` UPDATE sem CHECK de coluna) | todos | M | **crítica** |
| 4 | Tela branca latente: guarda ESLint `no-undef` herdada (0 hoje, mas 0 proteção) — comando provado | franqueado | P | alta |
| 3 | Layout seta `[0]` para multi-unidade antes do usuário escolher (Dashboard/Marketing abrem unidade errada) | franqueado multi | P | alta |
| 6/2 | Matemática do dinheiro do `SaleForm` presa no JSX e sem teste → extrair `lib/saleCalc.js` + testar | franqueado | M | alta |
| 5 | `feeableMethods` hardcoded 3× + BRL/telefone/data duplicados → consolidar nas libs existentes | os dois | P-M | média |
