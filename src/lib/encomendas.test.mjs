// Testes puros (node:assert, sem framework) — regras das encomendas.
// Rodar: node src/lib/encomendas.test.mjs
import assert from "node:assert";
import {
  diasAte, rotuloPrazo, itensValidos, totalUnidades, somaPorProduto,
  ativasOrdenadas, abertasParaPedido, daSemana, prefillDaVenda, validarEncomenda,
} from "./encomendas.js";

const HOJE = "2026-11-17";

// dias e rótulos (DATE sem fuso: nada de new Date("yyyy-MM-dd") em UTC)
assert.equal(diasAte("2026-11-17", HOJE), 0);
assert.equal(diasAte("2026-11-18", HOJE), 1);
assert.equal(diasAte("2026-12-19", HOJE), 32);
assert.equal(diasAte("2026-11-15", HOJE), -2);
assert.equal(diasAte(null, HOJE), null);
assert.equal(rotuloPrazo(0), "hoje");
assert.equal(rotuloPrazo(1), "amanhã");
assert.equal(rotuloPrazo(5), "em 5 dias");
assert.equal(rotuloPrazo(-1), "atrasada 1 dia");
assert.equal(rotuloPrazo(-3), "atrasada 3 dias");

// itens: só inteiro > 0
assert.deepEqual(itensValidos([{ inventory_item_id: "a", nome: " Canelone ", qtd: "3" }, { nome: "x", qtd: 0 }, { nome: "y", qtd: "abc" }, null]),
  [{ inventory_item_id: "a", nome: "Canelone", qtd: 3 }]);
assert.deepEqual(itensValidos(undefined), []);
assert.equal(totalUnidades({ itens: [{ nome: "a", qtd: 2 }, { nome: "b", qtd: 5 }] }), 7);

// soma por produto: junta pelo id, ordena por nome
const encs = [
  { id: "1", status: "aberta", entregar_em: "2026-12-19", itens: [{ inventory_item_id: "c", nome: "Canelone Frango", qtd: 280 }, { inventory_item_id: "n", nome: "Nhoque", qtd: 10 }] },
  { id: "2", status: "aberta", entregar_em: "2026-11-20", itens: [{ inventory_item_id: "c", nome: "Canelone Frango", qtd: 20 }] },
];
assert.deepEqual(somaPorProduto(encs), [
  { inventory_item_id: "c", nome: "Canelone Frango", qtd: 300 },
  { inventory_item_id: "n", nome: "Nhoque", qtd: 10 },
]);
// a soma não muta as encomendas
assert.equal(encs[0].itens[0].qtd, 280);

// ordem e filtros por status
const todas = [
  { id: "a", status: "aberta", entregar_em: "2026-12-19", created_at: "2026-11-10" },
  { id: "b", status: "pedida", entregar_em: "2026-11-19", created_at: "2026-11-11" },
  { id: "c", status: "entregue", entregar_em: "2026-11-18", created_at: "2026-11-12" },
  { id: "d", status: "cancelada", entregar_em: "2026-11-18", created_at: "2026-11-12" },
  { id: "e", status: "aberta", entregar_em: "2026-11-15", created_at: "2026-11-09" },
];
assert.deepEqual(ativasOrdenadas(todas).map((e) => e.id), ["e", "b", "a"]);
assert.deepEqual(abertasParaPedido(todas).map((e) => e.id), ["e", "a"]); // pedida não volta ao lembrete
assert.deepEqual(daSemana(todas, HOJE).map((e) => e.id), ["e", "b"]); // atrasada entra; 19/12 fica de fora
assert.deepEqual(daSemana(todas, HOJE, 60).map((e) => e.id), ["e", "b", "a"]);

// virou venda
const p = prefillDaVenda({ id: "x", contact_id: "k", cliente_nome: " Maria ", telefone: "16999990000", obs: "sem alho", itens: [{ inventory_item_id: "c", nome: "Canelone", qtd: 4 }, { nome: "z", qtd: 0 }] });
assert.equal(p.contactId, "k");
assert.equal(p.nome, "Maria");
assert.equal(p.observacoes, "Encomenda: sem alho");
assert.deepEqual(p.itens, [{ inventory_item_id: "c", nome: "Canelone", qtd: 4 }]);
assert.equal(prefillDaVenda({ itens: [] }).observacoes, "Encomenda");

// validação
const ok = { cliente_nome: "Fátima", entregar_em: "2026-12-19", itens: [{ inventory_item_id: "c", nome: "Canelone", qtd: 280 }] };
assert.equal(validarEncomenda(ok, HOJE), null);
assert.match(validarEncomenda({ ...ok, cliente_nome: " " }, HOJE), /nome/);
assert.match(validarEncomenda({ ...ok, entregar_em: "" }, HOJE), /data/i);
assert.match(validarEncomenda({ ...ok, entregar_em: "2026-11-16" }, HOJE), /passou/);
assert.equal(validarEncomenda({ ...ok, entregar_em: HOJE }, HOJE), null); // hoje vale
assert.match(validarEncomenda({ ...ok, itens: [{ nome: "x", qtd: 0 }] }, HOJE), /produto/);

console.log("encomendas: ok");
