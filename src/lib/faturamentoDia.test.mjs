// node src/lib/faturamentoDia.test.mjs
import assert from "node:assert/strict";
import {
  diasNoMes, quatroSemanasAntes, tomDoDia, montarDias, escalaMax, rotuloDia, textoDiferenca,
  ariaFaixa, unidadesDoDia, tituloDetalhe, subtituloDetalhe, LEGENDA_LINHA,
} from "./faturamentoDia.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FALHOU: ${name}`);
    throw error;
  }
}

test("diasNoMes", () => {
  assert.equal(diasNoMes("2026-09"), 30);
  assert.equal(diasNoMes("2026-02"), 28);
  assert.equal(diasNoMes("2028-02"), 29);
  assert.equal(diasNoMes("2026-12"), 31);
  assert.equal(diasNoMes("lixo"), 0);
});

test("quatroSemanasAntes: mesmo dia da semana, dia − 28, todo dia tem par", () => {
  assert.equal(quatroSemanasAntes("2026-09-26"), "2026-08-29"); // sábado → sábado
  assert.equal(rotuloDia(quatroSemanasAntes("2026-09-26")).slice(0, 3), "Sáb");
  assert.equal(quatroSemanasAntes("2026-10-31"), "2026-10-03"); // 31 tem par
  assert.equal(quatroSemanasAntes("2026-03-29"), "2026-03-01"); // fevereiro curto não importa
  assert.equal(quatroSemanasAntes("2026-01-10"), "2025-12-13"); // vira o ano
  assert.equal(quatroSemanasAntes("2028-03-15"), "2028-02-16"); // bissexto
  assert.equal(quatroSemanasAntes(""), null);
});

test("tomDoDia: igual conta como acima; sem dado vale 0", () => {
  assert.equal(tomDoDia({ rev: 100, ant: 100 }), "acima");
  assert.equal(tomDoDia({ rev: 101, ant: 100 }), "acima");
  assert.equal(tomDoDia({ rev: 99, ant: 100 }), "abaixo");
  assert.equal(tomDoDia({ rev: 0, ant: 0 }), "acima");
  assert.equal(tomDoDia({ rev: 50, ant: null }), "acima");
  assert.equal(tomDoDia({ rev: null, ant: null, futuro: true }), "futuro");
});

test("montarDias: mês inteiro, futuro depois de hoje, dia ausente vale 0", () => {
  const dados = {
    hoje: "2026-09-03",
    mes: "2026-09",
    dias: [
      { dia: "2026-09-01", rev: 1000, rev_4_semanas: 800 },
      { dia: "2026-09-02", rev: "300.50", rev_4_semanas: "400" },
      // dia 3 não veio
    ],
  };
  const d = montarDias(dados);
  assert.equal(d.length, 30);
  assert.deepEqual(d[0], { dia: "2026-09-01", n: 1, rev: 1000, ant: 800, futuro: false, hoje: false, tom: "acima", diff: 200 });
  assert.equal(d[1].tom, "abaixo");
  assert.equal(d[1].diff, -99.5);
  assert.equal(d[2].rev, 0);
  assert.equal(d[2].ant, 0);
  assert.equal(d[2].hoje, true);
  assert.equal(d[3].futuro, true);
  assert.equal(d[3].tom, "futuro");
  assert.equal(d[3].rev, null);
  assert.equal(d[29].dia, "2026-09-30");
});

test("montarDias: dia 31 compara como qualquer outro (4 semanas antes)", () => {
  const d = montarDias({
    hoje: "2026-10-31",
    mes: "2026-10",
    dias: [
      { dia: "2026-10-30", rev: 500, rev_4_semanas: 700 },
      { dia: "2026-10-31", rev: 900, rev_4_semanas: 400 },
    ],
  });
  assert.equal(d.length, 31);
  assert.equal(d[29].tom, "abaixo");
  assert.equal(d[29].diff, -200);
  assert.equal(d[30].tom, "acima");
  assert.equal(d[30].diff, 500);
  // banco sem rev_4_semanas no dia: compara contra 0
  const d2 = montarDias({ hoje: "2026-10-31", mes: "2026-10", dias: [{ dia: "2026-10-31", rev: 900 }] });
  assert.equal(d2[30].ant, 0);
  assert.equal(d2[30].tom, "acima");
});

test("montarDias: sem dado", () => {
  assert.deepEqual(montarDias(null), []);
  assert.deepEqual(montarDias({}), []);
});

test("escalaMax usa o maior entre o dia e o mês anterior, nunca 0", () => {
  assert.equal(escalaMax([{ rev: 10, ant: 50 }, { rev: 30, ant: null }]), 50);
  assert.equal(escalaMax([{ rev: 0, ant: 0 }]), 1);
  assert.equal(escalaMax([]), 1);
});

test("rotuloDia: dia da semana abreviado", () => {
  assert.equal(rotuloDia("2026-09-26"), "Sáb, 26/09");
  assert.equal(rotuloDia("2026-09-01"), "Ter, 01/09");
  assert.equal(rotuloDia("x"), "");
});

test("textoDiferenca: sinal e sem centavos", () => {
  assert.equal(textoDiferenca(1234.4), "+R$ 1.234");
  assert.equal(textoDiferenca(-320), "−R$ 320");
  assert.equal(textoDiferenca(0.3), "R$ 0");
  assert.equal(textoDiferenca(null), "");
});

test("ariaFaixa conta dias acima/abaixo e nomeia os meses", () => {
  const d = montarDias({
    hoje: "2026-09-02",
    mes: "2026-09",
    dias: [
      { dia: "2026-09-01", rev: 10, rev_4_semanas: 5 },
      { dia: "2026-09-02", rev: 1, rev_4_semanas: 5 },
    ],
  });
  const t = ariaFaixa(d, "2026-09");
  assert.match(t, /setembro, 2 dias até hoje/);
  assert.match(t, /1 dia igual ou acima do mesmo dia da semana 4 semanas antes, 1 abaixo/);
});

test("unidadesDoDia: só quem vendeu, da maior para a menor", () => {
  const dados = {
    unidades_por_dia: {
      "2026-09-01": [
        { franchise_id: "a", franchise_name: "Maxi Massas A", rev: "100" },
        { franchise_id: "b", franchise_name: "Maxi Massas B", rev: 300 },
        { franchise_id: "c", franchise_name: "Maxi Massas C", rev: 0 },
      ],
    },
  };
  assert.deepEqual(unidadesDoDia(dados, "2026-09-01").map((u) => u.franchise_id), ["b", "a"]);
  assert.deepEqual(unidadesDoDia(dados, "2026-09-02"), []);
  assert.deepEqual(unidadesDoDia(null, "2026-09-01"), []);
});

test("títulos", () => {
  assert.equal(tituloDetalhe("2026-09"), "Faturamento por dia · Setembro");
  assert.equal(LEGENDA_LINHA, "mesmo dia da semana, 4 semanas antes");
  const d = montarDias({ hoje: "2026-09-02", mes: "2026-09", dias: [
    { dia: "2026-09-01", rev: 10, rev_4_semanas: 5 }, { dia: "2026-09-02", rev: 1, rev_4_semanas: 5 } ] });
  assert.equal(subtituloDetalhe(d), "1 de 2 dias igual ou acima de 4 semanas antes");
  assert.equal(subtituloDetalhe([]), "Ainda sem dias neste mês.");
});

console.log(`faturamentoDia: ${passed} testes passaram`);
