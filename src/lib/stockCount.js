// Logica pura do modo "Contar estoque" (S16.1) — sem React, sem Supabase.
// Testes: node src/lib/stockCount.test.mjs
//
// A BASE de cada item (a quantidade que a franqueada viu ao tocar nele pela
// primeira vez) e imutavel ate ser corrigida por um CONFLITO no Salvar (o
// robo ou outra aba baixaram o estoque no meio da contagem) — o diff nunca
// compara contra o `items` recarregado, so contra essa base. Item nunca
// tocado nunca entra no diff nem no rascunho (revisao P3, 28/09/2026).

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
 * Estoque legado guarda `quantity` como numeric — um item pode chegar com
 * valor quebrado (ex.: 2.5). +/- em cima disso so trocaria um numero
 * quebrado por outro (2.5 -> 3.5), sem corrigir nada. So a digitacao direta
 * (que so aceita inteiro via validateCount) resolve — por isso o passo e
 * bloqueado quando o valor atual nao e inteiro.
 */
export function canStepCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n);
}

/**
 * Compara a base IMUTAVEL de cada item TOCADO com o valor atual da tela.
 * So entram no diff os itens tocados (a base so existe pra quem foi tocado)
 * e que de fato mudaram. `items` serve só para anexar nome/unidade ao
 * registro — nunca como fonte da quantidade "antes" (isso é sempre `base`).
 */
export function computeCountDiff(base, counts, items) {
  const itemsById = new Map((items || []).map((i) => [i.id, i]));
  const diff = [];
  for (const id of Object.keys(base || {})) {
    const before = Number(base[id]);
    const after = counts?.[id];
    if (!Number.isFinite(after)) continue;
    if (after !== before) {
      const item = itemsById.get(id);
      diff.push({
        id,
        product_name: item?.product_name,
        unit: item?.unit,
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
 * separando quem salvou de quem teve CONFLITO (outra aba ou o robo mudaram
 * a quantidade no meio — o update condicional voltou 0 linhas) de quem
 * falhou de verdade (rede) — a tela nunca perde o que a franqueada tinha
 * digitado em nenhum dos tres casos.
 */
export function splitSaveResults(diffItems, settledResults) {
  const saved = [];
  const conflicted = [];
  const failed = [];
  diffItems.forEach((entry, i) => {
    const result = settledResults[i];
    if (!result || result.status === "rejected") {
      failed.push({ ...entry, error: result?.reason });
      return;
    }
    const value = result.value;
    if (value && value.conflict) {
      conflicted.push({ ...entry, currentQuantity: value.currentQuantity });
    } else {
      saved.push({ ...entry, quantity: value?.quantity ?? entry.after });
    }
  });
  return { saved, conflicted, failed };
}
