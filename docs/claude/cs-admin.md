# CS e admin: Mural, Unidades, Ficha, excluir franquia

> Shard do CLAUDE.md do dashboard (movido VERBATIM em 29/09/2026 para enxugar o que carrega em toda sessão). O CLAUDE.md aponta para cá por sintoma.

### Mural do CS v2 (26/09/2026, `51e7e5a`) → detalhe em [docs/claude/customer-success.md](docs/claude/customer-success.md)
- Colunas (falar_hoje/esperando/com_nelson/estacionado/resolvidos) vêm PRONTAS de `get_cs_mural()`. Registro só por `registrar_cs_conversa`/`concluir_cs_cartao`/`estacionar_cs_cartao`; nunca `addCsTaskEvent` com nota nula.
- Acordo (`cs_agreements`) nunca cala alarme; só segura o CARTÃO se tiver `review_at` futuro.
- Reconcile fecha sozinho só após 3 dias fora da regra, sem cooldown. "caiu" do dia 1 ao 9 usa 28 dias × 28 dias anteriores (o mês até hoje sem base fechava cartão todo dia 1º).
- Simular data no reconcile: `set_config('cs.sim_agora', …, true)` na transação (`cs_hoje()`/`cs_agora()`). Venda futura não serve: `tr_sales_data_futura` barra até em rollback.
- `/ProgressoCS` é só admin (`OwnerRoute` no App.jsx; as RPCs exigem `is_admin`).
- Comparar DIA com dia: mesmo dia da semana 4 semanas antes (dia − 28), nunca o mesmo número do mês anterior (sábado contra quarta dava "+R$ 10 mil" falso). Total do mês continua contra o mesmo trecho do mês anterior (`get_faturamento_por_dia`, `4b14fa5`).
- Nota fiscal pré-pronta no branch `wip/nfe-cadastro`: rebase no main e aplicar `fiscal-01` ANTES do deploy (o front manda colunas novas → 400).

### Health Score — REMOVIDO 03/07/2026
- O health score e a página **Acompanhamento** foram **REMOVIDOS** (Nelson: não usava mais; o **Mural do Customer Success** substituiu). Apagados: `pages/Acompanhamento.jsx`, `lib/healthScore.js`, `components/acompanhamento/` inteiro (`FranchiseHealthDetail`, `HealthScoreBar`, `FranchiseNotes`, `InventorySheet`). **NÃO recriar.** A `AlertsPanel` (Painel Geral) agora leva ao **Customer Success**, não ao Acompanhamento. Deploy `1b3eff1`.
### Customer Success Cockpit / Mural (papel `customer_success`)
> 📄 Detalhe (tiers, `cs_tasks`, reconcile, sinais do radar, calibração, pinos de não-regressão): [docs/claude/customer-success.md](docs/claude/customer-success.md). Movido do arquivo em 11/09/2026.
- Página `CustomerSuccess.jsx` (board Kanban + aba Radar); acesso via `CsRoute`/`CS_PAGES`; helper `is_cs_or_admin()` — NÃO incluir CS em `is_admin_or_manager()`.
- 🔴 **Rodar RPC com guard pelo MCP:** `with ctx as materialized (select set_config('request.jwt.claims', json_build_object('sub','<uuid admin>')::text, true)), h as materialized (select s.* from ctx, lateral <rpc>() s)` — os DOIS `materialized` são obrigatórios, senão volta 0 linhas calado.
- Antes de `CREATE OR REPLACE` em função do cockpit, provar paridade arquivo × produção (`_verifica-paridade-live.mjs`); o fonte vivo do radar é `supabase/cs-cockpit/10-*.sql`. Cartão MANUAL nunca é reescrito pelo reconcile.

