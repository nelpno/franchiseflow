// Testes puros (node:assert, sem framework) do mapa de redirecionamento dos
// endereços antigos (S9.2, 28/09/2026). Rodar: node src/lib/navRedirects.test.mjs
//
// Controle positivo: sem este mapa, /MinhaLoja?tab=estoque cairia no fallback
// /Vendas (era o bug que este teste trava) — comentado abaixo, ao lado do caso real.
import assert from "node:assert";
import { resolveMinhaLojaRedirect } from "./navRedirects.js";

// ── As 3 abas antigas da Gestão continuam indo pra Gestão (nunca some) ──
assert.equal(resolveMinhaLojaRedirect({ tab: "resultado" }), "/Gestao?tab=resultado");
assert.equal(resolveMinhaLojaRedirect({ tab: "estoque" }), "/Gestao?tab=estoque");
assert.equal(resolveMinhaLojaRedirect({ tab: "reposicao" }), "/Gestao?tab=reposicao");
// Se um dia isso quebrar (ex: alguém tirar "estoque" do Set sem querer), o link
// fixo do pedido modelo (/Gestao?tab=reposicao&modelo=1, usado no onboarding)
// deixaria de funcionar em silêncio — por isso o caso abaixo é conferido à parte.
assert.notEqual(
  resolveMinhaLojaRedirect({ tab: "reposicao" }),
  "/Vendas",
  "regressão: aba reposicao caiu no fallback de Vendas"
);

// ── tab desconhecida (ou ausente) cai no fallback histórico: era a aba "lancar" ──
assert.equal(resolveMinhaLojaRedirect({}), "/Vendas");
assert.equal(resolveMinhaLojaRedirect({ tab: "lancar" }), "/Vendas");
assert.equal(resolveMinhaLojaRedirect({ tab: null }), "/Vendas");

// ── action e phone (nova venda a partir de um contato) seguem juntos pro Vendas ──
assert.equal(
  resolveMinhaLojaRedirect({ action: "nova-venda" }),
  "/Vendas?action=nova-venda"
);
assert.equal(
  resolveMinhaLojaRedirect({ action: "nova-venda", phone: "5511999998888" }),
  "/Vendas?action=nova-venda&phone=5511999998888"
);
// action/phone só valem quando NÃO há tab de Gestão válida (senão o link do
// grupo com os dois juntos — nunca acontece hoje, mas o mapa deve resolver algo
// determinístico) — a aba de Gestão sempre ganha.
assert.equal(
  resolveMinhaLojaRedirect({ tab: "estoque", action: "nova-venda" }),
  "/Gestao?tab=estoque"
);

// ── phone sozinho (sem action) também é aceito — link antigo de notificação ──
assert.equal(
  resolveMinhaLojaRedirect({ phone: "5511999998888" }),
  "/Vendas?phone=5511999998888"
);

console.log("navRedirects.test.mjs: OK (%d asserts)", 9);
