// node src/lib/cupom.test.mjs
import assert from "node:assert/strict";
import { limparCodigo, cupomDoPainel, erroCupom, fraseCupomCliente, rotuloDesconto } from "./cupom.js";

let n = 0; const t = (f) => { f(); n++; };
t(() => assert.equal(limparCodigo(" maxi massas-10 "), "MAXIMASSAS10"));
t(() => assert.equal(limparCodigo("Promoção 15!"), "PROMOCAO15"));
t(() => assert.equal(limparCodigo(null), ""));
t(() => assert.equal(limparCodigo("A".repeat(30)).length, 20));
t(() => assert.equal(cupomDoPainel({}), null));
t(() => assert.equal(cupomDoPainel(null), null));
t(() => assert.deepEqual(cupomDoPainel({ cupom: { ativo: false, pct: 10, codigo: "MAXIMASSAS10", vale_ate: null, chave_ligada: true, usos_30d: 0, desconto_30d: 0 } }),
  { ativo: false, pct: 10, codigo: "MAXIMASSAS10", vale_ate: null, vencido: false, chaveLigada: true, usos30d: 0, desconto30d: 0 }));
t(() => assert.equal(cupomDoPainel({ cupom: { ativo: true, pct: 7, codigo: "", vale_ate: "lixo" } }).pct, 10)); // pct fora da lista volta ao padrão
t(() => assert.equal(cupomDoPainel({ cupom: { ativo: true, pct: 7, codigo: "", vale_ate: "lixo" } }).codigo, "MAXIMASSAS10"));
t(() => assert.equal(cupomDoPainel({ cupom: { ativo: true, pct: 7, codigo: "", vale_ate: "lixo" } }).vale_ate, null));
t(() => assert.equal(cupomDoPainel({ cupom: { chave_ligada: false } }).chaveLigada, false));
const base = { ativo: true, pct: 10, codigo: "MAXIMASSAS10", vale_ate: null };
t(() => assert.equal(erroCupom(base, "2026-11-11"), null));
t(() => assert.match(erroCupom({ ...base, pct: 12 }, "2026-11-11"), /Escolha o desconto/));
t(() => assert.match(erroCupom({ ...base, codigo: "12345" }, "2026-11-11"), /pelo menos uma letra/));
t(() => assert.match(erroCupom({ ...base, codigo: "AB" }, "2026-11-11"), /3 a 20/));
t(() => assert.match(erroCupom({ ...base, codigo: "AB CD" }, "2026-11-11"), /3 a 20/));
t(() => assert.match(erroCupom({ ...base, vale_ate: "2026-11-10" }, "2026-11-11"), /já passou/));
t(() => assert.equal(erroCupom({ ...base, vale_ate: "2026-11-10", ativo: false }, "2026-11-11"), null)); // desligado pode ter data velha
t(() => assert.equal(erroCupom({ ...base, vale_ate: "2026-11-11" }, "2026-11-11"), null)); // vale até o fim do dia
t(() => assert.match(erroCupom({ ...base, vale_ate: "2026-02-31" }, "2026-11-11"), /inválida/));
t(() => assert.equal(fraseCupomCliente({ pct: 10, codigo: "MAXIMASSAS10", vale_ate: "2026-11-30" }), "Cupom MAXIMASSAS10: 10% de desconto nos produtos, até 30/11."));
t(() => assert.equal(fraseCupomCliente({ pct: 5, codigo: "VOLTA5", vale_ate: null }), "Cupom VOLTA5: 5% de desconto nos produtos."));
t(() => assert.equal(rotuloDesconto({ desconto_origem: "cupom", desconto_codigo: "MAXIMASSAS10" }), "Cupom MAXIMASSAS10"));
t(() => assert.equal(rotuloDesconto({ desconto_origem: "promocao" }), "Promoção"));
t(() => assert.equal(rotuloDesconto({}), "Desconto"));
console.log(`cupom.test.mjs: ${n} ok`);
