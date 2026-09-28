// Logica pura do modo "Contar estoque" (S16.1) — sem React, sem Supabase.
// Testes: node src/lib/stockCount.test.mjs

/**
 * Ponto de partida da contagem: quantidade atual de cada item, por id.
 * Itens sem quantidade valida entram como 0 (mesmo padrao do resto do app).
 */
export function initCounts(items) {
  const counts = {};
  for (const item of items || []) {
    counts[item.id] = Number(item.quantity) || 0;
  }
  return counts;
}

/**
 * Valida o que a franqueada digitou direto no numero (fora do +/-).
 * Contagem e sempre inteiro, nunca negativo, nunca vazio.
 * Retorna { valid, value, error }.
 */
export function validateCount(raw) {
  if (raw === "" || raw === null || raw === undefined) {
    return { valid: false, value: null, error: "Informe um numero." };
  }
  const str = String(raw).trim();
  if (str === "") {
    return { valid: false, value: null, error: "Informe um numero." };
  }
  if (!/^\d+$/.test(str)) {
    // Cobre negativo (tem "-"), decimal ("," ou ".") e qualquer texto nao numerico.
    return { valid: false, value: null, error: "Use um numero inteiro, sem virgula." };
  }
  const n = parseInt(str, 10);
  if (!Number.isFinite(n) || n < 0) {
    return { valid: false, value: null, error: "Nao pode ser negativo." };
  }
  return { valid: true, value: n, error: null };
}

/**
 * Aplica um passo do botao -/+ sem deixar a contagem ficar negativa.
 */
export function applyStep(current, step) {
  const base = Number(current) || 0;
  const next = base + step;
  return next < 0 ? 0 : next;
}

/**
 * Compara a contagem da tela com a quantidade que o item tinha antes —
 * só entram os itens que de fato mudaram (o "Salvar" manda só a diferenca).
 */
export function computeCountDiff(items, counts) {
  const diff = [];
  for (const item of items || []) {
    if (!(item.id in (counts || {}))) continue;
    const before = Number(item.quantity) || 0;
    const after = Number(counts[item.id]);
    if (!Number.isFinite(after)) continue;
    if (after !== before) {
      diff.push({
        id: item.id,
        product_name: item.product_name,
        unit: item.unit,
        before,
        after,
        delta: after - before,
      });
    }
  }
  return diff;
}

/**
 * Junta o resultado de um Promise.allSettled com a lista que foi salva,
 * separando quem salvou de quem falhou — para a tela nunca perder o que
 * a franqueada tinha digitado (rede caindo no meio do "Salvar").
 */
export function splitSaveResults(diffItems, settledResults) {
  const saved = [];
  const failed = [];
  diffItems.forEach((entry, i) => {
    const result = settledResults[i];
    if (result && result.status === "fulfilled") {
      saved.push(entry);
    } else {
      failed.push({ ...entry, error: result?.reason });
    }
  });
  return { saved, failed };
}
