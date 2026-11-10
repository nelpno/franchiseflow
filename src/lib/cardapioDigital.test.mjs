// node src/lib/cardapioDigital.test.mjs
import assert from "node:assert/strict";
import { situacaoProduto, resumoZerados, pendencias, especiaisDaSemana, vencimentoPromocao, linksDoCardapio, itensDoChecklist, podeLigarCardapio, familiaDe, diasDesde } from "./cardapioDigital.js";

let n = 0; const t = (nome, f) => { f(); n++; };
const AGORA = new Date("2026-11-10T15:00:00Z");
const H = "2026-11-10";
const P = (produto, extra = {}) => ({ produto, preco: 40, visivel: true, zerado: false, zerado_desde: null, ...extra });
const Z = (produto, desde) => P(produto, { zerado: true, zerado_desde: desde });

t("situação: escondido > fora (zerado há +30 dias) > acabou > no cardápio", () => {
  assert.equal(situacaoProduto(P("a"), AGORA), "no_cardapio");
  assert.equal(situacaoProduto(Z("a", "2026-11-08T10:00:00Z"), AGORA), "acabou");
  assert.equal(situacaoProduto(Z("a", "2026-10-11T16:00:00Z"), AGORA), "acabou", "29 dias e 23 h ainda aparece");
  assert.equal(situacaoProduto(Z("a", "2026-10-09T10:00:00Z"), AGORA), "fora");
  assert.equal(situacaoProduto(Z("a", "2026-10-10T14:00:00Z"), AGORA), "fora", "30 dias e 1 hora: a RPC já esconde");
  assert.equal(situacaoProduto({ ...Z("a", "2026-10-01T10:00:00Z"), visivel: false }, AGORA), "escondido");
  assert.equal(diasDesde(null, AGORA), null);
});

t("família pela 1ª parte do nome", () => {
  assert.equal(familiaDe("Conchiglione 4 Queijos - 700g"), "Conchiglione");
  assert.equal(familiaDe("Nhoque Recheado com Mussarela - 700g"), "Nhoque recheado");
  assert.equal(familiaDe("Nhoque de Batata - 1kg"), "Nhoque de batata");
  assert.equal(familiaDe("Açaí Fuzzy - pote 1.5l"), null);
});

const PRODUTOS = [
  Z("Conchiglione 4 Queijos - 700g", "2026-10-23T12:00:00Z"), Z("Conchiglione Frango e Requeijão - 700g", "2026-10-25T12:00:00Z"),
  P("Canelone Brócolis e Mussarela - 700g"), Z("Canelone 4 Queijos - 700g", "2026-11-08T12:00:00Z"),
  Z("Coca-Cola 600ml", "2026-10-05T12:00:00Z"), // fora (35 dias): não conta
  { ...Z("Sofioli 4 Queijos - 700g", "2026-10-29T12:00:00Z"), visivel: false }, // escondido: não conta
  P("Nhoque de Batata - 1kg"),
];

t("resumo dos zerados: só o que o cliente vê; família inteira zerada", () => {
  const z = resumoZerados(PRODUTOS, AGORA);
  assert.equal(z.acabou, 3);
  assert.equal(z.aparecem, 5);
  assert.deepEqual(z.familiasZeradas, ["Conchiglione"]);
  assert.deepEqual(z.foraHaMais30.map((p) => p.produto), ["Coca-Cola 600ml"]);
});

t("pendências: zerados com família, ≥ 40% em vermelho, link do estoque já filtrado", () => {
  const p = pendencias({ ativo: true, tem_whatsapp: true, link_bio_em: "2026-11-01", produtos: PRODUTOS, horario_especial: [] }, { hojeISO: H, agora: AGORA });
  assert.equal(p.length, 1);
  assert.equal(p[0].destaque, "3 de 5 produtos do cardápio estão em falta.");
  assert.equal(p[0].texto, "Conchiglione inteiro está em falta.");
  assert.equal(p[0].tom, "err");
  assert.equal(p[0].acao.to, "/Gestao?tab=estoque&nivel=zerado");
});

t("pendências: sem WhatsApp vem primeiro; bio só ligado e sem marcar; nada = lista vazia", () => {
  const base = { ativo: true, tem_whatsapp: false, link_bio_em: null, produtos: [P("a")], horario_especial: [] };
  assert.deepEqual(pendencias(base, { hojeISO: H, agora: AGORA }).map((x) => x.id), ["whatsapp", "bio"]);
  assert.deepEqual(pendencias({ ...base, ativo: false }, { hojeISO: H, agora: AGORA }).map((x) => x.id), ["whatsapp"]);
  assert.deepEqual(pendencias({ ...base, tem_whatsapp: true, link_bio_em: "2026-11-09" }, { hojeISO: H, agora: AGORA }), []);
});

