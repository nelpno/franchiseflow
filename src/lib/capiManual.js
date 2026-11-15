// CAPI de venda manual: dispara o Purchase no Meta quando a venda vira RECEBIDA.
// Workflow n8n SendCapiOnSaleManual (xNBgSwQ6QduaS6jT): pula se `capi_sent=true` ou sem
// `contact_id`; `event_id = purchase_manual_<sale_id>` (o Meta descarta o repetido).
// Fire-and-forget: falha calada para não travar a tela.
//
// Quem chama (S6.2, 28/09/2026): o "Recebido" da lista (TabLancar, 1 venda ou em lote) e
// a venda que já NASCE recebida no formulário (SaleForm, com a chave ui_v2). Estorno
// (desmarcar) não desfaz o evento, e remarcar não manda de novo (capi_sent continua true).
export async function fireCapiOnConfirm(saleId) {
  try {
    const base = import.meta.env.VITE_N8N_WEBHOOK_BASE;
    const token = import.meta.env.VITE_CAPI_MANUAL_TOKEN;
    if (!base || !token || !saleId) return;
    await fetch(`${base}/send-capi-on-sale-manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sale_id: saleId }),
    });
  } catch {
    /* fail silent */
  }
}

// Lote (confirmar várias): blocos de 5 com 200 ms entre eles.
export async function fireCapiBatch(saleIds, batchSize = 5, gapMs = 200) {
  for (let i = 0; i < saleIds.length; i += batchSize) {
    const chunk = saleIds.slice(i, i + batchSize);
    await Promise.all(chunk.map((id) => fireCapiOnConfirm(id)));
    if (i + batchSize < saleIds.length) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}
