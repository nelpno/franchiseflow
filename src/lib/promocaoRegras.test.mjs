// node src/lib/promocaoRegras.test.mjs
// Paridade com o banco: os textos esperados abaixo foram gerados pelo public.promocao_texto em 10/11/2026
// (apps/dashboard/.tmp/cardapio-2026-11-10/fixture-promos.mjs --sql, evo sem estoque = sem "(de R$ ...)").
// Fixture: os 26 textos de promoção da rede em 10/11/2026 convertidos à mão; 7 cabem nos 2 tipos da v1.
import assert from "node:assert/strict";
import { erroDaRegra, textoDaRegra, precoNormal, limparRegra, regraAtiva, regraVazia, regrasAtivas, trocaRegra, tiraRegra, produtosDivididos, textoDasRegras, MAX_PROMOS } from "./promocaoRegras.js";

let n = 0; const t = (nome, f) => { f(); n++; };
const R = (tipo, nome, itens, extra) => ({ tipo, nome, itens: itens.map(([product_name, qtd]) => ({ product_name, qtd })), vale_ate: null, ...extra });

const REDE = [
  ["franquiaassissp", null], ["franquiabragancapaulistasp", null], ["franquiacajamarsp", null], ["franquiacampinassp", null],
  ["franquiaguarulhossp", R("kit", "Combo Rondelli (serve 5)", [["Rondelli Presunto e Mussarela - 700g Rolo", 1], ["Rondelli Frango e Requeijão - 700g Rolo", 1]], { preco: 72 }),
    "Combo Rondelli (serve 5): 1 Rondelli Presunto e Mussarela - 700g Rolo + 1 Rondelli Frango e Requeijão - 700g Rolo por R$ 72,00."],
  ["franquiaitapolissp", null], ["franquiaitatibasp", null], ["franquiaitusp", null], ["franquiajundiaisp", null],
  ["franquialemesp", R("kit", "Combo Conchiglione para 5", [["Conchiglione 4 Queijos - 700g", 1], ["Conchiglione Frango e Requeijão - 700g", 1]], { preco: 79 }),
    "Combo Conchiglione para 5: 1 Conchiglione 4 Queijos - 700g + 1 Conchiglione Frango e Requeijão - 700g por R$ 79,00."],
  ["franquiamauasp", null], ["franquianovaodessasp", null], ["franquiaosascosp", null],
  ["franquiapiratiningasp", R("kit", "2 Rondelli 4 Queijos", [["Rondelli 4 Queijos - 700g Rolo", 2]], { preco: 80 }),
    "2 Rondelli 4 Queijos: 2 Rondelli 4 Queijos - 700g Rolo por R$ 80,00."],
  ["franquiarioclarosp", R("kit", "Combo fim de semana", [["Nhoque Recheado com 4 Queijos - 700g", 1], ["Canelone Presunto e Mussarela - 700g", 1]], { preco: 79 }),
    "Combo fim de semana: 1 Nhoque Recheado com 4 Queijos - 700g + 1 Canelone Presunto e Mussarela - 700g por R$ 79,00."],
  ["franquiasantoandresp1", null], ["franquiasaopaulosp1", null],
  ["franquiasaopaulosp10", R("percentual", "Leve 2 kg de nhoque", [["Nhoque de Batata - 1kg", 1]], { min_qtd: 2, pct: 5, vale_ate: "2026-11-13" }),
    "Leve 2 Nhoque de Batata - 1kg ou mais e ganhe 5% de desconto. Válido até 13/11/2026."],
  ["franquiasaopaulosp13", null],
  ["franquiasaopaulosp14", R("kit", "2 massas de lasanha", [["Massa de Lasanha - 500g", 2]], { preco: 30 }),
    "2 massas de lasanha: 2 Massa de Lasanha - 500g por R$ 30,00."],
  ["franquiasaopaulosp17", null], ["franquiasaopaulosp18", null],
  ["franquiasaopaulosp2", R("kit", "Combo de batata", [["Nhoque de Batata - 1kg", 1], ["Molho Caseiro à Bolonhesa - 500g", 1], ["Molho Caseiro ao Sugo - 500g", 1], ["Queijo Ralado 50g", 1], ["Guaraná 1L", 1]], { preco: 74, vale_ate: "2026-11-30" }),
    "Combo de batata: 1 Nhoque de Batata - 1kg + 1 Molho Caseiro à Bolonhesa - 500g + 1 Molho Caseiro ao Sugo - 500g + 1 Queijo Ralado 50g + 1 Guaraná 1L por R$ 74,00. Válido até 30/11/2026."],
  ["franquiasaopaulosp5", null], ["franquiasorocabasp1", null], ["franquiaubatubasp", null],
];

t("fixture: 26 textos da rede, 7 cabem nos 2 tipos da v1", () => {
  assert.equal(REDE.length, 26);
  assert.equal(REDE.filter((r) => r[1]).length, 7);
});

