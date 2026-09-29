// Trava do mapa rota → guia (S10.2) — node src/lib/ajudaRotaGuia.test.mjs
import assert from "node:assert/strict";
import { ROTA_PARA_GUIA, guiaDaRota } from "./ajudaRotaGuia.js";
import { acharGuia } from "./guiasAjuda.js";

let n = 0;
const t = (nome, fn) => { fn(); n++; };

t("Dashboard, Vendas e MyContacts abrem o guia certo", () => {
  assert.equal(guiaDaRota("Dashboard"), "inicio"); // Onda 7c: antes abria os Primeiros passos
  assert.equal(guiaDaRota("Vendas"), "vendas");
  assert.equal(guiaDaRota("MyContacts"), "clientes");
  assert.equal(guiaDaRota("Marketing"), "artes");
  assert.equal(guiaDaRota("FranchiseSettings"), "reconectar-whatsapp");
  assert.equal(guiaDaRota("Pagamentos"), "pagamentos"); // Onda 5: a tela nasceu na S11 sem "?"
});

t("Gestão escolhe o guia pela aba (tab), com fallback pra 'resultado' sem aba", () => {
  assert.equal(guiaDaRota("Gestao", "resultado"), "resultado");
  assert.equal(guiaDaRota("Gestao", "estoque"), "contar-estoque"); // S24.1: guia próprio da aba Estoque
  assert.equal(guiaDaRota("Gestao", "reposicao"), "pedido-fabrica");
  assert.equal(guiaDaRota("Gestao"), "resultado");
  assert.equal(guiaDaRota("Gestao", "aba-que-nao-existe"), "resultado"); // cai no fallback da página
});

// Controle positivo da S24.1: o mapa de antes (aba Estoque → pedido à fábrica) é o que o teste
// acima reprova — a checagem não passaria com a regra velha.
t("controle positivo: a regra antiga da aba Estoque (pedido à fábrica) é reprovada", () => {
  const antigo = { ...ROTA_PARA_GUIA, "Gestao:estoque": "pedido-fabrica" };
  assert.notEqual(antigo["Gestao:estoque"], guiaDaRota("Gestao", "estoque"));
  assert.equal(guiaDaRota("Gestao", "reposicao"), "pedido-fabrica"); // a Reposição segue no pedido
});

t("página sem guia mapeado (ex.: Onboarding) devolve null — o '?' não aparece", () => {
  assert.equal(guiaDaRota("Onboarding"), null);
  assert.equal(guiaDaRota("PaginaInventada"), null);
});

t("pageName vazio nunca quebra", () => {
  assert.equal(guiaDaRota(null), null);
  assert.equal(guiaDaRota(undefined), null);
  assert.equal(guiaDaRota(""), null);
});

t("todo slug do mapa existe de verdade em guiasAjuda.js (franqueado)", () => {
  for (const slug of Object.values(ROTA_PARA_GUIA)) {
    assert.ok(acharGuia(slug, "franchisee"), `slug "${slug}" não existe em GUIAS`);
  }
});

// Controle positivo: prova que o teste acima pegaria uma rota SEM guia mapeado.
// Sem isso, "guiaDaRota devolve null pra rota desconhecida" seria uma afirmação vazia
// (a função podia estar sempre devolvendo null por bug e o teste passaria do mesmo jeito).
t("controle positivo: rota removida do mapa vira null (a trava pega o que deve pegar)", () => {
  const semVendas = { ...ROTA_PARA_GUIA };
  delete semVendas.Vendas;
  const guiaDaRotaSemVendas = (pageName, tab) => {
    if (!pageName) return null;
    if (tab) {
      const chave = `${pageName}:${tab}`;
      if (Object.prototype.hasOwnProperty.call(semVendas, chave)) return semVendas[chave] || null;
    }
    return semVendas[pageName] || null;
  };
  assert.equal(guiaDaRota("Vendas"), "vendas"); // o mapa real ainda tem
  assert.equal(guiaDaRotaSemVendas("Vendas"), null); // a cópia sem a entrada não tem mais
});

console.log(`ajudaRotaGuia: ${n} testes ok`);
