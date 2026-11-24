// node src/lib/promocaoRegras.test.mjs
// Paridade com o banco: os textos esperados abaixo foram gerados pelo public.promocao_texto em 10/11/2026
// (apps/dashboard/.tmp/cardapio-2026-11-10/fixture-promos.mjs --sql, evo sem estoque = sem "(de R$ ...)").
// Fixture: os 26 textos de promoção da rede em 10/11/2026 convertidos à mão; 7 cabem nos 2 tipos da v1.
import assert from "node:assert/strict";
import { erroDaRegra, textoDaRegra, precoNormal, limparRegra, regraAtiva, regraVazia, regrasAtivas, trocaRegra, tiraRegra, produtosDivididos, textoDasRegras, MAX_PROMOS, itemVendavel, nomesDoItem, listaOu, regraVendavel } from "./promocaoRegras.js";

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

// ---------- 19/11/2026: item à escolha no kit (site/pedido/supabase/2026-11-19-kit-item-escolha.sql) ----------
// Esperados = saída do banco novo numa transação que não grava (site/pedido/tests/prova-kit-escolha.mjs --textos, estoque real do Imirim em 19/11).
const NRM = NR, NRC = "Nhoque Recheado com Calabresa - 700g", RO5 = "Rondelli 4 Queijos - 500g Fatiado", LAS = "Massa de Lasanha - 500g";
const MAR = "Molho de Tomate Mariolla - 250g", C4Q = "Canelone 4 Queijos - 700g", NB5 = "Nhoque de Batata - 500g", ESC = "Molho Caseiro - 500g";
const ESTOQUE19 = [
  { produto: NB, preco: 30 }, { produto: NB5, preco: 16 }, { produto: MAR, preco: 12 }, { produto: MC, preco: 11 }, { produto: NRM, preco: 42 },
  { produto: NRC, preco: 40 }, { produto: RO5, preco: 34 }, { produto: LAS, preco: 14 }, { produto: RO, preco: 42 }, { produto: C4Q, preco: 42 },
  { produto: ESC, preco: 18, visivel: false },
];
const fx = (product_name, qtd = 1) => ({ product_name, qtd });
const esc = (rotulo, opcoes, qtd = 1) => ({ escolha: true, rotulo, opcoes, qtd });
const kit = (nome, itens, preco, extra = {}) => ({ tipo: "kit", nome, itens, preco, vale_ate: null, ...extra });
const E1 = kit("Kit Natal à escolha", [fx(NB), esc("Massa recheada 700g", [NRM, RO5, LAS]), fx(MAR, 2)], 80);
const E2 = kit("2 massas à escolha", [esc("Massa recheada 700g", [NRM, NRC, C4Q], 2)], 76);
const E3 = kit("Kit Molhos", [fx(NB), esc("Molho 250g", [MAR, MC])], 36, { vale_ate: "2026-12-31" });

t("item à escolha: texto igual ao do banco (opções à venda, '(de R$)' pela mais cara)", () => {
  assert.equal(textoDaRegra(E1, ESTOQUE19), "Kit Natal à escolha: 1 Nhoque de Batata - 1kg + 1 Massa recheada 700g à escolha (Nhoque Recheado com Mussarela - 700g, Rondelli 4 Queijos - 500g Fatiado ou Massa de Lasanha - 500g) + 2 Molho de Tomate Mariolla - 250g por R$ 80,00 (de R$ 96,00).");
  assert.equal(textoDaRegra(E2, ESTOQUE19), "2 massas à escolha: 2 Massa recheada 700g à escolha (Nhoque Recheado com Mussarela - 700g, Nhoque Recheado com Calabresa - 700g ou Canelone 4 Queijos - 700g) por R$ 76,00 (de R$ 84,00).");
  assert.equal(textoDaRegra(E3, ESTOQUE19), "Kit Molhos: 1 Nhoque de Batata - 1kg + 1 Molho 250g à escolha (Molho de Tomate Mariolla - 250g ou Molho Caseiro 250g) por R$ 36,00 (de R$ 42,00). Válido até 31/12/2026.");
  assert.equal(textoDaRegra(E1, []), "Kit Natal à escolha: 1 Nhoque de Batata - 1kg + 1 Massa recheada 700g à escolha (Nhoque Recheado com Mussarela - 700g, Rondelli 4 Queijos - 500g Fatiado ou Massa de Lasanha - 500g) + 2 Molho de Tomate Mariolla - 250g por R$ 80,00.", "sem estoque: todas as opções, sem 'de R$'");
  const semRondelli = ESTOQUE19.map((p) => (p.produto === RO5 ? { ...p, visivel: false } : p));
  assert.equal(textoDaRegra(E1, semRondelli), "Kit Natal à escolha: 1 Nhoque de Batata - 1kg + 1 Massa recheada 700g à escolha (Nhoque Recheado com Mussarela - 700g ou Massa de Lasanha - 500g) + 2 Molho de Tomate Mariolla - 250g por R$ 80,00 (de R$ 96,00).", "opção escondida sai do texto (igual ao banco)");
  assert.equal(textoDasRegras([E1, E2, E3], ESTOQUE19).split("\n").length, 3);
  assert.equal(textoDaRegra(K1, ESTOQUE12), "Kit Natal 1: 1 Nhoque de Batata - 1kg + 1 Nhoque Recheado com Mussarela - 700g + 1 Molho Caseiro 250g por R$ 70,00 (de R$ 83,00).", "kit fixo: como sempre");
});