t("texto igual ao do banco (sem estoque = sem 'de R$')", () => {
  for (const [evo, regra, esperado] of REDE) if (regra) assert.equal(textoDaRegra(regra, []), esperado, evo);
  assert.equal(textoDaRegra(R("percentual", "Leve 3 nhoques", [["Nhoque de Batata - 1kg", 1], ["Nhoque de Batata - 500g", 1]], { min_qtd: 3, pct: 10 }), []),
    "Leve 3 ou mais, somando Nhoque de Batata - 1kg e Nhoque de Batata - 500g, e ganhe 10% de desconto.");
});

// estoque do Imirim em 10/11/2026 (preços reais)
const IMIRIM = [
  { produto: "Nhoque de Batata - 1kg", preco: 30 }, { produto: "Nhoque de Batata - 500g", preco: 16 },
  { produto: "Molho Caseiro - 500g", preco: 18 }, { produto: "Molho Caseiro 250g", preco: 11 },
  { produto: "Inativo", preco: 10, ativo: false },
];
const KIT = R("kit", "Kit Nhoque com molho", [["Nhoque de Batata - 1kg", 1], ["Molho Caseiro - 500g", 1]], { preco: 42, vale_ate: "2026-11-30" });

t("kit com preço real: '(de R$ 48,00)' igual ao banco (ESPEC 4.6)", () => {
  assert.equal(textoDaRegra(KIT, IMIRIM), "Kit Nhoque com molho: 1 Nhoque de Batata - 1kg + 1 Molho Caseiro - 500g por R$ 42,00 (de R$ 48,00). Válido até 30/11/2026.");
  assert.equal(precoNormal(KIT, IMIRIM), 48);
  assert.equal(precoNormal(R("kit", "x", [["Nhoque de Batata - 1kg", 2], ["Molho Caseiro 250g", 1]]), IMIRIM), 71);
  assert.equal(precoNormal(R("kit", "x", [["Não existe", 1]]), IMIRIM), null);
});

t("validação: mesmas mensagens e ordem do promocao_regras_erro", () => {
  const H = "2026-11-10";
  assert.equal(erroDaRegra(KIT, IMIRIM, H), null);
  assert.equal(erroDaRegra({ ...KIT, preco: 30 }, IMIRIM, H), "O desconto passou de 35%.");
  assert.equal(erroDaRegra({ ...KIT, preco: 31.2 }, IMIRIM, H), null, "35% exato passa");
  assert.equal(erroDaRegra({ ...KIT, preco: 48 }, IMIRIM, H), "O preço do kit precisa ser menor que o preço normal.");
  assert.equal(erroDaRegra({ ...KIT, preco: null }, IMIRIM, H), "Digite o preço do kit.");
  assert.equal(erroDaRegra({ ...KIT, itens: [{ product_name: "Nhoque de Batata - 1kg", qtd: 1 }], preco: 20 }, IMIRIM, H), "O kit precisa de pelo menos 2 itens.");
  assert.equal(erroDaRegra({ ...KIT, nome: "K" }, IMIRIM, H), "O nome da promoção precisa ter de 3 a 40 letras.");
  assert.equal(erroDaRegra({ ...KIT, itens: [] }, IMIRIM, H), "Escolha pelo menos um produto.");
  assert.equal(erroDaRegra({ ...KIT, itens: [{ product_name: "Inativo", qtd: 2 }] }, IMIRIM, H), 'O produto "Inativo" não está no seu estoque.');
  assert.equal(erroDaRegra({ ...KIT, itens: [KIT.itens[0], KIT.itens[0]] }, IMIRIM, H), "O mesmo produto aparece duas vezes.");
  const escondido = IMIRIM.map((p) => (p.produto === "Molho Caseiro - 500g" ? { ...p, visivel: false } : p));
  assert.equal(erroDaRegra(KIT, escondido, H), 'O produto "Molho Caseiro - 500g" está escondido do cardápio.', "igual ao SQL da revisão");
  assert.equal(erroDaRegra({ ...KIT, itens: [{ product_name: "Nhoque de Batata - 1kg", qtd: 21 }] }, IMIRIM, H), "Quantidade de cada produto: de 1 a 20.");
  assert.equal(erroDaRegra({ ...KIT, vale_ate: "2026-11-09" }, IMIRIM, H), "A data de validade já passou.");
  assert.equal(erroDaRegra({ ...KIT, vale_ate: "2026-11-10" }, IMIRIM, H), null, "vence hoje ainda vale");
  const LEVE = REDE.find((r) => r[0] === "franquiasaopaulosp10")[1];
  assert.equal(erroDaRegra(LEVE, IMIRIM, H), null);
  assert.equal(erroDaRegra({ ...LEVE, pct: 40 }, IMIRIM, H), "Desconto: de 1% a 35%, número inteiro.");
  assert.equal(erroDaRegra({ ...LEVE, pct: 5.5 }, IMIRIM, H), "Desconto: de 1% a 35%, número inteiro.");
  assert.equal(erroDaRegra({ ...LEVE, min_qtd: 1 }, IMIRIM, H), "Quantas: de 2 a 10.");
  assert.equal(erroDaRegra({ ...LEVE, tipo: "frete" }, IMIRIM, H), "Escolha o tipo da promoção.");
});

