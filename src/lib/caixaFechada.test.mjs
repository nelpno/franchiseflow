// Testes puros (node:assert, sem framework) — produto vendido só em caixa fechada.
// Rodar: node src/lib/caixaFechada.test.mjs
import assert from "node:assert";
import { tamanhoDaCaixa, emCaixasInteiras, emUnidadesDePedido, qtdTexto, precoDaUnidade, caixaDoCampo } from "./caixaFechada.js";

const PQ = "Pão de Queijo Tradicional - 1kg";

assert.equal(tamanhoDaCaixa(PQ), 12);
assert.equal(tamanhoDaCaixa("Sofioli 4 Queijos - 700g"), 1);
assert.equal(tamanhoDaCaixa(undefined), 1);

// avulso não muda (nem o tipo)
assert.equal(emCaixasInteiras("Sofioli 4 Queijos - 700g", 7), 7);
assert.equal(emCaixasInteiras("Sofioli 4 Queijos - 700g", ""), "");
// caixa: sempre para cima, em múltiplos de 12
assert.equal(emCaixasInteiras(PQ, 0), 0);
assert.equal(emCaixasInteiras(PQ, 1), 12);
assert.equal(emCaixasInteiras(PQ, 12), 12);
assert.equal(emCaixasInteiras(PQ, 13), 24);
assert.equal(emCaixasInteiras(PQ, "25"), 36);
assert.equal(emCaixasInteiras(PQ, -3), 0);
assert.equal(emCaixasInteiras(PQ, ""), 0);

// o que a fábrica vê: caixas e preço da caixa; avulso fica como está
assert.equal(qtdTexto(PQ, 24), "2 cx");
assert.equal(qtdTexto(PQ, "36"), "3 cx");
assert.equal(qtdTexto("Sofioli 4 Queijos - 700g", 5), "5");
assert.equal(qtdTexto(PQ, 18), "1 cx + 6 pct");
assert.equal(qtdTexto(PQ, 6), "6 pct");
assert.equal(qtdTexto(PQ, 0), "0 cx");
assert.equal(caixaDoCampo(PQ, 24), 12);
assert.equal(caixaDoCampo(PQ, 18), 1);
assert.equal(caixaDoCampo("Sofioli 4 Queijos - 700g", 7), 1);
assert.equal(emUnidadesDePedido(PQ, 24), 2);
assert.equal(emUnidadesDePedido(PQ, 18), 2);
assert.equal(emUnidadesDePedido("Sofioli 4 Queijos - 700g", 5), 5);
assert.equal(Math.round(precoDaUnidade(PQ, "14.90") * 100), 17880);
assert.equal(precoDaUnidade("Sofioli 4 Queijos - 700g", 30), 30);

console.log("caixaFechada: ok");
