# Prompt para a sessão 5 (Onda 5 da auditoria)

Cole o bloco abaixo como primeira mensagem da próxima sessão, dentro de `apps/dashboard`.

---

Continuar a auditoria do FranchiseFlow: **executar a Onda 5**.

Leia primeiro, nesta ordem:

1. `docs/auditoria-2026-09/ESTADO-2026-09-07-ONDA4.md` — o que as ondas 0 a 4 fizeram, com o
   número que provou cada uma, os três diagnósticos do relatório que a medição **derrubou** e
   as seis armadilhas de ferramenta. **Comece por ele.**
2. `CLAUDE.md` do dashboard, seções "Auditoria 07/09/2026" e "Onda 4 da auditoria" — os fatos
   medidos que evitam re-medição (RLS, subset de ícone, tokens de cor, paginação, sino, cache
   de franquias, o que foi apagado e o que **não** foi).
3. `docs/auditoria-2026-09/RELATORIO-CONSOLIDADO.md` e, ao mexer numa frente, o relatório dela
   (`01-performance.md` … `06-pontos-cegos.md`).

## O que já está pronto (não refazer, não re-medir)

Ondas 0 a 4, tudo em produção: nginx com gzip e cache · `manualChunks` como função · guarda
`lint:undef` · RLS com `(select fn())` nas 91 policies (2.324 → 91,5 ms) · trava de
escalonamento de privilégio · cron `aggregate_daily_data` consertado · sentinela diária ·
home do franqueado dizendo a verdade sobre robô e pedido · frete em chips · Mensalidades com
chips e vencimento · Δ vs mês anterior no Financeiro · dono e telefone no Mural do CS ·
subset self-hosted da icon-font (1,10 MB a menos por boot) · atribuição de marketing por
unidade · filtro `franchise_id` explícito em Vendas e Gestão · alvos de toque e piso de 12 px ·
`lib/saleCalc.js` com 23 testes · tokens de cor · sino único · paginação que cresce (42 → 21
requisições no Resultado) · limpeza de código e índices mortos · `EmptyState`/`ErrorState` ·
aba Fechamento · cache de franquias.

## O que fazer, nesta ordem

**1. Endereço na venda de entrega — é o item de maior impacto que sobrou.**
Medido em 07/09/2026: **4.362 de 6.539 entregas dos últimos 90 dias (66,7%) não têm endereço
em lugar nenhum** — nem em `sales.customer_address`, nem em `contacts.endereco`. O cupom do
motoboy sai sem endereço e ele liga para a franqueada. As colunas `sales.customer_address` e
`customer_neighborhood` **existem e o `SaleReceipt` já as lê**; quem escreve é só o robô
(2.001 das 6.539). O `SaleForm` não captura endereço em entrega. Corrigir onde nasce: campo de
endereço no `SaleForm` quando `delivery_method = 'delivery'`, pré-preenchido pelo contato
quando houver, gravando na venda **e** no contato.

**2. Contraste do verde de texto.** `#16a34a` dá 3,30:1 e reprova AA. O token `ok.ink`
(`#15803d`, 5,02:1) **já existe** no `tailwind.config.js` e não foi aplicado. É trocar
`text-ok` por `text-ok-ink` onde o verde é TEXTO (não fundo, não ícone decorativo) e medir o
contraste antes e depois.

**3. Números que mentem no card do franqueado.** "+100%" quando ontem foi zero (segunda contra
domingo fechado) aparece em todo card de comparação. O `CLAUDE.md` documenta o comportamento
CONTRÁRIO ao do código — conferir os dois e corrigir o que estiver errado, código ou doc.

**4. Erros silenciosos na venda.** "Venda registrada!" com o cliente perdido no caminho;
**38 vendas a R$ 0 e 67 com linha a R$ 0** em 90 dias passam sem aviso (frente 04). Re-medir
antes: parte disso pode ter mudado com o `saleCalc`.

**5. Reconcile do CS por cron.** `reconcile_cs_auto_tasks()` só roda quando alguém abre a
página. Os jobs do `pg_cron` hoje são 5 (jobid 1 a 5) e nenhum é esse. 🔴 **Não dar
`CREATE OR REPLACE` na função** — só agendar a chamada da versão que já está em produção.

**6. Alertas leves abertos no topo do Painel Geral.** "Sem vendas" e "robô parado" usam dado
que já está em memória, mas estão colapsados no fim, e expandir custa 31 mil contatos.

**7. Lote da semana em Pedidos.** `purchase_orders.total_weight_kg` é gravado e ignorado;
`getProductWeightMap` já está importado e só serve à ficha. Card "Lote pendente: N pedidos ·
R$ X · Y kg (≈ Z rota de 1.500 kg)" + coluna kg. Casa com a skill `maxi-logistica-rotas`.

**8. Defaults de `ui/` — este é o item de design, e é o único que quero decidir olhando.**
Ver a seção "Como tratar o item 8" abaixo.

**9. Dado em tela de operação ≥ 14 px.** O piso de 12 px já foi aplicado; subir valor e
quantidade para 14 px mexe na densidade das tabelas — precisa de screenshot em 430 px antes e
depois, tela por tela.

**10. Migrar `lib/franchisesCache.js` para react-query.** Agora que existe um ponto de entrada
só, a migração é mecânica. O provider já está montado no `App.jsx`.

**11. `productWeight.test.mjs` tem ZERO asserts** e 3 dos 5 arquivos de teste não usam
`test()` — a cobertura no papel é maior que a real. Ou escrever os asserts, ou apagar o
arquivo; teste que não afirma nada é pior que nenhum.