t("item à escolha: preço normal pela opção mais cara; ainda vende com UMA opção à venda", () => {
  assert.equal(precoNormal(E1, ESTOQUE19), 96);
  assert.equal(precoNormal(E2, ESTOQUE19), 84);
  assert.equal(precoNormal(kit("x", [esc("Massa", ["Não existe", "Nem esta"])], 10), ESTOQUE19), null);
  assert.equal(itemVendavel(E1.itens[1], ESTOQUE19), true);
  assert.equal(itemVendavel(esc("Molho", [ESC, "Não existe"]), ESTOQUE19), false, "só opção escondida ou fora = não vende");
  assert.equal(itemVendavel(fx(NB), ESTOQUE19), true);
  assert.deepEqual(nomesDoItem(E1.itens[1]), [NRM, RO5, LAS]);
  assert.deepEqual(nomesDoItem(fx(NB)), [NB]);
  assert.equal(listaOu(["A", "B", "C"]), "A, B ou C");
  assert.equal(listaOu(["A", "B"]), "A ou B");
  assert.equal(listaOu(["A"]), "A");
});

t("item à escolha: mesmas mensagens e ordem do promocao_regra_erro (casos de prova-kit-escolha.mjs § 9)", () => {
  const H = "2026-11-19";
  const LEVE = { tipo: "percentual", nome: "Leve 3 nhoques", itens: [fx(NB), fx(NB5)], min_qtd: 3, pct: 10, vale_ate: null };
  const casos = [
    [E1, null], [E2, null],
    [kit("Kit x", [fx(NB), esc("Ma", [NRM, RO5])], 60), "Dê um nome ao item à escolha (ex.: Massa recheada 700g)."],
    [kit("Kit x", [fx(NB), esc("M".repeat(41), [NRM, RO5])], 60), "Dê um nome ao item à escolha (ex.: Massa recheada 700g)."],
    [kit("Kit x", [fx(NB), esc("Massa recheada", [NRM])], 60), "Escolha pelo menos 2 opções para o item à escolha."],
    [kit("Kit x", [fx(NB), { escolha: true, rotulo: "Massa recheada", qtd: 1 }], 60), "Escolha pelo menos 2 opções para o item à escolha."],
    [kit("Kit x", [fx(NB), esc("Massa recheada", Array.from({ length: 31 }, (_, i) => "Produto " + i))], 60), "No máximo 30 opções no item à escolha."],
    [kit("Kit x", [fx(NB), esc("Massa recheada", [NRM, 5])], 60), "Promoção em formato inválido."],
    [{ ...LEVE, itens: [fx(NB), esc("Massa recheada", [NRM, RO5])] }, "Item à escolha só vale no kit."],
    [kit("Kit x", [fx(NRM), esc("Massa recheada", [NRM, RO5])], 60), "O mesmo produto aparece duas vezes."],
    [kit("Kit x", [esc("Massa A", [NRM, RO5]), esc("Massa B", [NRC, RO5])], 60), "O mesmo produto aparece duas vezes."],
    [kit("Kit x", [fx(NB), esc("Massa recheada", [NRM, "Sofioli de Marte - 700g"])], 60), 'O produto "Sofioli de Marte - 700g" não está no seu estoque.'],
    [kit("Kit x", [fx(NB), esc("Molho", [MAR, ESC])], 35), `O produto "${ESC}" está escondido do cardápio.`],
    [kit("Kit x", [fx(NB), esc("Massa recheada", [NRM, RO5], 0)], 60), "Quantidade de cada produto: de 1 a 20."],
    [kit("Kit x", [fx(NB), esc("Massa recheada", [NRM, RO5], 21)], 60), "Quantidade de cada produto: de 1 a 20."],
    [kit("Kit x", [esc("Massa recheada", [NRM, RO5])], 35), "O kit precisa de pelo menos 2 itens."],
    [{ ...E1, preco: 96 }, "O preço do kit precisa ser menor que o preço normal."],
    [{ ...E1, preco: 62.4 }, null],
    [{ ...E1, preco: 62 }, "O desconto passou de 35%."],
    [kit("Kit x", [fx(NB), fx(NB5), fx(MAR), fx(MC), fx(RO), fx(C4Q), esc("Massa recheada", [NRM, RO5])], 200), "No máximo 6 produtos na promoção."],
    [kit("Kit x", [fx("Xis"), esc("Massa recheada", [NRM, "Ypsilon"])], 60), 'O produto "Xis" não está no seu estoque.'],
  ];
  casos.forEach(([r, esperado], i) => assert.equal(erroDaRegra(r, ESTOQUE19, H), esperado, `caso ${i}`));
});

