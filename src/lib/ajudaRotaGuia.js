// Mapa rota → guia (S10.2, 28/09/2026): o "?" de cada tela do franqueado abre direto
// no guia certo. Dado puro (sem React), testável com `node`. Chave = pageName (o mesmo
// nome que `createPageUrl`/Layout usam) e, quando a página tem abas, `pageName:tab`.
//
// Cobre só as telas do FRANQUEADO (o "?" só aparece pra ele, atrás de ui_v2 — ver
// Layout.jsx). Tela sem guia próprio ainda (ex.: Onboarding, que já tem a trilha
// dentro dela) fica de fora do mapa: `guiaDaRota` devolve null e o "?" não aparece.
export const ROTA_PARA_GUIA = {
  Dashboard: "primeiros-passos",
  Vendas: "vendas",
  MyContacts: "clientes",
  Marketing: "artes",
  FranchiseSettings: "reconectar-whatsapp",
  "Gestao:resultado": "resultado",
  "Gestao:estoque": "pedido-fabrica",
  "Gestao:reposicao": "pedido-fabrica",
  Gestao: "resultado",
};

/**
 * @param {string} pageName nome da página (createPageUrl), ex.: "Gestao"
 * @param {string|null} tab query `tab` da URL, quando existir
 * @returns {string|null} slug do guia, ou null se a tela não tem guia mapeado
 */
export function guiaDaRota(pageName, tab) {
  if (!pageName) return null;
  if (tab) {
    const chave = `${pageName}:${tab}`;
    if (Object.prototype.hasOwnProperty.call(ROTA_PARA_GUIA, chave)) {
      return ROTA_PARA_GUIA[chave] || null;
    }
  }
  return ROTA_PARA_GUIA[pageName] || null;
}