## Como tratar o item 8 (defaults de `ui/`)

Ele ficou de fora da Onda 4 de propósito: mudar o default de `Button`, `Badge` e `Card` altera
a aparência de TODA tela de uma vez, e a verificação possível por screenshot cobre meia dúzia
de telas, não as ~30 afetadas. É decisão visual, não medição.

O caminho combinado:

1. Tirar screenshots das telas reais em 430 px e em 1440 px (há um conjunto de 07/09 em
   `.tmp/audit-2026-09/telas/`, mas **tire novos**: o app mudou desde então).
2. Rodar `/design` com essas telas como referência e montar um canvas com as variantes de
   `Card`, `Button` e `Badge` lado a lado — o default de hoje contra o proposto, no contexto
   de uma tela de verdade (lista de vendas, card de estoque, tabela do Fechamento).
3. **Só depois de eu aprovar no canvas**, implementar: primeiro os defaults em `ui/`, depois
   trocar os 62 cards feitos à mão por `<Card>` e os 8 `<button>` vermelhos por `<Button>`.
4. Cada troca ADICIONA um import — rodar a varredura de símbolo não-importado
   (`npm run lint:undef`) antes do build, que é justamente o caso de tela branca deste repo.

Números que já estão medidos e não precisam ser refeitos: `<Card>` tem a borda sobrescrita em
**44 de 58 usos**, o que produziu **62 cards à mão contra 58 `<Card>`**; 26 badges à mão, 15
deles `rounded-full` e 16 abaixo de 12 px.

## Regras desta rodada

- **Meça antes e depois.** `EXPLAIN ANALYZE`, `pg_stat_statements`, bytes na rede, contagem de
  requisições no browser, contagem de linhas. **Se não mediu, diga que não mediu.** E se a
  medição derrubar o diagnóstico do relatório, siga a medição e escreva isso — aconteceu três
  vezes na Onda 4.
- **Antes de cada deploy**: `npm run lint`, `npm run lint:undef`, `npm run icons:check`,
  `npm run test:unit`, `npm run build`. A guarda de ícone reprovou duas vezes na Onda 4.
- **Verifique o deploy por CONTEÚDO no live**, não por hash. Script pronto:
  `.tmp/audit-2026-09/verify-final.mjs` (troque a lista de provas).
- **Não toque em `get_franchise_health_signals` nem em `reconcile_cs_auto_tasks`** — as versões
  de produção não estão versionadas e um `CREATE OR REPLACE` regride o radar do CS.
- **Não apague as 6 RPCs "sem consumidor"** do relatório sem antes varrer os workflows do n8n:
  "sem consumidor" ali significa sem consumidor no DASHBOARD.
- Toda migration versionada em `supabase/AAAA-MM-DD-*.sql`, com o porquê e o rollback escritos.
- Mudança de policy de RLS: **prove nos dois sentidos**, com transação abortada de propósito.
- Commits em português, explicando **por quê**, com o número medido. Um commit por frente.

## Como testar tela de franqueado (isso destrava quase tudo)

As telas `franchiseeOnly` (Início, Vendas, Gestão, Meus Clientes) não abrem para admin. O que
funcionou na Onda 4, e está autorizado repetir:

1. Criar um usuário de teste pela Auth Admin API e escrever `profiles` com `role='franchisee'`
   e `managed_franchise_ids` de uma unidade real — script em `.tmp/audit-2026-09/qa-user.mjs`
   (`criar` / `apagar`).
2. Para ver tela de admin, promover o mesmo usuário e reverter depois — o trigger
   `guard_profile_privilege_columns` deixa passar quando `auth.uid()` é nulo (service_role).
   **Reload completo obrigatório** depois de trocar o papel: a navegação SPA fica com o perfil
   antigo em memória.
3. **Apagar o usuário no fim da sessão** e conferir que sumiu.

## Armadilhas (as três novas custaram tempo na Onda 4)

1. 🔴 **A Management API do Supabase devolve o último resultset NÃO-VAZIO**, não o do último
   statement. Com `set local role` + `set_config` + a consulta, se a consulta voltar vazia você
   recebe a linha do `set_config` e acha que veio dado. Fechar em
   `select coalesce(json_agg(t),'[]'::json) from (…) t`.
2. 🔴 **Heredoc de shell come a barra invertida.** `"\\b"` escrito num `cat <<'EOF'` chega ao
   arquivo como `"\b"`, que em JS é BACKSPACE — a regex nunca casa, silenciosamente. Usar
   lookahead sem escape, ou gerar o arquivo por Python/Write.
3. **Chunk certo na verificação por conteúdo**: `TabResultado` tem chunk próprio
   (`TabResultado-*.js`), não vive no de `Gestao`. Componente compartilhado sempre ganha chunk
   próprio.
4. **`git push` puro trava** (GCM headless no Windows). Usar o push por URL com token — e
   lembrar que ele **não atualiza `origin/main`**: provar com `git ls-remote origin main`.
5. **Regra de alarme nasce errada com facilidade.** Rodar dentro de um `DO` que termina em
   `raise exception` para ver o resultado sem gravar notificação.
6. **Clarity: 10 requisições por dia.** O resumo agregado está em `00b-CLARITY-3DIAS.md`.

## Em aberto que NÃO é seu

A assinatura da **Uberaba**: ativa, com CPF, sem nenhuma assinatura criada. O Nelson vai criar.
A sentinela aponta todo dia até lá, e está certo.

---

Ao terminar cada item, me diga em uma linha o que mudou e o número que provou. No fim,
atualize o `ESTADO-*.md` do dia e o `CLAUDE.md`.
