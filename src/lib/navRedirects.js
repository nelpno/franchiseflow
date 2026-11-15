// Mapa de redirecionamento dos endereços antigos (S9.2, 28/09/2026) — a rota
// MinhaLoja NÃO sai (link antigo no grupo, notificação salva, favorito do
// franqueado); só troca de destino por dentro. Função pura pra poder testar sem
// montar o React Router (node src/lib/navRedirects.test.mjs).
//
// Entra o que a URL antiga de /MinhaLoja trazia (tab/action/phone); sai o path novo
// (Gestão continua existindo — ela é a "Mais" do menu novo — ou Vendas).

// Gestão mantém os mesmos 3 nomes de aba de sempre (?tab=resultado|estoque|reposicao),
// inclusive o link fixo /Gestao?tab=reposicao&modelo=1 do pedido modelo (S16/onboarding).
const GESTAO_TABS = new Set(["resultado", "estoque", "reposicao"]);

/**
 * @param {{tab?: string|null, action?: string|null, phone?: string|null}} params
 * @returns {string} path relativo (com query se houver) para onde /MinhaLoja deve mandar
 */
export function resolveMinhaLojaRedirect({ tab, action, phone } = {}) {
  if (tab && GESTAO_TABS.has(tab)) {
    return `/Gestao?tab=${tab}`;
  }
  // Default histórico: MinhaLoja sem tab (ou tab desconhecida) sempre abria a aba
  // "lancar", que virou a tela Vendas — action/phone (nova venda vindo de um contato)
  // seguem juntos.
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (phone) params.set("phone", phone);
  const queryString = params.toString();
  return `/Vendas${queryString ? `?${queryString}` : ""}`;
}