t("item à escolha: limparRegra guarda escolha/rotulo/opcoes/qtd; produtos divididos olham as opções", () => {
  assert.deepEqual(limparRegra({ ...E1, preco: "80" }).itens[1], { escolha: true, rotulo: "Massa recheada 700g", opcoes: [NRM, RO5, LAS], qtd: 1 });
  assert.deepEqual(limparRegra({ ...E1, itens: [{ escolha: true, rotulo: "  Massa  ", opcoes: [NRM, RO5], qtd: "2", extra: 1 }] }).itens[0], { escolha: true, rotulo: "Massa", opcoes: [NRM, RO5], qtd: 2 });
  assert.deepEqual(limparRegra(K1), { tipo: "kit", nome: "Kit Natal 1", itens: K1.itens, vale_ate: null, preco: 70 }, "kit fixo: como sempre");
  const d = produtosDivididos([E1, E2, K1], 0);
  assert.deepEqual(d.map((x) => x.produto), [NB, NRM]);
  assert.deepEqual(d[1].com, ["2 massas à escolha", "Kit Natal 1"]);
  assert.deepEqual(produtosDivididos([E1, E2, K1], 1).map((x) => x.produto), [NRM]);
});

// 24/11/2026: "Compre N, ganhe 1 brinde" (Suzano). Textos e mensagens esperados = saída do banco (public.promocao_texto_um /
// promocao_regra_erro) com o estoque da Suzano em 24/11 (site/pedido/supabase/2026-11-24a-promocao-brinde.sql, teste em transação desfeita).
const SUZ_700 = ["Canelone 4 Queijos - 700g", "Canelone Brócolis e Mussarela - 700g", "Canelone Frango e Requeijão - 700g", "Canelone Presunto e Mussarela - 700g",
  "Conchiglione 4 Queijos - 700g", "Conchiglione Brócolis e Mussarela - 700g", "Conchiglione Frango e Requeijão - 700g", "Conchiglione Presunto e Mussarela - 700g",
  "Nhoque Recheado com 4 Queijos - 700g", "Nhoque Recheado com Calabresa - 700g", "Nhoque Recheado com Mussarela - 700g", "Nhoque Recheado com Presunto e Mussarela - 700g",
  "Rondelli 4 Queijos - 700g Rolo", "Rondelli Brócolis e Mussarela - 700g Rolo", "Rondelli Frango e Requeijão - 700g Rolo", "Rondelli Presunto e Mussarela - 700g Rolo",
  "Sofioli 4 Queijos - 700g", "Sofioli Brócolis e Mussarela - 700g", "Sofioli Frango e Requeijão - 700g", "Sofioli Presunto e Mussarela - 700g"];
