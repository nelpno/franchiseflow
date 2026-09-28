// Chave liga/desliga por unidade (S1.2, 28/09/2026) — botão de EMERGÊNCIA do redesenho.
// O banco já resolve (unidade > rede > desligada) em get_feature_flags; aqui só a regra
// de segurança do front: qualquer dúvida (sem dado, erro, valor estranho) = DESLIGADA,
// que é o comportamento atual. Nunca ligar por engano.
//
// Chaves conhecidas (documentar aqui ao criar):
//   ui_v2 — telas novas do franqueado (menu, Ajuda...). Liga no lançamento (S9/S10).

export const FEATURE_KEYS = Object.freeze({
  UI_V2: "ui_v2",
});

export function isFeatureOn(flags, key) {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return false;
  return flags[key] === true;
}