t("limparRegra: só os campos do tipo; Leve N grava qtd 1; números como número", () => {
  assert.deepEqual(limparRegra({ ...KIT, nome: "  Kit  ", preco: "42", min_qtd: 9 }), { tipo: "kit", nome: "Kit", itens: KIT.itens, vale_ate: "2026-11-30", preco: 42 });
  assert.deepEqual(limparRegra({ tipo: "percentual", nome: "Leve", itens: [{ product_name: "A", qtd: 3 }], min_qtd: "2", pct: "5", preco: 9 }),
    { tipo: "percentual", nome: "Leve", itens: [{ product_name: "A", qtd: 1 }], vale_ate: null, min_qtd: 2, pct: 5 });
});

t("regraAtiva / regraVazia", () => {
  assert.equal(regraAtiva([]), null);
  assert.equal(regraAtiva(null), null);
  assert.equal(regraAtiva([KIT]), KIT);
  assert.equal(regraVazia("percentual").min_qtd, 2);
  assert.equal(regraVazia().tipo, "kit");
});

// ---------- 12/11/2026: até 3 promoções (site/pedido/supabase/2026-11-12a-promocoes-varias.sql) ----------
const NB = "Nhoque de Batata - 1kg", NR = "Nhoque Recheado com Mussarela - 700g", MC = "Molho Caseiro 250g", RO = "Rondelli 4 Queijos - 700g Rolo";
const ESTOQUE12 = [{ produto: NB, preco: 30 }, { produto: NR, preco: 42 }, { produto: MC, preco: 11 }, { produto: RO, preco: 42 }];
const K1 = R("kit", "Kit Natal 1", [[NB, 1], [NR, 1], [MC, 1]], { preco: 70 });
const K2 = R("kit", "Kit Natal 2", [[NB, 1], [NR, 2], [MC, 1]], { preco: 100 });
const K3 = R("kit", "Kit Rondelli", [[RO, 2]], { preco: 70 });

t("3 promoções: o texto do robô é uma linha por promoção, igual ao gerado pelo banco (public.promocao_texto no teste 12a)", () => {
  assert.equal(textoDasRegras([K1, K2, K3], ESTOQUE12),
    "Kit Natal 1: 1 Nhoque de Batata - 1kg + 1 Nhoque Recheado com Mussarela - 700g + 1 Molho Caseiro 250g por R$ 70,00 (de R$ 83,00).\n"
    + "Kit Natal 2: 1 Nhoque de Batata - 1kg + 2 Nhoque Recheado com Mussarela - 700g + 1 Molho Caseiro 250g por R$ 100,00 (de R$ 125,00).\n"
    + "Kit Rondelli: 2 Rondelli 4 Queijos - 700g Rolo por R$ 70,00 (de R$ 84,00).");
  assert.equal(textoDasRegras([K1], ESTOQUE12), textoDaRegra(K1, ESTOQUE12), "com 1 promoção é o texto de sempre");
  assert.equal(textoDasRegras([], ESTOQUE12), null);
});

t("limite de 3 e nome que não repete (mesmas mensagens do banco)", () => {
  const H = "2026-11-12";
  assert.equal(MAX_PROMOS, 3);
  assert.equal(erroDaRegra(K3, ESTOQUE12, H, [K1, K2]), null, "a 3ª cabe");
  assert.equal(erroDaRegra(K3, ESTOQUE12, H, [K1, K2, K2]), "No máximo 3 promoções ao mesmo tempo. Encerre uma para criar outra.");
  assert.equal(erroDaRegra({ ...K3, nome: "  kit natal 1 " }, ESTOQUE12, H, [K1]), "Duas promoções com o mesmo nome. Dê um nome diferente a cada uma.");
  assert.equal(erroDaRegra(K3, ESTOQUE12, H), null, "sem 'outras' vale como antes");
});

t("lista: trocar, acrescentar, tirar (as outras não mudam, a ordem fica)", () => {
  const novo = { ...K2, preco: 95 };
  assert.deepEqual(trocaRegra([K1, K2, K3], 1, novo), [K1, novo, K3]);
  assert.deepEqual(trocaRegra([K1], -1, K2), [K1, K2]);
  assert.deepEqual(tiraRegra([K1, K2, K3], 0), [K2, K3]);
  assert.deepEqual(tiraRegra([K1], 0), []);
  assert.deepEqual(regrasAtivas(null), []);
  assert.deepEqual(regrasAtivas([K1, null]), [K1]);
});

t("produtos divididos entre promoções (aviso na tela)", () => {
  const d = produtosDivididos([K1, K2, K3], 0);
  assert.deepEqual(d.map((x) => x.produto), [NB, NR, MC]);
  assert.deepEqual(d[0].com, ["Kit Natal 2"]);
  assert.deepEqual(produtosDivididos([K1, K2, K3], 2), [], "o Kit Rondelli não divide nada");
  assert.deepEqual(produtosDivididos([K1], 0), []);
});

console.log(`promocaoRegras: ${n} testes ok`);
