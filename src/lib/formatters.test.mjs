// Testes puros (node:assert, sem framework). Rodar: node src/lib/formatters.test.mjs
//
// NBSP: o Intl.NumberFormat("pt-BR", {style:"currency"}) (usado por formatBRL/formatBRLInteger,
// e por tabela por formatBRLCompactResultado quando cai no formatBRL) põe um espaço FIXO
// (U+00A0, não U+0020) entre "R$" e o número. O ramo "k" (template string simples) usa espaço
// normal. Os literais abaixo respeitam essa diferença — não trocar o   por espaço comum.
import assert from "node:assert";
import { formatBRL, formatBRLInteger, formatBRLCompact, formatBRLCompactResultado, formatPct } from "./formatters.js";
const RS = "R$ "; // "R$" + NBSP, como o Intl.NumberFormat pt-BR/BRL produz

// ── formatBRL / formatBRLInteger básicos ──
assert.equal(formatBRL(1234.5), `${RS}1.234,50`);
assert.equal(formatBRL(81.6), `${RS}81,60`);
assert.equal(formatBRLInteger(1234.5), `${RS}1.235`);

// ── formatBRLCompact GENÉRICO (eixo de gráfico) — sem mudar o comportamento atual ──
assert.equal(formatBRLCompact(1234), "R$ 1,2k");
assert.equal(formatBRLCompact(850), "R$ 850");

// ── formatBRLCompactResultado — tem de bater com o formato que a tela Resultado SEMPRE
// mostrou (revisão S8-P3, 28/09/2026: a unificação do S8.4 tinha trocado isso sem querer
// pelo formatBRLCompact genérico, mudando número na tela). Os 3 casos são os que a revisão
// apontou como quebrados:
assert.equal(formatBRLCompactResultado(81.6), `${RS}81,60`, "abaixo de R$1.000: valor cheio, nunca arredonda pro inteiro");
assert.equal(formatBRLCompactResultado(1234), "R$ 1,23k", "entre R$1.000-9.999: 2 casas no k, não 1");
assert.equal(formatBRLCompactResultado(-1234), "R$ -1,23k", "negativo: mesmo corte por valor ABSOLUTO, não vira R$ -1.235");

// ── mais casos de fronteira, pra não regredir de novo (valores conferidos contra a saída real
// da função — inclusive a peculiaridade herdada do código original: o corte de 1/2 casas usa
// o valor CRU (n >= 10000), não o valor absoluto, então negativo grande continua em 2 casas) ──
assert.equal(formatBRLCompactResultado(0), `${RS}0,00`);
assert.equal(formatBRLCompactResultado(999.99), `${RS}999,99`, "logo abaixo do corte de 1.000: ainda valor cheio");
assert.equal(formatBRLCompactResultado(1000), "R$ 1,00k", "exatamente 1.000: já entra no k");
assert.equal(formatBRLCompactResultado(9999), "R$ 10,00k", "faixa de 2 casas vai até 9.999 (9999/1000 arredonda pra 10,00)");
assert.equal(formatBRLCompactResultado(12345), "R$ 12,3k", "R$10.000 pra cima (valor cru): 1 casa só");
assert.equal(formatBRLCompactResultado(-500), `-${RS}500,00`, "negativo abaixo de R$1.000 (abs): valor cheio (Intl põe o sinal antes do R$)");
assert.equal(formatBRLCompactResultado(-12345), "R$ -12,35k", "negativo grande: corte por valor CRU, então continua em 2 casas (herdado do original)");
assert.equal(formatBRLCompactResultado(null), `${RS}0,00`);
assert.equal(formatBRLCompactResultado(undefined), `${RS}0,00`);

// ── formatPct (não mexido nesta sessão, só conferindo que segue igual) ──
assert.equal(formatPct(-27.34), "−27,3%");
assert.equal(formatPct(13.2, { sinal: true }), "+13,2%");

console.log("formatters: ok (formatBRLCompactResultado preserva o número exato da tela Resultado)");