t("horário especial da semana (Imirim 15/11, entrega + retirada = uma linha)", () => {
  const imirim = [
    { de: "2026-11-15", ate: "2026-11-15", tipo: "horario", abre: "09:00", fecha: "19:00", vale: "entrega" },
    { de: "2026-11-15", ate: "2026-11-15", tipo: "horario", abre: "09:00", fecha: "16:00", vale: "retirada" },
  ];
  assert.deepEqual(especiaisDaSemana(imirim, H), ["Horário especial de 15/11 vale para entrega e retirada."]);
  assert.deepEqual(especiaisDaSemana(imirim, "2026-11-08"), [], "fora da semana");
  assert.deepEqual(especiaisDaSemana([{ de: "2026-11-12", tipo: "fechado", vale: "ambos" }], H), ["Fechado em 12/11 (entrega e retirada): o cardápio não oferece esse dia."]);
});

t("vencimento: regra ou data no texto livre (o do Imirim vence 13/11)", () => {
  const txt = "Na compra de 2Kg de nhoques de batata ou mais, ganhe 5% de desconto, promoção válida até 13/11/26 ou até o final do estoque.";
  assert.deepEqual(vencimentoPromocao(null, txt, H), { iso: "2026-11-13", dias: 3, ddmm: "13/11" });
  assert.deepEqual(vencimentoPromocao({ vale_ate: "2026-11-30" }, txt, H), { iso: "2026-11-30", dias: 20, ddmm: "30/11" });
  assert.equal(vencimentoPromocao(null, "Combo sem data", H), null);
  const p = pendencias({ ativo: true, tem_whatsapp: true, link_bio_em: "x", produtos: [], horario_especial: [], promocao_regras: [], promocao_texto: txt }, { hojeISO: H, agora: AGORA });
  assert.equal(p[0].texto, "Promoção vence em 3 dias (13/11).");
});

t("links: divulgar com utm de bio, QR com utm de impresso, teste com mx_teste", () => {
  const l = linksDoCardapio("https://pedido.maximassas.com.br/imirim/");
  assert.equal(l.semProtocolo, "pedido.maximassas.com.br/imirim/");
  assert.equal(l.divulgar, "https://pedido.maximassas.com.br/imirim/?utm_source=bio&utm_medium=perfil");
  assert.equal(l.qr, "https://pedido.maximassas.com.br/imirim/?utm_source=qr&utm_medium=impresso");
  assert.equal(l.teste, "https://pedido.maximassas.com.br/imirim/?mx_teste=1");
  assert.equal(linksDoCardapio(null), null);
});

t("checklist (10f): vermelho, amarelo, verde; botão de arrumar só no que falta; pode ligar = sem trava aberta", () => {
  const ck = [
    { id: "whatsapp", nivel: "trava", ok: true, titulo: "WhatsApp da unidade", motivo: "ok" },
    { id: "robo", nivel: "aviso", ok: false, titulo: "Robô respondendo", motivo: "mudo" },
    { id: "pagamento_entrega", nivel: "trava", ok: false, titulo: "Formas de pagamento na entrega", motivo: "falta" },
    { id: "id_novo_do_banco", nivel: "trava", ok: false, titulo: "Coisa nova", motivo: "sem botão ainda" },
  ];
  const itens = itensDoChecklist({ checklist: ck });
  assert.deepEqual(itens.map((i) => [i.id, i.estado]), [["pagamento_entrega", "trava"], ["id_novo_do_banco", "trava"], ["robo", "aviso"], ["whatsapp", "ok"]]);
  assert.equal(itens[0].acao.to, "/FranchiseSettings?etapa=3");
  assert.equal(itens[1].acao, null); // item que o banco inventou depois: aparece, sem botão (não quebra)
  assert.equal(itens[3].acao, null);
  assert.equal(podeLigarCardapio({ checklist: ck }), false);
  assert.equal(podeLigarCardapio({ checklist: ck.filter((c) => c.nivel !== "trava" || c.ok) }), true); // aviso não trava
  assert.equal(podeLigarCardapio({ pode_ligar: true, checklist: ck }), true); // o servidor manda
  assert.equal(podeLigarCardapio(null), false);
  // 10i: WhatsApp faltando com o número do robô sugerido = botão "Usar o número do robô"; sem sugestão = pedir à Maxi
  const comRobo = itensDoChecklist({ checklist: [{ id: "whatsapp", nivel: "trava", ok: false, titulo: "WhatsApp da unidade", sugestao: "(17) 99999-0000" }] })[0];
  assert.deepEqual([comRobo.acao.tipo, comRobo.sugestao], ["robo", "(17) 99999-0000"]);
  const semRobo = itensDoChecklist({ checklist: [{ id: "whatsapp", nivel: "trava", ok: false, titulo: "WhatsApp da unidade", sugestao: null }] })[0];
  assert.equal(semRobo.acao.tipo, "whatsapp");
  // ligado com trava aberta: vira pendência vermelha no "Antes de divulgar" (no lugar do aviso antigo do WhatsApp)
  const p = pendencias({ ativo: true, tem_whatsapp: false, link_bio_em: "x", produtos: [], horario_especial: [], checklist: ck }, { hojeISO: H, agora: AGORA });
  assert.deepEqual(p.map((x) => x.id), ["pagamento_entrega", "id_novo_do_banco"]);
  // desligado: as travas ficam só no quadro de ligar (sem repetir no "Antes de divulgar")
  assert.deepEqual(pendencias({ ativo: false, tem_whatsapp: false, link_bio_em: "x", produtos: [], horario_especial: [], checklist: ck }, { hojeISO: H, agora: AGORA }), []);
});

