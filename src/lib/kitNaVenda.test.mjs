// node src/lib/kitNaVenda.test.mjs — kit da promoção na venda do app (24/11/2026)
import assert from "node:assert/strict";
import {
  kitsDaVenda, acharProduto, montarKit, escolhasIniciais, escolhasCompletas, itensDoKit,
  kitJaNaVenda, somarKitNosItens, descontoDoKit, faltaEstoque, textoDoKit, observacaoComKit,
} from "./kitNaVenda.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log(`ok ${n} - ${nome}`); };

// Estoque no formato do Vendas.jsx (id, product_name, quantity, cost_price, sale_price)
const estoque = [
  { id: "nhq", product_name: "Nhoque de Batata - 1kg", quantity: 5, cost_price: 15, sale_price: 32 },
  { id: "can4", product_name: "Canelone 4 Queijos - 700g", quantity: 3, cost_price: 20, sale_price: 45 },
  { id: "sof", product_name: "Sofioli Presunto e Mussarela - 700g", quantity: 0, cost_price: 18, sale_price: 40 },
  { id: "sugo", product_name: "Molho ao sugo artesanal 500ml", quantity: 10, cost_price: 6, sale_price: 15 },
  { id: "parm", product_name: "Queijo parmesão ralado 100g", quantity: 4, cost_price: 7, sale_price: 14 },
  { id: "pdqa", product_name: "Pão de queijo recheado com goiabada", quantity: 2, cost_price: 20, sale_price: 42 },
  { id: "bolsa", product_name: "Bolsa térmica Maxi Massas", quantity: 1, cost_price: 10, sale_price: 25 },
];

// Kit 2 da sp8 (real, 24/11): nhoque + massa à escolha + 2 molhos + parmesão + pão de queijo à escolha + bolsa, R$ 169,90
const kit2 = {
  nome: "Kit 2", tipo: "kit", preco: 169.9, vale_ate: "2026-12-31",
  itens: [
    { qtd: 1, product_name: "Nhoque de Batata - 1kg" },
    { qtd: 1, escolha: true, rotulo: "Massa recheada 700g", opcoes: ["Canelone 4 Queijos - 700g", "Sofioli Presunto e Mussarela - 700g", "Rondelli que não tem - 700g"] },
    { qtd: 2, product_name: "Molho ao sugo artesanal 500ml" },
    { qtd: 1, product_name: "Queijo parmesão ralado 100g" },
    { qtd: 1, escolha: true, rotulo: "Pão de queijo recheado 1kg", opcoes: ["Pão de queijo recheado com goiabada", "Pão de queijo recheado com doce de leite"] },
    { qtd: 1, product_name: "Bolsa térmica Maxi Massas" },
  ],
};
const vazia = { inventory_item_id: "", product_name: "", quantity: 1, unit_price: 0, cost_price: 0 };

t("kitsDaVenda: só kit, preço > 0 e dentro da validade", () => {
  const regras = [kit2, { ...kit2, nome: "Velho", vale_ate: "2026-11-01" }, { tipo: "percentual", nome: "Leve 3", itens: [{ product_name: "x", qtd: 1 }] }, { ...kit2, nome: "Sem data", vale_ate: null }];
  assert.deepEqual(kitsDaVenda(regras, "2026-11-24").map((r) => r.nome), ["Kit 2", "Sem data"]);
  assert.deepEqual(kitsDaVenda(null, "2026-11-24"), []);
  assert.equal(kitsDaVenda([{ ...kit2, vale_ate: "2026-11-24" }], "2026-11-24").length, 1, "vale no último dia");
});

t("acharProduto: exato, depois sem maiúscula/espaço", () => {
  assert.equal(acharProduto(estoque, "Bolsa térmica Maxi Massas").id, "bolsa");
  assert.equal(acharProduto(estoque, "  bolsa térmica  maxi massas").id, "bolsa");
  assert.equal(acharProduto(estoque, "Bolsa"), null);
});

t("montarKit: opções que não estão no estoque somem; fixo faltando bloqueia", () => {
  const m = montarKit(kit2, estoque);
  assert.equal(m.ok, true);
  assert.deepEqual(m.linhas[1].opcoes.map((o) => o.id), ["can4", "sof"]);
  const semBolsa = montarKit(kit2, estoque.filter((p) => p.id !== "bolsa"));
  assert.equal(semBolsa.ok, false);
  assert.match(semBolsa.motivo, /Bolsa térmica Maxi Massas/);
  const semPao = montarKit(kit2, estoque.filter((p) => p.id !== "pdqa"));
  assert.equal(semPao.ok, false);
  assert.match(semPao.motivo, /Pão de queijo recheado 1kg/);
});

t("escolhas: uma por unidade; incompleto devolve null", () => {
  const m = montarKit({ ...kit2, itens: [{ ...kit2.itens[1], qtd: 2 }, kit2.itens[0]] }, estoque);
  const e = escolhasIniciais(m);
  assert.deepEqual(e, [["", ""], null]);
  assert.equal(itensDoKit(m, e), null);
  e[0] = ["can4", "zzz"];
  assert.equal(escolhasCompletas(m, e), false, "opção que não é do item não vale");
  e[0] = ["can4", "sof"];
  assert.deepEqual(itensDoKit(m, e).map((x) => [x.inv.id, x.qtd]), [["can4", 1], ["sof", 1], ["nhq", 1]]);
  e[0] = ["can4", "can4"];
  assert.deepEqual(itensDoKit(m, e).map((x) => [x.inv.id, x.qtd]), [["can4", 2], ["nhq", 1]], "mesmo sabor duas vezes soma");
});

