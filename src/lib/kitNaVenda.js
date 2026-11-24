// Kit da promoção na venda do app (24/11/2026, Bárbara/Jd. Santa Maria: "cliente encomendou direto comigo, no sistema
// não aparece, só no digital"). A franqueada escolhe um kit de `franchise_configurations.promocao_regras` dentro do
// SaleForm: os itens entram como linhas normais da venda (a bolsa térmica inclusive, que baixa o estoque pelo trigger
// de sale_items) e a diferença até o preço do kit vira Desconto em R$ com motivo "Promoção".
//
// Mesma conta do motor do cardápio (promocao_aplicar, site/pedido/supabase/2026-11-19-kit-item-escolha.sql): o
// desconto usa a opção que o cliente ESCOLHEU (não a mais cara, que só vale para o "de R$"); vez sem desconto
// (soma <= preço do kit) não dá desconto nenhum. Nada aqui grava: o banco recebe uma venda comum.
// Teste: node src/lib/kitNaVenda.test.mjs

import { ehEscolha } from "./promocaoRegras.js";

const arred = (v) => Math.round(v * 100) / 100;
const chave = (n) => String(n ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Kits que valem hoje (tipo kit, validade não passou), na ordem do cardápio. */
export function kitsDaVenda(regras, hojeISO) {
  if (!Array.isArray(regras)) return [];
  return regras.filter(
    (r) => r && typeof r === "object" && r.tipo === "kit" && Array.isArray(r.itens) && r.itens.length > 0
      && Number(r.preco) > 0
      && (!r.vale_ate || !hojeISO || String(r.vale_ate) >= hojeISO),
  );
}

/** Produto do estoque pelo nome que o kit guarda: exato primeiro; depois sem diferença de maiúscula e espaço. */
export function acharProduto(inventoryItems, nome) {
  const lista = inventoryItems || [];
  return lista.find((p) => p.product_name === nome) || lista.find((p) => chave(p.product_name) === chave(nome)) || null;
}

/**
 * O kit pronto para a tela: cada item com o produto do estoque (fixo) ou as opções achadas (à escolha).
 * { ok, motivo, linhas: [{tipo:"fixo", nome, qtd, inv} | {tipo:"escolha", rotulo, qtd, opcoes:[inv]}] }
 * ok=false quando um item fixo não está no estoque ou um item à escolha não tem nenhuma opção no estoque.
 */
export function montarKit(regra, inventoryItems) {
  const linhas = [];
  for (const it of regra?.itens || []) {
    const qtd = Math.max(1, Number(it?.qtd) || 1);
    if (ehEscolha(it)) {
      const opcoes = [];
      for (const nome of Array.isArray(it.opcoes) ? it.opcoes : []) {
        const inv = acharProduto(inventoryItems, nome);
        if (inv && !opcoes.some((o) => o.id === inv.id)) opcoes.push(inv);
      }
      const rotulo = String(it.rotulo ?? "").trim() || "Item à escolha";
      if (!opcoes.length) return { ok: false, motivo: `Nenhuma opção de "${rotulo}" está no seu estoque.`, linhas: [] };
      linhas.push({ tipo: "escolha", rotulo, qtd, opcoes });
    } else {
      const inv = acharProduto(inventoryItems, it?.product_name);
      if (!inv) return { ok: false, motivo: `"${String(it?.product_name ?? "").slice(0, 60)}" não está no seu estoque.`, linhas: [] };
      linhas.push({ tipo: "fixo", nome: inv.product_name, qtd, inv });
    }
  }
  if (!linhas.length) return { ok: false, motivo: "Kit sem produtos.", linhas: [] };
  return { ok: true, motivo: null, linhas };
}

/** Escolhas vazias: uma por unidade de cada item à escolha ("2 massas à escolha" = 2 escolhas, podem ser sabores diferentes). */
export function escolhasIniciais(montado) {
  return (montado?.linhas || []).map((l) => (l.tipo === "escolha" ? Array.from({ length: l.qtd }, () => "") : null));
}

/** Todas as escolhas feitas? */
export function escolhasCompletas(montado, escolhas) {
  return (montado?.linhas || []).every((l, i) => l.tipo !== "escolha" || (Array.isArray(escolhas?.[i]) && escolhas[i].length === l.qtd
    && escolhas[i].every((id) => l.opcoes.some((o) => o.id === id))));
}

/** Os produtos do kit já com as escolhas, somados por produto: [{inv, qtd}] (null se falta escolher). */
export function itensDoKit(montado, escolhas) {
  if (!montado?.ok || !escolhasCompletas(montado, escolhas)) return null;
  const mapa = new Map();
  const soma = (inv, q) => {
    const atual = mapa.get(inv.id);
    mapa.set(inv.id, { inv, qtd: (atual?.qtd || 0) + q });
  };
  montado.linhas.forEach((l, i) => {
    if (l.tipo === "fixo") soma(l.inv, l.qtd);
    else escolhas[i].forEach((id) => soma(l.opcoes.find((o) => o.id === id), 1));
  });
  return [...mapa.values()];
}

/** Os produtos do kit já estão na venda nessa quantidade? (ex.: "Virou venda" de uma encomenda de kit) */
export function kitJaNaVenda(items, itensKit) {
  if (!itensKit?.length) return false;
  return itensKit.every(({ inv, qtd }) => {
    const naVenda = (items || []).filter((l) => l.inventory_item_id === inv.id).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    return naVenda >= qtd;
  });
}

/** Linhas da venda com os produtos do kit: soma na linha que já tem o produto, ocupa a linha vazia, senão acrescenta. */
export function somarKitNosItens(items, itensKit) {
  let novos = (items || []).map((l) => ({ ...l }));
  for (const { inv, qtd } of itensKit || []) {
    const i = novos.findIndex((l) => l.inventory_item_id === inv.id);
    if (i >= 0) {
      novos[i].quantity = (Number(novos[i].quantity) || 0) + qtd;
      continue;
    }
    const linha = { inventory_item_id: inv.id, product_name: inv.product_name, quantity: qtd, unit_price: Number(inv.sale_price) || 0, cost_price: Number(inv.cost_price) || 0 };
    const vazia = novos.findIndex((l) => !l.inventory_item_id);
    if (vazia >= 0) novos[vazia] = linha;
    else novos.push(linha);
  }
  // linha vazia que sobrou (a de "Adicionar produto" sem escolher) sai, se há produto na venda
  if (novos.some((l) => l.inventory_item_id)) novos = novos.filter((l) => l.inventory_item_id);
  return novos;
}

/** Preço normal dos itens escolhidos, pelo preço da linha da venda (se ela já tem o produto) ou o de venda do estoque. */
export function somaDoKit(itensKit, items) {
  let soma = 0;
  for (const { inv, qtd } of itensKit || []) {
    const linha = (items || []).find((l) => l.inventory_item_id === inv.id);
    const preco = linha ? Number(linha.unit_price) || 0 : Number(inv.sale_price) || 0;
    soma += preco * qtd;
  }
  return arred(soma);
}

/** Desconto do kit = soma − preço do kit; nunca negativo (como o motor: vez sem desconto não aplica). */
export function descontoDoKit(regra, itensKit, items) {
  const preco = arred(Number(regra?.preco) || 0);
  const soma = somaDoKit(itensKit, items);
  return { soma, preco, desconto: soma > preco ? arred(soma - preco) : 0 };
}

/** Produtos do kit com estoque abaixo do que o kit leva: [{nome, tem, precisa}] (só aviso; não bloqueia). */
export function faltaEstoque(itensKit, items, jaNaVenda = false) {
  return (itensKit || []).flatMap(({ inv, qtd }) => {
    const naVenda = (items || []).filter((l) => l.inventory_item_id === inv.id).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const precisa = jaNaVenda ? Math.max(qtd, naVenda) : qtd + naVenda;
    const tem = Number(inv.quantity) || 0;
    return tem < precisa ? [{ nome: inv.product_name, tem, precisa }] : [];
  });
}

/** Linha da observação da venda: "Kit 1 (Canelone 4 Queijos - 700g, Molho Branco - 500g)". Só as escolhas vão no parêntese. */
export function textoDoKit(regra, montado, escolhas) {
  const nome = String(regra?.nome ?? "Kit").trim() || "Kit";
  const escolhidos = [];
  (montado?.linhas || []).forEach((l, i) => {
    if (l.tipo !== "escolha") return;
    for (const id of escolhas?.[i] || []) {
      const o = l.opcoes.find((x) => x.id === id);
      if (o) escolhidos.push(o.product_name);
    }
  });
  return escolhidos.length ? `${nome} (${escolhidos.join(", ")})` : nome;
}

/** Observação com a linha do kit acrescentada (dois kits iguais = duas linhas, de propósito). */
export function observacaoComKit(observacoes, linha) {
  const atual = String(observacoes ?? "").trimEnd();
  if (!linha) return atual;
  return atual ? `${atual}\n${linha}` : linha;
}