console.log(`cardapioDigital: ${n} testes ok`);
import { mensagemErroCardapio } from "./cardapioDigital.js";
assert.equal(mensagemErroCardapio({ code: "22023", message: "O desconto passou de 35%." }), "O desconto passou de 35%.");
assert.equal(mensagemErroCardapio({ code: "42703", message: 'column "x" does not exist' }), "Não deu para salvar. Tente de novo.");
assert.equal(mensagemErroCardapio({ code: "42501", message: "sem permissão" }), "Sem permissão para mudar o cardápio desta unidade.");
assert.equal(mensagemErroCardapio({ code: "22023", message: "Cardápio: para ligar, falta o endereço da unidade." }), "Cardápio: para ligar, falta o endereço da unidade.");
console.log("cardapioDigital: mensagens de erro ok");
import { FILTROS_PRODUTOS, comPendentes } from "./cardapioDigital.js";
{
  // mesma base em todo lugar: o aviso diz "3 de 5"; os filtros dizem Em falta 3, Todos 5, Escondidos 2 (escondido + fora)
  const conta = Object.fromEntries(FILTROS_PRODUTOS.map((f) => [f.id, PRODUTOS.filter((p) => f.teste(situacaoProduto(p, AGORA))).length]));
  assert.deepEqual(conta, { "em-falta": 3, todos: 5, escondidos: 2 });
  const painel = { produtos: [{ id: "a", visivel: true }, { id: "b", visivel: true }] };
  assert.deepEqual(comPendentes(painel, new Map([["b", false]])).produtos.map((p) => p.visivel), [true, false]);
  assert.equal(comPendentes(painel, new Map()), painel);
  console.log("cardapioDigital: filtros na mesma base e pendentes ok");
}
import { situacaoPausa, erroPausaAte, erroPrazo } from "./cardapioDigital.js";
{
  assert.deepEqual(situacaoPausa(null, "2026-11-10", 600), { pausada: false, texto: "" });
  assert.equal(situacaoPausa("2026-11-10T15:30", "2026-11-10", 16 * 60).pausada, false); // venceu com a tela aberta
  assert.equal(situacaoPausa("2026-11-09T23:00", "2026-11-10", 0).pausada, false);
  assert.equal(situacaoPausa("2026-11-11T00:00", "2026-11-10", 23 * 60 + 59).texto, "Entrega pausada hoje. Volta sozinha amanhã.");
  assert.equal(situacaoPausa("2026-11-10T15:30", "2026-11-10", 600).texto, "Entrega pausada até as 15h30. Volta sozinha.");
  assert.equal(situacaoPausa("2026-11-10T09:00", "2026-11-10", 480).texto, "Entrega pausada até as 9h. Volta sozinha.");
  assert.equal(erroPausaAte("15:30", 16 * 60), "Esse horário já passou. Escolha um horário mais tarde.");
  assert.equal(erroPausaAte("17:00", 16 * 60), "");
  assert.equal(erroPausaAte("", 16 * 60), "Escolha o horário em que a entrega volta.");
  assert.equal(erroPrazo(50), ""); assert.equal(erroPrazo("50"), ""); assert.equal(erroPrazo(10), ""); assert.notEqual(erroPrazo(""), ""); assert.notEqual(erroPrazo(50.5), "");
  assert.equal(mensagemErroCardapio({ code: "22023", message: "O prazo da entrega vai de 15 a 180 minutos." }), "O prazo da entrega vai de 15 a 180 minutos.");
  assert.equal(mensagemErroCardapio({ code: "22023", message: "Esse horário já passou. Escolha um horário mais tarde." }), "Esse horário já passou. Escolha um horário mais tarde.");
  console.log("cardapioDigital: pausa e prazo da entrega ok");
}
