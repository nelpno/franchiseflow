// node src/lib/cardapioArte.test.mjs
import assert from "node:assert/strict";
import * as A from "./cardapioArte.js";
const { grafia, saborDe, linhasPorPreco, nomeDaUnidade, linhaAtendimento, RECHEADAS } = A;
// o peso sai com espaço fixo ( , para "500 g" não quebrar na arte); o teste compara com espaço comum
const semNb = (f) => (...a) => JSON.parse(JSON.stringify(f(...a) ?? null).replaceAll(" ", " "));
const pesoDe = semNb(A.pesoDe), montarCardapio = semNb(A.montarCardapio), dadosDoCardapio = semNb(A.dadosDoCardapio);

let n = 0; const t = (nome, f) => { f(); n++; };
const AGORA = new Date("2026-11-12T15:00:00Z");
const P = (produto, preco, extra = {}) => ({ produto, preco, visivel: true, zerado: false, zerado_desde: null, ...extra });

t("peso: g, kg, kl, ml, sem peso", () => {
  assert.equal(A.pesoDe("Nhoque de Batata - 1kg").texto, "1 kg", "espaço fixo entre número e unidade");
  assert.deepEqual(pesoDe("Sofioli 4 Queijos - 700g")?.gramas, 700);
  assert.equal(pesoDe("Nhoque de Batata - 1kg")?.texto, "1 kg");
  assert.equal(pesoDe("LASANHA A BOLONHESA - 1 KL")?.gramas, 1000);
  assert.equal(pesoDe("Molho de Tomate Sugo - 500ML")?.texto, "500 ml");
  assert.equal(pesoDe("Lasanha à Bolonhesa - 1,2kg")?.texto, "1,2 kg");
  assert.equal(pesoDe("Pão de queijo chocolate"), null);
});

t("grafia: muçarela, requeijão, só a 1ª maiúscula", () => {
  assert.equal(grafia("Brócolis e Mussarela"), "Brócolis e muçarela");
  assert.equal(grafia("Frango e Requeijao"), "Frango e requeijão");
  assert.equal(grafia("4 Queijos"), "4 queijos");
});

t("sabor: tira família, peso, rolo/fatiado e conectivo", () => {
  const nh = RECHEADAS.find((f) => f.chave === "nhoque_recheado").re;
  assert.equal(saborDe("Nhoque Recheado com Presunto e Mussarela - 700g", nh), "Presunto e muçarela");
  const ro = RECHEADAS.find((f) => f.chave === "rondelli").re;
  assert.equal(saborDe("Rondelli Brócolis e Mussarela - 700g Rolo", ro), "Brócolis e muçarela");
  assert.equal(saborDe("Rondelli 4 Queijos - 500g Fatiado", ro), "4 queijos");
});

t("linhas por preço: junta os de mesmo preço, 4 queijos por último, mais barato antes", () => {
  const l = linhasPorPreco([
    { sabor: "4 queijos", preco: 45.8 }, { sabor: "Presunto e muçarela", preco: 39.8 },
    { sabor: "Brócolis e muçarela", preco: 39.8 }, { sabor: "Frango e requeijão", preco: 39.8 },
  ]);
  assert.deepEqual(l, [
    { rotulo: "Brócolis e muçarela, frango e requeijão, presunto e muçarela", preco: "39,80" },
    { rotulo: "4 queijos", preco: "45,80" },
  ]);
});

