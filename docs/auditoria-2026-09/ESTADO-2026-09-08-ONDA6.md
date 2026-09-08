# Onda 6 — 08/09/2026: números que mentiam sem estar errados

Não estava no plano da sessão. Veio de duas perguntas do Nelson olhando as telas: *"faz um falso
dado comparando faturamento com mês ainda em aberto"* (Mural do CS) e *"esse comparativo vs mês
anterior também, ver se não está comparando errado"* (Financeiro).

**As duas hipóteses dele estavam erradas na letra e certas no espírito.** Nenhuma das duas telas
compara mês parcial com mês fechado. Mas as duas mostram números que comunicam algo falso, por
motivos diferentes — e a medição achou os três.

Commits: `9f36e2a` (limiar relativo do Radar) · `56ccdb4` (piso do KPI de margem) · `f92fbf0`
(as 3 vendas de Vila Maria).

---

## O que foi medido, e o que caiu

| Hipótese | Veredito | O número |
|---|---|---|
| "O Radar compara mês aberto com mês fechado" | **Falsa** | Usa janela móvel de 30d contra os 30 anteriores. Ambas com 30 dias. |
| "A queda de faturamento é artefato de janela" | **Falsa** | 31 caem e **15 sobem**; a rede somada caiu 4,3% (R$ 342.822 × R$ 358.204). A queda é real. |
| "A verba do mês é cobrada cedo demais" | **Falsa** | **72% das verbas são pagas até o dia 8**; só 6 unidades com o sinal hoje. |
| "O comparativo do Financeiro compara errado" | **Falsa** | O corte no mesmo dia está aplicado (onda 4). Prova barata: 6 sobem e 3 caem no print — se comparasse 7 dias contra 31, tudo estaria vermelho. |
| **O limiar do Radar está colado na mediana** | **Verdadeira** | Gatilho −10%, mediana da rede −10,3%. **82% da rede** marcada crítica ou atenção. |
| **Há vendas datadas no futuro** | **Verdadeira** | 3 vendas de Vila Maria em 30/09. Tela mostra ▼18%; o real é ▼30%. |
| **"Menor Margem" é denominador, não margem** | **Verdadeira** | −5657,8% = R$ 80 de venda contra R$ 4.606 de despesa. |

---

## 1. O limiar que fazia metade da rede piscar

O sinal `revenue_drop` disparava com gatilho **fixo em −10%**, e a mediana da rede no mesmo dia era
**−10,3%**. Por construção, a metade de baixo de qualquer distribuição cruzava o limiar.

- 23 das 46 unidades comparáveis com a bandeira
- **55 das 67 (82%)** marcadas 🔴 ou 🟡 — um radar em que 82% pisca não prioriza nada
- a função **já calculava** a mediana da rede e só a usava para eleger destaque

Agora o gatilho é `least(-10, mediana − 15)` e o `high` é `least(-30, mediana − 30)`. Num mês
normal (mediana ≈ 0) o `least` mantém o piso e o comportamento é **idêntico** ao de antes; num mês
em que a rede cai, só acende quem cai muito mais que os pares. E o rótulo carrega a referência:

> Faturamento −62.0% **(rede −10.3%)**

**Impacto medido:** flag 23 → 14 · severidade alta 11 → 7 · críticas **18 → 14** · saudáveis 11 → 15.
Vila Maria e Santos saíram das críticas — eram justamente as que só tinham queda de faturamento.

Não reusei o `net.med` que a função já tinha: aquele sai do CTE `growth`, que aceita `revprev>0`,
então unidade com faturamento anterior minúsculo entra e distorce (−4,4% contra os −10,3% da
mediana das comparáveis, que é o mesmo critério do próprio delta).

### O que isso destravou

O `CLAUDE.md` dizia que a `get_franchise_health_signals` de produção **não existia em `.sql`
nenhum** e que por isso ninguém podia mexer nela. Agora existe:
`supabase/cs-cockpit/10-health-signals-PRODUCAO-2026-09-08.sql` é o `pg_get_functiondef` da função
viva, byte a byte, paridade provada (md5 `6e61dfeb…`, 13.548 bytes). O `11-*.sql` sai dele com
**11 linhas de CTE novo e 1 linha trocada** — o diff inteiro.

**Pino de não-regressão** (versão antiga clonada como `_health_antes`, as duas comparadas na mesma
query, pelo **conjunto** de flags e não pela sequência do `jsonb_agg`):

```
unidades ................... 67 / 67
conjunto de flags mudou em . 9  — e nas 9 a ÚNICA diferença é revenue_drop ter saído
sinal NOVO em alguma ....... nenhum
tiers ...................... 18/37/11/1  ->  14/37/15/1
```

`giro_baixo`, `marketing_late`, `cs_agreements`, cooldown e `parked_until` intactos. Cópia dropada.

---

