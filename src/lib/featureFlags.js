// Chave liga/desliga por unidade (S1.2, 28/09/2026) — botão de EMERGÊNCIA do redesenho.
// O banco já resolve (unidade > rede > desligada) em get_feature_flags; aqui só a regra
// de segurança do front: qualquer dúvida (sem dado, erro, valor estranho) = DESLIGADA,
// que é o comportamento atual. Nunca ligar por engano.
//
// Chaves conhecidas (documentar aqui ao criar):
//   ui_v2 — telas novas do franqueado (menu, Ajuda...). Liga no lançamento (S9/S10).
//   pix_na_baixa — pedido de Pix pelo WhatsApp na baixa "entregue" + comprovante em Reposição (P12, 04/10).
//   chamar_uber — botão "Chamar Uber" na venda com entrega (Edge Function uber-link; piloto São Miguel, 08/10).
//   cardapio_digital — página "Cardápio digital" no menu da franqueada (piloto Imirim, 10/11/2026). Admin vê sempre.
//   cardapio_kit — promoção estruturada (kit/leve N) no cardápio do cliente; lida DENTRO da RPC cardapio_unidade.
//                  Só liga depois da prova do robô com a linha "Promoção:" do #PED- (ESPEC 5.1 A4).

export const FEATURE_KEYS = Object.freeze({
  UI_V2: "ui_v2",
  PIX_NA_BAIXA: "pix_na_baixa",
  CHAMAR_UBER: "chamar_uber",
  CARDAPIO_DIGITAL: "cardapio_digital",
  CARDAPIO_KIT: "cardapio_kit",
});

export function isFeatureOn(flags, key) {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return false;
  return flags[key] === true;
}