t("Kit 2 da Bárbara: itens, desconto e linhas da venda", () => {
  const m = montarKit(kit2, estoque);
  const e = escolhasIniciais(m);
  e[1] = ["can4"]; e[4] = ["pdqa"];
  const kit = itensDoKit(m, e);
  // 32 + 45 + 2×15 + 14 + 42 + 25 = 188
  const d = descontoDoKit(kit2, kit, [vazia]);
  assert.deepEqual(d, { soma: 188, preco: 169.9, desconto: 18.1 });
  const linhas = somarKitNosItens([vazia], kit);
  assert.equal(linhas.length, 6, "a linha vazia é ocupada, nenhuma sobra");
  assert.ok(linhas.every((l) => l.inventory_item_id));
  assert.equal(linhas.find((l) => l.inventory_item_id === "bolsa").quantity, 1, "bolsa entra como item (baixa estoque)");
  assert.equal(linhas.find((l) => l.inventory_item_id === "sugo").quantity, 2);
  assert.equal(linhas.reduce((s, l) => s + l.quantity * l.unit_price, 0), 188);
});

t("somar kit em venda que já tem o produto: soma na linha e usa o preço dela", () => {
  const m = montarKit(kit2, estoque);
  const e = escolhasIniciais(m); e[1] = ["can4"]; e[4] = ["pdqa"];
  const kit = itensDoKit(m, e);
  const itens = [{ inventory_item_id: "sugo", product_name: "Molho ao sugo artesanal 500ml", quantity: 1, unit_price: 13, cost_price: 6 }];
  const linhas = somarKitNosItens(itens, kit);
  assert.equal(linhas.filter((l) => l.inventory_item_id === "sugo").length, 1);
  assert.equal(linhas.find((l) => l.inventory_item_id === "sugo").quantity, 3);
  assert.equal(itens[0].quantity, 1, "não muda o array de entrada");
  // preço da linha (13) no lugar do estoque (15): 188 − 2×2 = 184
  assert.equal(descontoDoKit(kit2, kit, linhas).soma, 184);
});

t("opção barata: soma abaixo do preço = sem desconto", () => {
  const barato = estoque.map((p) => (p.id === "can4" ? { ...p, sale_price: 1 } : p.id === "pdqa" ? { ...p, sale_price: 1 } : p));
  const m = montarKit(kit2, barato);
  const e = escolhasIniciais(m); e[1] = ["can4"]; e[4] = ["pdqa"];
  const d = descontoDoKit(kit2, itensDoKit(m, e), []);
  assert.equal(d.soma, 103);
  assert.equal(d.desconto, 0);
});

t("Virou venda: kit já na venda é detectado", () => {
  const m = montarKit(kit2, estoque);
  const e = escolhasIniciais(m); e[1] = ["can4"]; e[4] = ["pdqa"];
  const kit = itensDoKit(m, e);
  const linhas = somarKitNosItens([vazia], kit);
  assert.equal(kitJaNaVenda(linhas, kit), true);
  assert.equal(kitJaNaVenda([vazia], kit), false);
  const menos = linhas.map((l) => (l.inventory_item_id === "sugo" ? { ...l, quantity: 1 } : l));
  assert.equal(kitJaNaVenda(menos, kit), false);
});

t("faltaEstoque: avisa o que não cobre (somando o que já está na venda)", () => {
  const m = montarKit(kit2, estoque);
  const e = escolhasIniciais(m); e[1] = ["sof"]; e[4] = ["pdqa"];
  const kit = itensDoKit(m, e);
  assert.deepEqual(faltaEstoque(kit, [vazia]).map((f) => f.nome), ["Sofioli Presunto e Mussarela - 700g"]);
  const comBolsa = [{ inventory_item_id: "bolsa", quantity: 1, unit_price: 25 }];
  assert.deepEqual(faltaEstoque(kit, comBolsa).map((f) => [f.nome, f.precisa]), [["Sofioli Presunto e Mussarela - 700g", 1], ["Bolsa térmica Maxi Massas", 2]]);
  assert.deepEqual(faltaEstoque(kit, comBolsa, true).map((f) => f.nome), ["Sofioli Presunto e Mussarela - 700g"], "só desconto: não soma de novo");
});

t("texto da observação", () => {
  const m = montarKit(kit2, estoque);
  const e = escolhasIniciais(m); e[1] = ["can4"]; e[4] = ["pdqa"];
  assert.equal(textoDoKit(kit2, m, e), "Kit 2 (Canelone 4 Queijos - 700g, Pão de queijo recheado com goiabada)");
  const fixo = { nome: "Kit fixo", tipo: "kit", preco: 50, itens: [{ qtd: 2, product_name: "Nhoque de Batata - 1kg" }] };
  assert.equal(textoDoKit(fixo, montarKit(fixo, estoque), [null]), "Kit fixo");
  assert.equal(observacaoComKit("", "Kit 2"), "Kit 2");
  assert.equal(observacaoComKit("Entregar após 18h  ", "Kit 2"), "Entregar após 18h\nKit 2");
});

console.log(`\n${n} testes passaram`);