## 2. Vila Maria: ▼18% onde o real é ▼30%

Três vendas com `sale_date = 30/09/2026`, digitadas em **25/06, 07/08 e 19/08** — erro de mês.
São as únicas da rede inteira; o trigger `sales_bloqueia_data_futura` existe, funciona e usa data
BRT, mas foi criado depois delas.

| | valor | Δ vs mês ant. |
|---|---|---|
| tela (setembro com o futuro dentro) | R$ 8.450 | **▼18%** |
| real (1–7/set) | R$ 7.170 | **▼30%** |

Inflam setembro em R$ 1.279,80 e **escondem uma queda pior** — não inventam uma. Também ficam
presas no topo da lista de Vendas dela e para sempre como Pendentes (nenhuma foi confirmada).

**Nada foi alterado no banco:** a data certa é ela quem sabe (pode ter lançado dias depois de
fazer). Lista pronta para mandar + SQL com backup em
[vila-maria-3-vendas-data-errada.md](vila-maria-3-vendas-data-errada.md).

---

## 3. "Menor Margem −5657,8%" era denominador

O card de destaque aceitava qualquer unidade com `salesCount > 0`. Uma venda de R$ 80 bastava:

| unidade | recebido em set | despesa | margem |
|---|---|---|---|
| Vila dos Remédios | R$ 80 | R$ 4.606 (R$ 3.806 de compra) | **−5657,8%** |
| Cordeiro e Iracemápolis | R$ 30 | R$ 784 | −2513,7% |
| São José do Rio Preto | R$ 23 | R$ 200 | −769,6% |

Não é margem ruim — é unidade que **comprou e ainda não vendeu**, num mês de 7 dias. O DRE ser
caixa puro é decisão consciente; o problema é o percentual sobre denominador de R$ 23 estar no
topo da tela.

Agora só concorre quem faturou **R$ 2.000** no período — o mesmo piso que a
`get_franchise_health_signals` já usa para calcular delta, então há **um piso só no ecossistema**.
Com ele o card aponta **Santos (−106,8%)**, que é caso real: R$ 4.463 de venda contra R$ 9.274 de
custo. O subtítulo passa a mostrar o faturamento ao lado do percentual.

Com piso de R$ 1.000 o card ainda mostraria Imirim (−614,6%, R$ 1.053 recebidos) — ruído. R$ 2.000
foi escolhido por isso, não por gosto.

---

## Armadilhas novas

1. 🔴 **Aplicar `.sql` do Windows injeta `\r` DENTRO da função.** Medido: **246 CR** entraram no
   `prosrc` da `get_franchise_health_signals`, inchando-a em 246 bytes e quebrando a paridade dali
   em diante — o verificador normaliza o ARQUIVO, mas o banco já estava sujo. Funciona, e é por
   isso que passa despercebido. Usar `.tmp/audit-2026-09/q-lf.mjs`. Conferir com
   `length(prosrc) - length(replace(prosrc, chr(13), ''))`.
2. **O `_verifica-paridade-live.mjs` procura `$func$`; o `pg_get_functiondef` gera `$function$`.**
   Trocar os dois delimitadores não altera o corpo — o `prosrc` não os inclui.
3. **O console do Windows mente sobre acento.** `'Sem vender h� '` no `print` do Python parecia
   arquivo corrompido; os bytes eram `\xc3\xa1`, á em UTF-8 correto. É o cp1252. Ler os bytes
   (`open(...,'rb')`) antes de "consertar" encoding.
4. **`percentile_cont` devolve `double precision`** e `round(double precision, int)` não existe no
   Postgres — precisa de `::numeric`. O erro barra a migration inteira (produção fica intacta, o
   que é o bom comportamento).
5. **O heredoc comeu a barra invertida pela terceira vez na sessão**, agora num `verify-*.mjs` com
   regex. Qualquer arquivo com escape sai por `Write`, nunca por `cat <<'EOF'`.
6. **Minifier escreve `2000` como `2e3`** e renomeia a constante. Prova por conteúdo robusta: achar
   o identificador usado no filtro e provar que **ele** é declarado com o valor (`Xs=2e3`), em vez
   de procurar o literal.

---

## Em aberto

- **As 3 vendas de Vila Maria**, esperando a franqueada dizer a data certa.
- **O `reconcile_cs_auto_tasks` continua sem fonte versionado** — por isso o cron dele (onda 5) é
  um invólucro, não um replace. A mesma receita do `10-*.sql` resolveria, se algum dia precisar.
- **`giro_baixo` tem defasagem estrutural**: compara compra de 60d com venda de 60d, e **32,2% do
  que a rede comprou nesses 60 dias foi comprado nos últimos 21** — ou seja, ainda não teve tempo
  de virar venda. 11 unidades com a flag hoje. Não mexi: precisa decidir se a janela de compra
  deve ser defasada em relação à de venda.
