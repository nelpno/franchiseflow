// Regra de completude do wizard "Meu Vendedor" (FranchiseSettings.jsx). Extraída em
// 16/09/2026 para a trilha "Primeiros passos" (Passo 2, sinal automático "vendedor")
// poder usar a MESMA regra sem duplicar — o drift entre a tela e a detecção do
// onboarding antigo travou o item 5-2 de Campinas em 24/06/2026 (ver CLAUDE.md
// "Primeiros passos (onboarding)"). Qualquer mudança na completude do wizard
// (FranchiseSettings.jsx, useMemo `completedSteps`) deve espelhar aqui.
//
// hasDelivery/hasPickup usam o MESMO default do formData da tela
// (has_delivery ?? true, has_pickup ?? false) — não confundir com o default de
// vendedorValidation.js, que é outra regra (bloqueia avanço; esta só mede completude).
//
// skippedSteps: mesma noção da tela — hoje sempre [] (`SEM_ETAPAS_PULADAS`, reservado
// para uma futura etapa opcional por franquia/plano). Aceita 1..4 (etapas Identidade,
// Entrega, Pagamento, Vendedor); a etapa 5 (Revisão) nunca é pulável — ela é o "completo".
export function etapasVendedor(dados, { skippedSteps = [] } = {}) {
  const f = dados || {};
  const hasDelivery = f.has_delivery ?? true;
  const hasPickup = f.has_pickup ?? false;

  // Etapa 1: identidade da unidade
  const identidade = Boolean(f.franchise_name && f.street_address && f.neighborhood && f.city);

  // Etapa 2: entrega e retirada — só exige raio + horário quando a entrega está ligada
  // (retirada sozinha não pede raio). Sem os dois (nem entrega nem retirada), incompleto.
  const entrega = (hasDelivery || hasPickup)
    && (!hasDelivery || Boolean(f.max_delivery_radius_km && f.delivery_schedule?.length > 0));

  // Etapa 3: pagamento — uma forma marcada em cada modalidade ligada
  const pagamento = (!hasDelivery || f.payment_delivery?.length > 0)
    && (!hasPickup || f.payment_pickup?.length > 0);

  // Etapa 4: vendedor (nome da atendente)
  const vendedor = Boolean(f.agent_name);

  const done = [];
  if (identidade) done.push(1);
  if (entrega) done.push(2);
  if (pagamento) done.push(3);
  if (vendedor) done.push(4);

  // Etapa 5 (Revisão): "completa" quando todas as etapas OBRIGATÓRIAS (não puladas) estão ok
  const requiredSteps = [1, 2, 3, 4].filter((n) => !skippedSteps.includes(n));
  const completo = requiredSteps.every((n) => done.includes(n));

  return { identidade, entrega, pagamento, vendedor, completo };
}