// Estoque de Uberaba em 12/11/2026 (o cardápio feito à mão para a Verônica é o gabarito)
const UBERABA = [
  P("Canelone 4 Queijos - 700g", 45.8), P("Canelone Brócolis e Mussarela - 700g", 39.8), P("Canelone Frango e Requeijão - 700g", 39.8),
  P("Canelone Presunto e Mussarela - 700g", 39.8), P("Conchiglione 4 Queijos - 700g", 45.8), P("Conchiglione Brócolis e Mussarela - 700g", 39.8),
  P("Conchiglione Frango e Requeijão - 700g", 39.8), P("Conchiglione Presunto e Mussarela - 700g", 39.8), P("Massa de Lasanha - 500g", 15),
  P("Massa de Pastel - 1kg (rolo)", 25.8), P("Massa de Pastel - 500g (rolo)", 13.8), P("Nhoque de Batata - 1kg", 27), P("Nhoque de Batata - 500g", 13.8),
  P("Nhoque Recheado com 4 Queijos - 700g", 45.8), P("Nhoque Recheado com Calabresa - 700g", 39.8), P("Nhoque Recheado com Mussarela - 700g", 45.8),
  P("Nhoque Recheado com Presunto e Mussarela - 700g", 39.8), P("Rondelli 4 Queijos - 500g Fatiado", 35), P("Rondelli 4 Queijos - 700g Rolo", 45.8),
  P("Rondelli Brócolis e Mussarela - 700g Rolo", 39.8), P("Rondelli Frango e Requeijão - 700g Rolo", 39.8), P("Rondelli Presunto e Mussarela - 500g Fatiado", 31.8),
  P("Rondelli Presunto e Mussarela - 700g Rolo", 39.8), P("Sofioli 4 Queijos - 700g", 45.8), P("Sofioli Brócolis e Mussarela - 700g", 39.8),
  P("Sofioli Frango e Requeijão - 700g", 39.8), P("Sofioli Presunto e Mussarela - 700g", 39.8), P("Molho de Tomate Sugo - 250g", 12.4),
  P("Pão de Queijo Tradicional - 1kg", 27.9),
];

t("Uberaba: 5 recheadas na ordem, com as linhas do cardápio feito à mão", () => {
  const c = montarCardapio(UBERABA, { agora: AGORA });
  assert.deepEqual(c.principais.map((p) => p.nome), ["Sofioli", "Rondelli", "Canelone", "Conchiglione", "Nhoque recheado"]);
  const nh = c.principais.find((p) => p.chave === "nhoque_recheado");
  assert.deepEqual(nh.linhas, [{ rotulo: "Calabresa, presunto e muçarela", preco: "39,80" }, { rotulo: "Muçarela, 4 queijos", preco: "45,80" }]);
  assert.equal(c.principais[1].linhas[0].rotulo, "Brócolis e muçarela, frango e requeijão, presunto e muçarela");
  assert.equal(c.total, UBERABA.length);
  assert.equal(c.outros, 0);
});

t("Uberaba: fatiado, nhoque de batata, pastel, lasanha, molho e pão de queijo embaixo", () => {
  const c = montarCardapio(UBERABA, { agora: AGORA });
  assert.deepEqual(c.grupos.map((g) => g.titulo), ["Rondelli fatiado 500 g", "Nhoque de batata", "Massa de pastel", "Massa de lasanha", "Molhos", "Pão de queijo"]);
  assert.deepEqual(c.grupos[0].linhas, [{ rotulo: "Presunto e muçarela", preco: "31,80" }, { rotulo: "4 queijos", preco: "35,00" }]);
  assert.deepEqual(c.grupos[1].linhas, [{ rotulo: "1 kg", preco: "27,00" }, { rotulo: "500 g", preco: "13,80" }]);
  assert.deepEqual(c.grupos[4].linhas, [{ rotulo: "Tomate sugo 250 g", preco: "12,40" }]);
  assert.equal(c.grupos[5].tipo, "pao");
  assert.deepEqual(c.grupos[5].linhas, [{ rotulo: "Tradicional 1 kg", preco: "27,90" }]);
});

t("fora do cardápio: escondido, sem preço, zerado há mais de 30 dias; zerado recente fica", () => {
  const c = montarCardapio([
    P("Sofioli 4 Queijos - 700g", 45.8, { visivel: false }),
    P("Sofioli Frango e Requeijão - 700g", 0),
    P("Pão de queijo goiaba", 43, { zerado: true, zerado_desde: "2026-09-16T13:06:26Z" }),
    P("Pão de queijo chocolate", 43, { zerado: true, zerado_desde: "2026-11-07T13:06:26Z" }),
  ], { agora: AGORA });
  assert.equal(c.principais.length, 0);
  assert.deepEqual(c.grupos.map((g) => g.linhas.map((l) => l.rotulo)), [["Chocolate"]]);
});

