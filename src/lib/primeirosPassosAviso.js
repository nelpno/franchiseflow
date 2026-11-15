// Aviso "Pronto: X. Próximo: Y" da trilha Primeiros passos (17/09/2026).
// Guarda na sessão as tarefas já feitas na última conferência; o que aparecer feito depois
// disso vira o aviso. A trilha (Onboarding.jsx) e a faixa "Voltar aos Primeiros passos"
// (VoltarTrilhaBar.jsx) usam a MESMA chave: o que uma já avisou, a outra não repete.

export function chaveFeitas(evoId) {
  return `primeiros_passos_feitas_${evoId}`;
}

// Só tarefas que "fecham" (automáticas e confirmações); dica e material não contam.
export function tarefasFeitas(jornada) {
  return (jornada?.passos || []).flatMap((p) =>
    (p.tarefas || [])
      .filter((t) => (t.tipo === "auto" || t.tipo === "confirmacao") && t.feita)
      .map((t) => t.id)
  );
}

// anteriores = null: nunca conferiu nesta sessão, não há base para dizer o que é novo.
export function mensagemPronto(jornada, anteriores) {
  if (!Array.isArray(anteriores)) return null;
  const novas = tarefasFeitas(jornada).filter((id) => !anteriores.includes(id));
  if (novas.length === 0) return null;
  const tarefa = jornada.passos.flatMap((p) => p.tarefas || []).find((t) => t.id === novas[0]);
  const titulo = tarefa?.titulo || "Tarefa concluída";
  return jornada.agora ? `Pronto: ${titulo}. Próximo: ${jornada.agora.titulo}` : `Pronto: ${titulo}`;
}

export function uniao(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

export function lerFeitas(evoId) {
  try {
    const valor = JSON.parse(sessionStorage.getItem(chaveFeitas(evoId)) || "null");
    return Array.isArray(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function gravarFeitas(evoId, ids) {
  try {
    sessionStorage.setItem(chaveFeitas(evoId), JSON.stringify(ids));
  } catch {
    // sessionStorage pode falhar (modo privado): só perde o aviso, não trava nada
  }
}
