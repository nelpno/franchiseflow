// Saídas da entrega em horário fixo (26/11/2026, Uberaba): o entregador sai em rotas (ex.: 11h, 15h e 18h).
// Campo opcional `saidas` (["11:00","15:00","18:00"]) em cada faixa de delivery_schedule. O robô (Customer Context do V5,
// bots/vendedor/scripts/assets/saidas-entrega-2026-11-26.mjs) diz em qual rota vai o pedido, sem hora de chegada.
// Sem saídas = a faixa fica como sempre (o robô fala a janela "das 8h às 18h"). A tela é o cartão Entrega (EntregaCard, "Como chega ao cliente" › Saídas fixas); a regra de validação mora no freteModelo.

// "11", "11h", "11:00", "11h30", "11.30", "9:5" → "11:00" … ; o resto volta em `invalidos`
export function parseSaidas(texto) {
  const saidas = [], invalidos = [];
  for (const bruto of String(texto || "").split(/[,;/\s]+|\be\b/i)) {
    const t = bruto.trim().toLowerCase();
    if (!t) continue;
    const m = t.match(/^(\d{1,2})(?:[:h.](\d{1,2})?)?h?$/);
    const h = m ? Number(m[1]) : NaN, min = m && m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    if (!m || h > 23 || min > 59) { invalidos.push(bruto.trim()); continue; }
    saidas.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return { saidas: [...new Set(saidas)].sort(), invalidos };
}

// ["11:00","15:30","18:00"] → "11h, 15h30 e 18h" (mesma fala do robô)
export function formatSaidas(saidas) {
  const h = (saidas || []).map((s) => { const [hh, mm] = s.split(":"); return `${Number(hh)}h${mm !== "00" ? mm : ""}`; });
  return h.length > 1 ? `${h.slice(0, -1).join(", ")} e ${h[h.length - 1]}` : h[0] || "";
}
