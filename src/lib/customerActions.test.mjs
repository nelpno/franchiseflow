// node src/lib/customerActions.test.mjs
import assert from "node:assert/strict";
import {
  ACTION_ORDER,
  ACTION_TYPES,
  PALAVRAS_PROIBIDAS,
  cidadeDaUnidade,
  diasEntre,
  escolherVariante,
  filtrarClientes,
  marcaDoCliente,
  montarMensagem,
  nomeCurtoProduto,
  nomeExibicao,
  primeiroNome,
  textoDias,
  textoQuando,
  tomDaRecencia,
} from "./customerActions.js";

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

// ---------- nomes ----------
const NOMES = [
  ["Maria Souza", "Maria"],
  ["MARIA souza", "Maria"],
  ["maria das graças", "Maria"],
  ["ÁLVARO", "Álvaro"],
  ["Beatriz 🌸", "Beatriz"],
  ["Seu Antônio", "Seu Antônio"],
  ["DONA cida", "Dona Cida"],
  ["Dona", ""],
  ["", ""],
  [null, ""],
  ["😊✨", ""],
  [".", ""],
  ["11999998888", ""],
  ["Cliente", ""],
  ["CONTÁTO 12", ""],
  ["𝔇𝔞𝔫𝔦𝔢𝔩𝔞", ""],
];
for (const [entrada, esperado] of NOMES) {
  test(`primeiroNome(${entrada})`, () => assert.equal(primeiroNome(entrada), esperado));
}

test("nomeExibicao", () => {
  assert.equal(nomeExibicao({ nome: "MARIA SOUZA Silva" }), "Maria Souza");
  assert.equal(nomeExibicao({ nome: "😊", telefone: "11999998888" }), "(11) 99999-8888");
  assert.equal(nomeExibicao({ nome: "", telefone: "" }), "Cliente sem nome");
});

test("nomeCurtoProduto", () => {
  assert.equal(nomeCurtoProduto("Rondelli 4 Queijos - 700g Rolo"), "Rondelli 4 Queijos");
  assert.equal(nomeCurtoProduto("Molho de Tomate Mariolla - 250g"), "Molho de Tomate Mariolla");
  for (const vazio of [null, undefined, "", "   ", 42]) assert.equal(nomeCurtoProduto(vazio), null);
});

test("cidadeDaUnidade", () => {
  assert.equal(cidadeDaUnidade({ name: "Maxi Massas Itaquera", city: "São Paulo - SP" }), "Itaquera");
  assert.equal(cidadeDaUnidade({ name: "MAXI MASSAS Vila Maria" }), "Vila Maria");
  assert.equal(cidadeDaUnidade({ name: "", city: "Campinas - SP" }), "Campinas");
  assert.equal(cidadeDaUnidade(null), "");
});

// ---------- mensagem ----------
// "b" cai na variante 0 e "a" na 1 (conferido abaixo)
const PRODUTOS = ["Lasanha Bolonhesa - 1kg", null];
for (const tipo of ACTION_ORDER) {
  for (const variante of [0, 1]) {
    for (const nome of ["MARIA Souza", "Dona Cida", null]) {
      for (const produto of PRODUTOS) {
        test(`mensagem ${tipo}/v${variante}/${nome}/${produto}`, () => {
          const contact_id = variante === 0 ? "b" : "a";
          assert.equal(escolherVariante(contact_id, 2), variante);
          const msg = montarMensagem(
            { contact_id, tipo, nome, favorito: produto, ultimo_produto: produto },
            { cidade: "Suzano" }
          );
          const saudacao = nome === "MARIA Souza" ? "Oi, Maria!" : nome === "Dona Cida" ? "Oi, Dona Cida!" : "Oi!";
          assert.ok(msg.startsWith(saudacao), msg);
          assert.ok(msg.includes("Aqui é da Maxi Massas Suzano"), msg);
          const baixo = msg.toLowerCase();
          for (const proibido of ["undefined", "null", "{", "}", "  ", ...PALAVRAS_PROIBIDAS]) {
            assert.ok(!baixo.includes(proibido), `"${proibido}" em: ${msg}`);
          }
          // produto sem artigo (o gênero variaria) e sem a gramatura
          assert.ok(!/\b(do|da|o|a) Lasanha/.test(msg), msg);
          assert.ok(!msg.includes("1kg"), msg);
          if (produto && tipo !== "quase_comprou" && !(tipo === "voltou_a_falar" && variante === 0) && !(tipo === "sumido" && variante === 0)) {
            assert.ok(msg.includes("Lasanha Bolonhesa"), msg);
          }
          assert.ok(!msg.includes("http"), "sem link na mensagem");
        });
      }
    }
  }
}