const SUZ = [
  ...SUZ_700.map((p, i) => ({ id: i, produto: p, preco: /4 Queijos|Mussarela - 700g$/.test(p) && !/Brócolis|Presunto/.test(p) ? 44.9 : 39.9, ativo: true })),
  { id: 90, produto: "Nhoque de Batata - 500g", preco: 19.9, ativo: true },
  { id: 91, produto: "Bolsa Térmica", preco: 15.45, ativo: true, visivel: false },
  { id: 92, produto: "Massa de Pastel - 500g (rolo)", preco: 14.9, ativo: true },
  { id: 93, produto: "Nhoque Recheado com 4 Queijos - 700g", preco: 44.9, ativo: true },
];
const BF = { tipo: "brinde", nome: "Black Friday", min_qtd: 4, itens: SUZ_700.map((p) => ({ product_name: p, qtd: 1 })), brinde: { product_name: "Nhoque de Batata - 500g" }, vale_ate: "2026-11-27" };

t("brinde: texto igual ao do banco", () => {
  assert.equal(textoDaRegra(BF, SUZ), "Black Friday: na compra de 4 ou mais, somando " + SUZ_700.slice(0, -1).join(", ") + " ou " + SUZ_700[19]
    + ", ganhe 1 Nhoque de Batata - 500g grátis. Limite de 1 brinde por pedido. Válido até 27/11/2026.");
  assert.equal(textoDaRegra({ ...BF, itens: [{ product_name: "Canelone Frango e Requeijão - 700g", qtd: 1 }] }, SUZ),
    "Black Friday: na compra de 4 ou mais Canelone Frango e Requeijão - 700g, ganhe 1 Nhoque de Batata - 500g grátis. Limite de 1 brinde por pedido. Válido até 27/11/2026.");
});

t("brinde: mesmas mensagens do promocao_regra_erro", () => {
  const H = "2026-11-24";
  const casos = [
    [BF, null],
    [{ ...BF, min_qtd: 1 }, "Quantas: de 2 a 10."],
    [{ ...BF, brinde: null }, "Escolha o produto do brinde."],
    [{ ...BF, brinde: { product_name: SUZ_700[0] } }, "O brinde não pode ser um dos produtos que contam."],
    [{ ...BF, brinde: { product_name: "Xyz" } }, 'O brinde "Xyz" não está no seu estoque.'],
    [{ ...BF, brinde: { product_name: "Bolsa Térmica" } }, 'O brinde "Bolsa Térmica" está escondido do cardápio.'],
    [{ tipo: "brinde", nome: "Teste", min_qtd: 2, itens: [{ product_name: "Massa de Pastel - 500g (rolo)", qtd: 1 }], brinde: { product_name: "Nhoque Recheado com 4 Queijos - 700g" } }, "O brinde passou de 35% da compra mínima."],
    [{ ...BF, itens: Array.from({ length: 31 }, (_, i) => ({ product_name: "P" + i, qtd: 1 })) }, "No máximo 30 produtos na promoção."],
    [{ ...BF, itens: [...BF.itens, { escolha: true, rotulo: "Massa", opcoes: ["a", "b"], qtd: 1 }] }, "Item à escolha só vale no kit."],
  ];
  casos.forEach(([r, esperado], i) => assert.equal(erroDaRegra(r, SUZ, H), esperado, `caso ${i}`));
});

t("brinde: limparRegra e regraVendavel (um sabor escondido não derruba; sem o brinde, para)", () => {
  assert.deepEqual(limparRegra({ ...BF, itens: [{ product_name: "A", qtd: 3 }], pct: 9, preco: 1 }),
    { tipo: "brinde", nome: "Black Friday", itens: [{ product_name: "A", qtd: 1 }], vale_ate: "2026-11-27", min_qtd: 4, brinde: { product_name: "Nhoque de Batata - 500g" } });
  assert.equal(regraVendavel(BF, SUZ), true);
  assert.equal(regraVendavel({ ...BF, itens: [...BF.itens, { product_name: "Bolsa Térmica", qtd: 1 }] }, SUZ), true);
  assert.equal(regraVendavel({ ...BF, brinde: { product_name: "Bolsa Térmica" } }, SUZ), false);
  assert.equal(regraVendavel({ tipo: "kit", itens: [{ product_name: SUZ_700[0], qtd: 1 }, { product_name: "Bolsa Térmica", qtd: 1 }] }, SUZ), false);
  assert.equal(regraVazia("brinde").brinde, null);
});

console.log(`promocaoRegras: ${n} testes ok`);