t("produto próprio da unidade: fora por padrão, conta em 'outros', entra com incluirOutros", () => {
  const lista = [P("Coca Cola 2 litros", 14), P("Açaí 1kg", 30), P("Sofioli 4 Queijos - 700g", 45.8)];
  const a = montarCardapio(lista, { agora: AGORA });
  assert.equal(a.outros, 2);
  assert.ok(!a.grupos.some((g) => g.chave === "outros"));
  const b = montarCardapio(lista, { agora: AGORA, incluirOutros: true });
  assert.deepEqual(b.grupos.find((g) => g.chave === "outros").linhas.map((l) => l.rotulo), ["Açaí 1kg", "Coca Cola 2 litros"]);
});

t("recheada fora dos 700 g vira grupo próprio; queijo ralado e pão de queijo de vários sabores", () => {
  const c = montarCardapio([
    P("Sofioli de Costela 500g", 32), P("Queijo Parmesão Ralado President 50g", 9.9),
    P("Pão de queijo palito/ tradicional", 30), P("Pão de queijo chocolate", 43), P("Pão de Queijo Recheado com Requeijão - 1Kg", 43),
  ], { agora: AGORA });
  assert.equal(c.principais.length, 0);
  assert.deepEqual(c.grupos.map((g) => g.titulo), ["Sofioli 500 g", "Queijo ralado", "Pão de queijo"]);
  assert.deepEqual(c.grupos[0].linhas, [{ rotulo: "Costela", preco: "32,00" }]);
  assert.equal(c.grupos[1].linhas[0].rotulo, "Parmesão Ralado President 50 g");
  assert.deepEqual(c.grupos[2].linhas.map((l) => l.rotulo), ["Palito/ tradicional", "Chocolate", "Requeijão 1 kg"]);
});

t("nome da unidade e linha de atendimento (endereço só de loja)", () => {
  assert.equal(nomeDaUnidade("Maxi Massas Cordeiro e Iracemápolis"), "Cordeiro e Iracemápolis");
  assert.equal(nomeDaUnidade("Maxi Massas", "Uberaba"), "Uberaba");
  assert.equal(linhaAtendimento({ temEntrega: true, temRetirada: true, ehLoja: false, rua: "Rua da Casa, 10" }), "Entrega e retirada");
  assert.equal(linhaAtendimento({ temEntrega: true, temRetirada: true, ehLoja: true, rua: "R. José Bonifácio, 364", bairro: "Leblon" }), "Entrega · Retirada na R. José Bonifácio, 364, Leblon");
  assert.equal(linhaAtendimento({ temEntrega: true, temRetirada: false }), "Entrega");
  assert.equal(linhaAtendimento({ temEntrega: false, temRetirada: true }), "Retirada");
});

t("dados: telefone, link e QR do cardápio digital ligado; sem cardápio o QR abre o WhatsApp", () => {
  const cfg = { franchise_name: "Maxi Massas Uberaba", has_pickup: true, pickup_is_store: true, street_address: "R. José Bonifácio, 364", neighborhood: "Leblon" };
  const a = dadosDoCardapio({ nome: "Maxi Massas Uberaba", ativo: true, url: "https://pedido.maximassas.com.br/uberaba/", whatsapp_pedido: "5534992387278", tem_entrega: true, produtos: UBERABA }, cfg, { agora: AGORA });
  assert.equal(a.unidade, "Uberaba");
  assert.equal(a.whatsapp, "(34) 99238-7278");
  assert.equal(a.link, "pedido.maximassas.com.br/uberaba");
  assert.equal(a.qrUrl, "https://pedido.maximassas.com.br/uberaba/?utm_source=cardapio&utm_medium=impresso");
  assert.equal(a.atendimento, "Entrega · Retirada na R. José Bonifácio, 364, Leblon");
  const b = dadosDoCardapio({ nome: "Maxi Massas X", ativo: false, url: "https://pedido.maximassas.com.br/x/", whatsapp_pedido: "19999142001", produtos: [] }, {}, { agora: AGORA });
  assert.equal(b.link, "");
  assert.match(b.qrUrl, /^https:\/\/wa\.me\/5519999142001\?text=/);
  const c = dadosDoCardapio({ produtos: [] }, {}, { agora: AGORA });
  assert.equal(c.qrUrl, ""); assert.equal(c.whatsapp, "");
});

console.log(`cardapioArte: ${n} testes ok`);
