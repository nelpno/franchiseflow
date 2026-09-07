# Prompt para a sessão 4 (Onda 4 da auditoria)

Cole o bloco abaixo como primeira mensagem da próxima sessão, dentro de
`apps/dashboard`.

---

Continuar a auditoria do FranchiseFlow: **executar a Onda 4**, a estrutural.

Leia primeiro, nesta ordem:
1. `docs/auditoria-2026-09/ESTADO-2026-09-07.md` — o que já foi feito nas ondas 0 a 3, o que
   ficou em aberto e as 6 armadilhas da seção final. **Comece por ele.**
2. `CLAUDE.md` do dashboard, seção "Auditoria 07/09/2026" — os fatos medidos que evitam
   re-medição (61/67 com regra de frete, 57/67 sem onboarding, 67/67 sem `phone_number`,
   938 mil linhas no CTE, etc).
3. `docs/auditoria-2026-09/RELATORIO-CONSOLIDADO.md` e, quando for mexer numa frente
   específica, o relatório dela (`01-performance.md` … `06-pontos-cegos.md`).

Faça os itens da tabela "Onda 4" do `ESTADO-2026-09-07.md` **na ordem em que estão**, que já é
por (impacto × alcance) ÷ esforço. Os quatro primeiros valem mais que todo o resto junto:

1. `(select fn())` nas ~100 policies restantes — os helpers de RLS rodam uma vez por linha hoje.
2. Subset da icon-font — são 1,1 MB baixados em todo boot para 141 ícones usados.
3. Atribuição de marketing por unidade — 33% da receita já está no banco e nenhuma tela lê.
4. Filtro `franchise_id` explícito em Vendas e Gestão.

Regras desta rodada:

- **Meça antes e depois.** Nada de "deve melhorar": `EXPLAIN ANALYZE`, `pg_stat_statements`,
  bytes na rede, contagem de linhas. Se não mediu, diga que não mediu.
- **Antes de cada deploy**: `npm run lint`, `npm run lint:undef`, `npm run test:unit`,
  `npm run build`. A guarda `lint:undef` já pegou um erro real na sessão anterior.
- **Verifique o deploy por CONTEÚDO no live**, não por hash — o build da VPS às vezes difere do
  local. Há script pronto em `.tmp/audit-2026-09/verify-onda1.mjs`.
- **Não toque em `get_franchise_health_signals` nem em `reconcile_cs_auto_tasks`** — as versões de
  produção não estão versionadas e um `CREATE OR REPLACE` regride o radar do CS.
- Toda migration vai versionada em `supabase/AAAA-MM-DD-*.sql`, com o porquê e o rollback escritos.
- Mudança de policy de RLS: **prove nos dois sentidos** (quem deve ver continua vendo, quem não
  deve continua sem ver), com transação abortada de propósito.
- Commits em português, explicando **por que**, com o número medido. Um commit por frente.

Ao terminar cada item, me diga em uma linha o que mudou e o número que provou. No fim, atualize
o `ESTADO-2026-09-07.md` (ou crie o do dia) e o `CLAUDE.md`.

Item em aberto que **não** é seu: a assinatura da Uberaba — o Nelson vai criar. A sentinela vai
apontar todo dia até lá, e está certo.

---

## Se quiser rodar as frentes em paralelo com Fable 5.1 outra vez

A rodada de diagnóstico usou 6 agentes em paralelo, cada um com o pacote de contexto
(`00-CONTEXTO.md` + `00b-CLARITY-3DIAS.md`) e uma missão que não se sobrepunha às outras. Os
prompts estão em `PROMPTS.md`.

**Para EXECUÇÃO isso não vale**: os itens da Onda 4 tocam os mesmos arquivos (tokens de cor mexem
em ~30 arquivos que a frente de tap targets também mexe), e agentes paralelos editando o mesmo
repositório conflitam. Faça sequencial, ou paralelize só o que é comprovadamente disjunto —
por exemplo, migrations de RLS (só banco) enquanto alguém mexe em CSS (só front).