test("mensagem sem cidade e tipo desconhecido", () => {
  const msg = montarMensagem({ tipo: "repetir", contact_id: "b" });
  assert.ok(msg.includes("Aqui é da Maxi Massas 😊"), msg);
  assert.ok(montarMensagem({ tipo: "xyz", contact_id: "b" }).startsWith("Oi!"));
  assert.ok(montarMensagem(null).startsWith("Oi!"));
});

test("escolherVariante estável", () => {
  for (const id of ["abc", "6ac10bb5-0e4b-4d51-b685-9fc69ae8dde0", "", null]) {
    for (const n of [1, 2, 5]) {
      const i = escolherVariante(id, n);
      assert.equal(i, escolherVariante(id, n));
      assert.ok(i >= 0 && i < n);
    }
  }
});

// ---------- datas (calendário de São Paulo) ----------
test("textoQuando", () => {
  const agora = new Date("2026-09-16T15:00:00Z"); // 12h em SP
  assert.equal(textoQuando("2026-09-16T03:00:00Z", agora), "hoje");
  assert.equal(textoQuando("2026-09-16T02:00:00Z", agora), "ontem"); // 23h do dia 15 em SP
  assert.equal(textoQuando("2026-09-15T15:00:00Z", agora), "ontem");
  assert.equal(textoQuando("2026-09-13T15:00:00Z", agora), "há 3 dias");
  assert.equal(textoQuando("2026-09-15T23:00:00Z", new Date("2026-09-16T02:00:00Z")), "hoje");
  assert.equal(textoQuando(null, agora), "recentemente");
  assert.equal(textoQuando("lixo", agora), "recentemente");
});

test("diasEntre aceita DATE e timestamptz", () => {
  const agora = new Date("2026-09-16T15:00:00Z");
  assert.equal(diasEntre("2026-09-16", agora), 0);
  assert.equal(diasEntre("2026-09-06", agora), 10);
  assert.equal(diasEntre("2026-09-06T15:00:00+00:00", agora), 10); // meio-dia de SP, como a trigger grava
  assert.equal(diasEntre("2026-09-20", agora), 0); // venda com data futura não vira número negativo
  assert.equal(diasEntre(null, agora), null);
});

test("textoDias", () => {
  assert.equal(textoDias(0), "hoje");
  assert.equal(textoDias(1), "ontem");
  assert.equal(textoDias(12), "há 12 dias");
  assert.equal(textoDias(null), "");
});

test("motivos usam os dias sem repetir 'há há'", () => {
  const item = { compras: 3, dias: 22, conversa_em: new Date().toISOString() };
  for (const tipo of ACTION_ORDER) {
    const texto = ACTION_TYPES[tipo].motivo(item);
    assert.ok(!texto.includes("há há") && !texto.includes("undefined"), texto);
  }
  assert.equal(ACTION_TYPES.sumido.motivo({ dias: 47 }), "Não compra há 47 dias");
});

// ---------- marca, recência, filtros ----------
test("marcaDoCliente", () => {
  for (const [n, label] of [[null, "Nunca comprou"], [0, "Nunca comprou"], [1, "Novo"], [2, "Voltou"], [4, "Voltou"], [5, "Fiel"], ["9", "Fiel"]]) {
    assert.equal(marcaDoCliente(n).label, label);
  }
});

test("tomDaRecencia", () => {
  for (const [dias, tom] of [[null, null], [0, "ok"], [30, "ok"], [31, "warn"], [60, "warn"], [61, "err"]]) {
    assert.equal(tomDaRecencia(dias), tom);
  }
});

test("filtrarClientes", () => {
  const velho = new Date(Date.now() - 45 * 86400000).toISOString();
  const novo = new Date(Date.now() - 3 * 86400000).toISOString();
  const lista = [
    { id: 1, purchase_count: 6, last_purchase_at: novo, telefone: "11999990001" },
    { id: 2, purchase_count: 0, last_purchase_at: null, telefone: "" },
    { id: 3, purchase_count: 2, last_purchase_at: velho, telefone: "11999990003", do_not_contact_at: novo },
    { id: 4, purchase_count: null, last_purchase_at: null, telefone: null },
  ];
  const ids = (key) => filtrarClientes(lista, key).map((c) => c.id);
  assert.deepEqual(ids("todos"), [1, 2, 3, 4]);
  assert.deepEqual(ids("fieis"), [1]);
  assert.deepEqual(ids("nunca"), [2, 4]);
  assert.deepEqual(ids("sumidos"), [3]);
  assert.deepEqual(ids("sem_telefone"), [2, 4]);
  assert.deepEqual(ids("nao_chamar"), [3]);
  assert.deepEqual(ids("inexistente"), [1, 2, 3, 4]);
});

test("5 tipos, na ordem da RPC", () => {
  assert.deepEqual(ACTION_ORDER, ["voltou_a_falar", "quase_comprou", "repetir", "primeira_compra", "sumido"]);
  for (const key of ACTION_ORDER) assert.equal(ACTION_TYPES[key].key, key);
});

console.log(`customerActions: ok (${passed} testes)`);
