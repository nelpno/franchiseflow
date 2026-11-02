// Testes puros (node:assert, sem framework) — produto vendido só em caixa fechada.
// Rodar: node src/lib/caixaFechada.test.mjs
import assert from "node:assert";
import { tamanhoDaCaixa, emCaixasInteiras } from "./caixaFechada.js";

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

console.log("caixaFechada: ok");
