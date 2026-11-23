// node src/lib/creditoCliente.test.mjs — crédito do cliente (23/11/2026). Simulações do desenho:
// docs/arquitetura-beneficios.md (raiz da Maxi) § "Crédito do cliente". A trava (saldo, duas abas, apagar venda)
// é do banco e foi ensaiada por SQL (supabase/2026-11-23-credito-cliente.sql, ensaio de 23/11).
import assert from "node:assert/strict";
import { creditoDisponivelNaVenda, creditoAplicado, origemDoDesconto, erroNovoCredito, mapaDeSaldos, rotuloMotivoCredito } from "./creditoCliente.js";
import { calcSale } from "./saleCalc.js";
import { linhasDesconto, rotuloDesconto } from "./cupom.js";

let n = 0; const t = (nome, f) => { try { f(); n++; } catch (e) { console.error("❌", nome, e.message); process.exitCode = 1; } };
const itens = (v) => [{ quantity: 1, unit_price: v }];

// S3: compra de 100 com crédito de 20 → paga 80; o Pix do Resultado é 80
t("S3", () => {
  const r = calcSale({ items: itens(100), paymentMethod: "pix", creditoDisponivel: 20 });
  assert.equal(r.creditoUsado, 20); assert.equal(r.discountAmount, 20); assert.equal(r.netValue, 80);
  assert.equal(origemDoDesconto({ descontoManual: r.descontoManual, creditoUsado: r.creditoUsado, motivoManual: "" }), "credito");
});
// S6: compra de 15 com crédito de 20 → usa 15, sobra 5; frete não entra
t("S6", () => {
  const r = calcSale({ items: itens(15), deliveryMethod: "delivery", deliveryFee: 8, creditoDisponivel: 20 });
  assert.equal(r.creditoUsado, 15); assert.equal(r.netValue, 8);
});
// S7: promoção (10) + crédito (20) na mesma venda: o crédito entra depois e o motivo é o da promoção
t("S7", () => {
  const r = calcSale({ items: itens(50), discountInput: 10, creditoDisponivel: 20 });
  assert.equal(r.descontoManual, 10); assert.equal(r.creditoUsado, 20); assert.equal(r.discountAmount, 30); assert.equal(r.netValue, 20);
  assert.equal(origemDoDesconto({ descontoManual: 10, creditoUsado: 20, motivoManual: "promocao" }), "promocao");
  const l = linhasDesconto({ discount_amount: 30, credito_usado: 20, desconto_origem: "promocao" });
  assert.deepEqual(l.map((x) => [x.rotulo, x.valor]), [["Promoção", 10], ["Crédito do cliente", 20]]);
});
t("desconto em % não cobra % sobre o crédito", () => {
  const r = calcSale({ items: itens(100), discountInput: 10, discountType: "percent", creditoDisponivel: 95 });
  assert.equal(r.descontoManual, 10); assert.equal(r.creditoUsado, 90); assert.equal(r.netValue, 0);
});
// taxa de cartão sobre o que o cliente paga (crédito fora da base)
t("taxa", () => {
  const r = calcSale({ items: itens(100), paymentMethod: "credit", cardFeePercent: 5, hasPaymentFeesConfig: true, creditoDisponivel: 20 });
  assert.ok(Math.abs(r.cardFeeAmount - 4) < 0.001);
});
t("sem crédito = conta de sempre", () => {
  const a = calcSale({ items: itens(100), discountInput: 5 }); const b = calcSale({ items: itens(100), discountInput: 5, creditoDisponivel: 0 });
  assert.deepEqual(a, b); assert.equal(a.creditoUsado, 0);
});
t("venda vazia não usa crédito", () => assert.equal(calcSale({ items: [], creditoDisponivel: 20 }).creditoUsado, 0));
t("centavos", () => assert.equal(calcSale({ items: [{ quantity: 3, unit_price: 0.1 }], creditoDisponivel: 50 }).creditoUsado, 0.3));
// S8 / edição: o saldo da view já descontou o crédito desta venda; somar de volta só se for o mesmo cliente
t("edição mesmo cliente", () => assert.equal(creditoDisponivelNaVenda({ saldo: 0, creditoDaVenda: 15, mesmoCliente: true }), 15));
t("edição trocou cliente", () => assert.equal(creditoDisponivelNaVenda({ saldo: 7, creditoDaVenda: 15, mesmoCliente: false }), 7));
t("saldo negativo vira 0", () => assert.equal(creditoDisponivelNaVenda({ saldo: -3 }), 0));
t("creditoAplicado", () => {
  assert.equal(creditoAplicado({ disponivel: 20, subtotal: 15 }), 15);
  assert.equal(creditoAplicado({ disponivel: 20, subtotal: 50, outroDesconto: 40 }), 10);
  assert.equal(creditoAplicado({ disponivel: 20, subtotal: 10, outroDesconto: 40 }), 0);
});
t("origem sem desconto", () => assert.equal(origemDoDesconto({ descontoManual: 0, creditoUsado: 0, motivoManual: "cupom" }), null));
t("origem manual sem motivo + crédito", () => assert.equal(origemDoDesconto({ descontoManual: 5, creditoUsado: 5, motivoManual: "" }), null));
// S10: digitou 2000 em vez de 20
t("S10 teto", () => assert.match(erroNovoCredito({ valor: 2000, motivo: "troco" }), /vai até/));
t("valor", () => {
  assert.equal(erroNovoCredito({ valor: 20, motivo: "troco" }), null);
  assert.equal(erroNovoCredito({ valor: 17.2, motivo: "pagou_a_mais" }), null);
  assert.match(erroNovoCredito({ valor: 0, motivo: "troco" }), /Digite/);
  assert.match(erroNovoCredito({ valor: NaN, motivo: "troco" }), /Digite/);
  assert.match(erroNovoCredito({ valor: 1.234, motivo: "troco" }), /dois números/);
  assert.match(erroNovoCredito({ valor: 5, motivo: "x" }), /motivo/);
});
t("mapaDeSaldos", () => assert.deepEqual(mapaDeSaldos([{ contact_id: "a", saldo: "20.00" }, { contact_id: "b", saldo: 0 }, { contact_id: "c", saldo: -1 }]), { a: 20 }));
t("rótulos", () => {
  assert.equal(rotuloDesconto({ desconto_origem: "credito" }), "Crédito do cliente");
  assert.equal(rotuloMotivoCredito("troco"), "Troco que ficou");
  assert.deepEqual(linhasDesconto({ discount_amount: 20, credito_usado: 20, desconto_origem: "credito" }).map((x) => x.rotulo), ["Crédito do cliente"]);
  assert.deepEqual(linhasDesconto({ discount_amount: 10, desconto_origem: "cupom", desconto_codigo: "X10" }).map((x) => x.rotulo), ["Cupom X10"]);
  assert.deepEqual(linhasDesconto({ discount_amount: 10, discount_type: "percent", discount_input: 10, desconto_origem: "promocao" }).map((x) => x.rotulo), ["Promoção (10%)"]);
  assert.deepEqual(linhasDesconto({ discount_amount: 0 }), []);
});
console.log(`creditoCliente: ${n} ok${process.exitCode ? " (com falha)" : ""}`);
