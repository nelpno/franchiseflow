# Excluir franquia + verificar o que você mesmo fez

> Texto original do CLAUDE.md do dashboard, sem edição — mudou de arquivo em 11/09/2026 para o CLAUDE.md caber no contexto. As regras de bolso continuam lá.

## Verificar o que voce mesmo acabou de fazer (09/09/2026)

🔴 **Nao confie no relatorio da propria funcao destrutiva — conte de FORA, no mesmo bloco.**
A `delete_franchise_cascade` devolvia um resumo com todas as tabelas zeradas e, na varredura
independente logo depois, `audit_logs` tinha **93 linhas** (o trigger `audit_on_sale_delete`
regrava enquanto a funcao roda). Padrao que pegou isso:
`do $$ ... perform a_funcao(); <varre tudo de novo>; raise exception '%', sobrou; $$` — a
excecao no fim desfaz o teste inteiro e o numero vem junto na mensagem.

**"Deploy nao confirmado" pode ser bug do VERIFICADOR — cheque o tamanho do que baixou.**
Meu regex tirava o ponto do nome do chunk (`Franchises-X.js` -> `Franchises-Xjs`), o fetch caia
no index e devolvia **146 bytes**; 25 rodadas seguidas disseram "falta a string" com o deploy ja
no ar. Chunk real tem dezenas de KB — tamanho de 3 digitos significa que voce baixou outra coisa.

## Excluir franquia — o que o botão faz, e o que ele NÃO faz (09/09/2026)

🔴 **`DROP TABLE` arma uma bomba em toda função plpgsql que a cita — e ela só explode em
runtime.** A onda 4 dropou `daily_checklists` (zero linhas na vida) e a
`delete_franchise_cascade` tinha um `DELETE FROM daily_checklists`: o deploy passou, o lint
passou, e **excluir franquia virou "Erro interno de configuração"** (42P01) por dois dias.
Antes de dropar qualquer tabela, varra o corpo das funções:
`select proname from pg_proc where prokind='f' and prosrc ilike '%nome_da_tabela%'`.
(Varredura feita em 09/09: nenhuma outra função referencia tabela inexistente.)

🔴 **O `evolution_instance_id` é derivado da CIDADE e é REUTILIZADO.**
`auto_generate_instance_id` monta `'franquia' || cidade sem acento` e só procura duplicata em
`franchises` — que estará vazia daquela cidade depois da exclusão. Então **resíduo não é
sujeira, é herança**: a unidade nova nasceria com a assinatura CANCELADA da anterior, os
cartões velhos no mural do CS e, no Storage, o **catálogo da franqueada antiga** (o bot
remonta `{evo}/catalogo.jpg` por path fixo e mandaria a foto errada ao cliente final).

**Como a exclusão funciona hoje** ([2026-09-09-delete-franchise-cascade-v2.sql](../../supabase/2026-09-09-delete-franchise-cascade-v2.sql)):
- A RPC **descobre as tabelas em tempo de execução** (toda `franchise_id` text no schema
  public, menos `_backup_*`) em vez de listar à mão. Tabela nova entra sozinha; tabela dropada
  some da lista. A lista fixa deixava para trás `system_subscriptions`, `cs_tasks`,
  `cs_worklist`, `cs_worklist_events`, `cs_agreements`, `coach_actions` e `bot_reports` —
  nenhuma tem FK para `franchises`, então ficavam para sempre, caladas.
- ⚠️ **`sale_items` e `purchase_order_items` saem ANTES do laço**, pelos ids do pai: as duas
  referenciam `inventory_items` com ON DELETE NO ACTION e o laço apaga em ordem alfabética.
- ⚠️ **Segunda passada obrigatória**: `audit_logs` é limpa no começo (ordem alfabética) e
  **volta a encher no meio do laço**, porque `audit_on_sale_delete` grava um registro por venda
  apagada — sobravam 93 linhas. No fim há uma **conferência**: se restar uma linha, a função
  levanta exceção e o Postgres desfaz tudo. Ou sai inteira, ou não sai.
- **`p_dry_run` é o preflight**, e existe por um motivo concreto: o front cancela o ASAAS
  ANTES de chamar o banco, então cascade quebrado deixa a franquia **viva e sem cobrança** (foi
  o estado da Cataguases em 09/09). O diálogo roda o dry-run ao abrir, mostra quantos registros
  somem e **quais contas de acesso serão apagadas**, e só libera o botão se passar.
- **Storage é do front** (`limparStorageDaFranquia` em [franchiseTeardown.js](../../src/lib/franchiseTeardown.js)):
  `{evo}/` nos 3 buckets, admin tem policy de DELETE nos três. Falha não desfaz a exclusão — avisa.
- 🔴 **A instância do WhatsApp NÃO é apagada pelo app** (exige o admin token do Zuck, que não
  vai para o browser): `node supabase/scripts/limpar-instancia-zuck.mjs <evo_id> --apply`, que
  recusa instância conectada e franquia que ainda exista no banco. **Rodar ANTES de criar a
  unidade nova na mesma cidade**, senão ela herda a instância com o número do dono anterior.
- **Fora do sistema, e a conta do Nelson faz à mão** (lembrado por ele em 09/09): **Instagram
  e Facebook da unidade**. Não há nada no dashboard sobre isso — entra no checklist do
  desligamento junto com a instância do Zuck.
- **O cliente ASAAS (`asaas_customer_id`) fica de propósito** — é por CPF/CNPJ e o mesmo dono
  costuma ter outras unidades. Quem se cancela é a ASSINATURA.

**Classe Tailwind com token inexistente não pinta e não reprova em lint nenhum**: escrevi
`text-ink-1` em 3 lugares e o tema tem `ink`, `ink-2`, `ink-3`, `ink-4` — sem `ink-1`. Build
verde, lint verde, texto sem cor. Conferir o token em `tailwind.config.js` ao usar um novo.