## Excluir franquia e verificar o que você mesmo fez (09/09/2026)
> 📄 Como a exclusão funciona, o que ela NÃO faz e o checklist manual: [docs/claude/excluir-franquia.md](docs/claude/excluir-franquia.md). Movido do arquivo em 11/09/2026.
- 🔴 **`DROP TABLE` arma bomba em toda função plpgsql que cita a tabela** (só explode em runtime) — antes: `select proname from pg_proc where prokind='f' and prosrc ilike '%tabela%'`.
- 🔴 **`evolution_instance_id` deriva da cidade e é REUTILIZADO** — resíduo vira herança da unidade nova. `delete_franchise_cascade` (com `p_dry_run`) apaga tudo ou nada; a instância do Zuck sai só por `node supabase/scripts/limpar-instancia-zuck.mjs <evo> --apply` (ANTES de recriar na mesma cidade); Instagram/Facebook da unidade é à mão.
- **Não confie no relatório da própria função destrutiva** — conte de fora no mesmo bloco (`do $$ … raise exception $$` desfaz o teste e traz o número).
- **Classe Tailwind com token inexistente** (`text-ink-1`) não pinta e passa em todo lint — conferir o token no `tailwind.config.js`.

### Redesenho do admin — Onda 1 (no ar 26/09/2026, `645c8c7`)
> Plano e próximos passos: `~/.claude/plans/admin-redesign-2026-09-26.md` · padrão visual: [docs/claude/padrao-visual-admin.md](docs/claude/padrao-visual-admin.md) (componentes em `src/components/shared/`).
- 🔴 **Régua única em `src/lib/networkOverview.js`**: queda (−20% com base de R$ 3 mil), sem venda, verba (mês principal = CALENDÁRIO; mês-alvo aparece neutro, nunca vermelho), nova (<30 dias desde 29/09; era 60), `sinaisUnidade`, `linkFicha`/`voltarDaFicha`, `ordenarPor`. Nenhuma tela repete limite à mão. Mensagem para franqueada: só `src/lib/mensagemFranqueado.js`. Formatos: `src/lib/adminFormat.js` + `formatPct`.
- Ficha = `/Unidade?id=<evo>` (em `CS_PAGES`). Link para ela leva `state {from,label}`; telas abertas pela Ficha mostram "← Voltar para a ficha". Overview compartilhada via `useAdminNetworkOverview` (queryKey `['admin-overview']`); mutação chama `invalidarAdmin(queryClient)`.
- `franchises.created_at` = data da MIGRAÇÃO (39 unidades em mar/2026), não da abertura: só mostrar idade quando < 60 dias.
- 🔴 `get_franchise_health_signals` CALA unidades: acordo `cs_agreements` com `signal_key='*'` e sem baseline apaga todos os alertas para sempre (Uberlândia); `stopped_selling` exige `revprev>0` (parada 60+ dias vira healthy). Listas e Ficha já não dependem disso; o Mural sim (conserto na Onda 2).
- `purchase_orders.confirmed_at` existe (backfill por `updated_at`); o trigger `on_purchase_order_delivered` respeita o `delivered_at` que o front manda.
- Aplicar SQL: `node supabase/cs-cockpit/_aplica-lf.mjs <arquivo.sql>` (normaliza LF). Mudou o `RETURNS TABLE`? O arquivo precisa de `drop function if exists` antes (senão 42P13).
- Prévias com mocks (`.tmp/harness-*`): mock VELHO gera print que mente (depósito R$ 0, "2 pedidos") — recarregar dados por SELECT via MCP antes de mostrar. Harness com `root` fora do repo perde o Tailwind (fix: `.tmp/harness-shared/postcss-root/`); vários vite ao mesmo tempo dão "Invalid hook call" (cache compartilhado) → `--force`.
- Subagente não cria usuário admin temporário em produção (contorna o guard de privilégio e é recusado): prints com dados reais = harness + snapshot por MCP.
- `eslint .` pega `.tmp/harness-*/.vite-cache` e qualquer `.js` solto em `.tmp/` (ex.: cópia de Code node do n8n) → apagar o cache e salvar essas cópias como `.txt`. `icons:check` acusa palavra entre crases em comentário que é nome de ícone (`files`, `orders`, `tooltip`) → reescrever o comentário.
