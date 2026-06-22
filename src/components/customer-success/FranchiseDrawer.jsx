import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";
import { addCsWorklistEvent, upsertCsWorklist, getCsWorklistEvents } from "@/entities/all";
import { TIER, SEV } from "@/components/customer-success/tierConfig";

const EVENT_LABEL = {
  contact: "Contato registrado",
  meeting: "Reunião marcada",
  resolve: "Resolvido",
  reopen: "Reaberto",
  note: "Nota",
};

function days(n) {
  if (n == null) return "—";
  if (n <= 0) return "hoje";
  return `${n}d atrás`;
}

function Metric({ icon, label, value, hint, tone }) {
  return (
    <div className="bg-[#fbf9fa] rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[#8a7e7e] font-medium uppercase tracking-wide">
        <MaterialIcon icon={icon} size={14} /> {label}
      </div>
      <div className={`text-base font-bold mt-0.5 ${tone || "text-[#1b1c1d]"}`}>{value}</div>
      {hint && <div className="text-[11px] text-[#8a7e7e] mt-0.5">{hint}</div>}
    </div>
  );
}

export default function FranchiseDrawer({ row, userId, onClose, onChanged }) {
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [saving, setSaving] = useState(false);
  const open = !!row;
  const fid = row?.franchise_id;

  const loadEvents = useCallback(async () => {
    if (!fid) return;
    try {
      setEvents(await getCsWorklistEvents(fid));
    } catch (e) {
      console.error("[FranchiseDrawer] events", e);
    }
  }, [fid]);

  useEffect(() => {
    if (fid) { setNote(""); setMeetingDate(""); loadEvents(); }
  }, [fid, loadEvents]);

  const act = async (eventType, statusPatch, successMsg) => {
    if (!fid || saving) return;
    setSaving(true);
    try {
      await addCsWorklistEvent(fid, eventType, note, userId);
      if (statusPatch) await upsertCsWorklist(fid, statusPatch, userId);
      toast.success(successMsg);
      setNote("");
      await loadEvents();
      onChanged?.();
    } catch (e) {
      console.error("[FranchiseDrawer] act", e);
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const nowIso = () => new Date().toISOString();

  const markMeeting = async () => {
    if (!meetingDate) { toast.error("Escolha a data da reunião primeiro."); return; }
    if (!fid || saving) return;
    setSaving(true);
    try {
      // T12:00:00 evita o off-by-one de fuso (new Date('YYYY-MM-DD') = UTC)
      const iso = new Date(`${meetingDate}T12:00:00`).toISOString();
      const br = meetingDate.split("-").reverse().join("/");
      const evNote = `📅 ${br}` + (note.trim() ? ` — ${note.trim()}` : "");
      await addCsWorklistEvent(fid, "meeting", evNote, userId);
      await upsertCsWorklist(fid, { status: "reuniao_marcada", meeting_at: iso, last_contact_at: nowIso() }, userId);
      toast.success(`Reunião marcada para ${br}`);
      setNote(""); setMeetingDate("");
      await loadEvents();
      onChanged?.();
    } catch (e) {
      console.error("[FranchiseDrawer] markMeeting", e);
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const t = row ? (row.is_standout ? "standout" : row.tier) : "healthy";
  const deltaStr = row?.revenue_delta_pct != null
    ? `${row.revenue_delta_pct > 0 ? "+" : ""}${row.revenue_delta_pct}%` : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {row && (
          <div className="space-y-5">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <span>{TIER[t].dot}</span> {row.franchise_name}
              </SheetTitle>
              <p className="text-sm text-[#8a7e7e]">{row.city}{row.state_uf ? ` · ${row.state_uf}` : ""}</p>
              <span className={`inline-block w-fit text-xs px-2 py-0.5 rounded-full border ${TIER[t].chip}`}>
                {TIER[t].label}
              </span>
            </SheetHeader>

            {/* Motivos */}
            {(row.flags?.length || 0) > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">Por quê</h3>
                <div className="flex flex-wrap gap-1.5">
                  {row.flags.map((f, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded ${SEV[f.sev] || SEV.low}`}>{f.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Raio-x */}
            <div>
              <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">Raio-x da unidade</h3>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon="payments" label="Faturamento 30d" value={formatBRL(row.revenue_30d || 0)}
                  hint={deltaStr ? `${deltaStr} vs mês anterior` : "base curta"}
                  tone={row.revenue_delta_pct != null && row.revenue_delta_pct <= -15 ? "text-red-600" : undefined} />
                <Metric icon="trending_up" label="Margem bruta" value={row.gross_margin_pct_30d != null ? `${row.gross_margin_pct_30d}%` : "—"}
                  tone={row.gross_margin_pct_30d != null && row.gross_margin_pct_30d < 0 ? "text-red-600" : undefined} />
                <Metric icon="shopping_cart" label="Última venda" value={days(row.days_since_last_sale)} />
                <Metric icon="local_shipping" label="Última compra fábrica" value={days(row.days_since_last_purchase)}
                  tone={row.days_since_last_purchase >= 30 ? "text-red-600" : undefined} />
                <Metric icon="repeat" label="Compras 30d" value={`${row.purchase_count_30d ?? 0}`} hint={`antes: ${row.purchase_count_prev ?? 0}`} />
                <Metric icon="category" label="Variedade comprada" value={`${row.mix_distinct_30d ?? 0}`} hint={`antes: ${row.mix_distinct_prev ?? 0}`} />
                <Metric icon="inventory_2" label="Itens-chave zerados" value={`${row.zeroed_key_items_count ?? 0}`}
                  hint={`de ${row.key_items_total ?? 0} que vende`} tone={row.zeroed_key_items_count >= 3 ? "text-amber-600" : undefined} />
                <Metric icon="smart_toy" label="Conversão do bot" value={row.bot_conversion_30d != null ? `${row.bot_conversion_30d}%` : "—"} />
                <Metric icon="credit_card" label="Assinatura R$150" value={row.subscription_overdue ? "Atrasada" : "Em dia"}
                  tone={row.subscription_overdue ? "text-red-600" : "text-green-600"} />
              </div>
            </div>

            {/* Worklist */}
            <div className="border-t border-[#291715]/5 pt-4">
              <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">Acompanhamento</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional): o que foi conversado…"
                rows={2}
                maxLength={1000}
                className="w-full text-sm rounded-lg border border-[#291715]/15 p-2.5 focus:outline-none focus:border-[#b91c1c] resize-none"
              />
              <div className="flex items-center gap-2 mt-2 text-sm">
                <label className="text-[#8a7e7e]">Data da reunião:</label>
                <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)}
                  className="rounded-md border border-[#291715]/15 px-2 py-1 text-sm focus:outline-none focus:border-[#b91c1c]" />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" disabled={saving}
                  onClick={() => act("contact", { status: "contatado", last_contact_at: nowIso() }, "Contato registrado")}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1">
                  <MaterialIcon icon="call" size={16} /> Registrar contato
                </Button>
                <Button size="sm" variant="outline" disabled={saving}
                  onClick={markMeeting}
                  className="gap-1">
                  <MaterialIcon icon="event" size={16} /> Marcar reunião
                </Button>
                <Button size="sm" variant="outline" disabled={saving}
                  onClick={() => act("resolve", { status: "resolvido", resolved_at: nowIso() }, "Marcado como resolvido")}
                  className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                  <MaterialIcon icon="check" size={16} /> Resolver
                </Button>
                {note.trim() && (
                  <Button size="sm" variant="ghost" disabled={saving}
                    onClick={() => act("note", null, "Nota salva")} className="gap-1">
                    <MaterialIcon icon="note_add" size={16} /> Só anotar
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-[#8a7e7e] mt-2 leading-snug">
                Os registros ficam só aqui (não vão pro franqueado). <b>Resolver</b> tira a unidade da fila — ela reabre sozinha se um sinal forte voltar.
              </p>

              {/* Histórico */}
              {events.length > 0 && (
                <div className="mt-4 space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="text-xs bg-[#fbf9fa] rounded-lg p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#4a3d3d]">{EVENT_LABEL[ev.event_type] || ev.event_type}</span>
                        <span className="text-[#8a7e7e]">{new Date(ev.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {ev.note && <p className="text-[#4a3d3d] mt-1 whitespace-pre-wrap">{ev.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
