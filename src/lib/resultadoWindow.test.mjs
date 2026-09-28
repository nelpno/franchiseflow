// Testes puros (node:assert, sem framework) — S8.2: a janela de busca do TabResultado (13
// meses pra trás do mês em tela) tem de dar o MESMO total que buscar o histórico inteiro
// (comportamento de antes), pra qualquer mês que a franqueada esteja olhando. Comparação por
// SOMA (não por amostragem): sale a sale, com fixture sintética de 3 anos.
// Rodar: node src/lib/resultadoWindow.test.mjs
import assert from "node:assert";
import { subMonths, addMonths, format, startOfMonth } from "date-fns";
import { janelaResultado, janelaCobre, janelaParaBuscar, JANELA_MESES } from "./resultadoWindow.js";
import { isInMonth } from "./financialCalcs.js";

// ── fixture: 1 venda por mês, 3 anos inteiros (2024-01 até 2026-09), valor = índice do mês ──
const PRIMEIRO_MES = new Date(2024, 0, 1); // jan/2024
const N_MESES = 33; // jan/2024 .. set/2026
const historicoCompleto = Array.from({ length: N_MESES }, (_, i) => {
  const d = addMonths(PRIMEIRO_MES, i);
  return { id: `s${i}`, sale_date: format(d, "yyyy-MM-15"), value: i + 1 };
});

function somaDoMes(sales, targetMonth) {
  return sales
    .filter((s) => isInMonth(s.sale_date, targetMonth))
    .reduce((acc, s) => acc + s.value, 0);
}

// "Como buscava antes" (fetchAll sem data: o client tinha TUDO) vs "como busca agora"
// (só o que cai dentro da janela). Pro mês em tela em si, as duas somas têm de bater sempre —
// é exatamente o requisito de não perder dinheiro na conta.
function testaMes(targetMonth, label) {
  const { start, end } = janelaResultado(targetMonth);
  const janela = historicoCompleto.filter((s) => s.sale_date >= start && s.sale_date <= end);

  const totalAntes = somaDoMes(historicoCompleto, targetMonth);
  const totalDepois = somaDoMes(janela, targetMonth);
  assert.equal(totalDepois, totalAntes, `${label}: soma do mês em tela divergiu (janela perdeu venda)`);

  // evolucaoData: soma dos 6 meses até o mês em tela (barras do gráfico de evolução).
  let evolucaoAntes = 0;
  let evolucaoDepois = 0;
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(targetMonth, i);
    evolucaoAntes += somaDoMes(historicoCompleto, d);
    evolucaoDepois += somaDoMes(janela, d);
  }
  assert.equal(evolucaoDepois, evolucaoAntes, `${label}: soma da evolução (6 meses) divergiu`);

  // anoResumo: janeiro até o mês em tela, no MESMO ano (o caso mais apertado é dezembro —
  // 11 meses pra trás, dentro da folga de 13).
  const ano = targetMonth.getFullYear();
  let anoAntes = 0;
  let anoDepois = 0;
  for (let m = 0; m <= targetMonth.getMonth(); m++) {
    const d = new Date(ano, m, 1);
    anoAntes += somaDoMes(historicoCompleto, d);
    anoDepois += somaDoMes(janela, d);
  }
  assert.equal(anoDepois, anoAntes, `${label}: soma do acumulado do ano divergiu`);
}

// Mês recente do fim da fixture, mês do meio, janeiro (ano mínimo) e dezembro (pior caso:
// anoResumo pede 11 meses pra trás dentro do mesmo ano).
testaMes(new Date(2026, 8, 1), "set/2026 (mês mais recente)");
testaMes(new Date(2025, 5, 1), "jun/2025 (meio do histórico)");
testaMes(new Date(2025, 0, 1), "jan/2025 (início do ano)");
testaMes(new Date(2025, 11, 1), "dez/2025 (pior caso do acumulado do ano)");

// A janela nunca é maior que o necessário: cobre exatamente [mesSelecionado - JANELA_MESES,
// fim do mesSelecionado], nunca o histórico inteiro (é o ganho de performance do S8.2).
{
  const alvo = new Date(2026, 8, 1);
  const { start, end } = janelaResultado(alvo);
  assert.equal(start, format(startOfMonth(subMonths(alvo, JANELA_MESES)), "yyyy-MM-dd"));
  assert.equal(end, "2026-09-30");
  assert.ok(start > "2024-01-01", "janela não deveria voltar até o início da fixture inteira");
}

// janelaCobre / janelaParaBuscar: a janela é de largura FIXA — andar 1 mês (pra qualquer lado)
// desloca as duas pontas, então uma janela "só o necessário" NUNCA cobre o mês vizinho (senão
// toda navegação de mês recarregaria, pior que o "nunca mais busca" de antes). Por isso a busca
// é pela UNIÃO com o que já tem: depois de 1 passo pra trás, o carregado cresceu e passa a
// cobrir os vizinhos dos dois lados sem nova busca.
{
  const alvo = new Date(2026, 8, 1); // set/2026
  const carregado1 = janelaResultado(alvo); // 1ª busca: exatamente o necessário
  assert.ok(janelaCobre(carregado1, alvo), "o próprio mês que gerou a janela tem que estar coberto");
  assert.ok(!janelaCobre(carregado1, subMonths(alvo, 1)), "janela 'só o necessário' NÃO cobre o mês vizinho");

  // navega 1 mês pra trás (ago/2026): não estava coberto, busca a UNIÃO (cresce pra trás)
  const alvo2 = subMonths(alvo, 1);
  const carregado2 = janelaParaBuscar(carregado1, alvo2);
  assert.ok(janelaCobre(carregado2, alvo2), "depois de buscar, o mês pedido está coberto");
  assert.ok(janelaCobre(carregado2, alvo), "a união não perdeu a cobertura do mês anterior");
  // agora sim: os dois meses (e o que está entre eles) navegam sem nova busca
  assert.ok(janelaCobre(carregado2, subMonths(alvo, 1)));

  // sair de vez da faixa já explorada (muito mais pra trás) ainda pede busca nova
  assert.ok(!janelaCobre(carregado2, subMonths(alvo, JANELA_MESES + 5)), "bem longe da faixa explorada pede nova busca");
  assert.ok(!janelaCobre(null, alvo), "sem janela carregada, sempre busca");
}

console.log("resultadoWindow: ok (janela de 13 meses não perde soma nenhuma, testado com fixture de 3 anos)");
