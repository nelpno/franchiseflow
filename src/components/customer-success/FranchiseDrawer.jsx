import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { marketingLiquid } from "@/lib/franchiseUtils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import {
  getCsTaskEvents, addCsTaskEvent, updateCsTask, moveCsTask,
  deleteCsWorklistEvent, updateCsWorklistEventNote,
} from "@/entities/all";
import { TIER, SEV, COLUMN_CONFIG } from "@/components/customer-success/tierConfig";

const EVENT_LABEL = {
  contact: "Falou com a franquia", meeting: "Reunião marcada", resolve: "Resolvido",
  reopen: "Reaberto", note: "Anotação", move: "Movido de coluna",
  auto_open: "Aberto pelo radar", auto_resolve: "Fechado pelo radar (saiu do vermelho)",
};
const EVENT_ICON = {
  contact: "call", meeting: "event", resolve: "check_circle", reopen: "undo",
  note: "sticky_note_2", move: "drag_indicator", auto_open: "auto_awesome", auto_resolve: "auto_awesome",
};
const COLUMN_LABEL = Object.fromEntries(COLUMN_CONFIG.map((c) => [c.key, c.label]));

function daysAgo(n) {
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

// Drawer com 3 modos:
//  - cartão de franquia  (task + row): por quê + registrar + histórico + raio-x (colapsável)
//  - cartão geral        (task, sem row): registrar + histórico
//  - preview do Radar     (row, sem task): por quê + raio-x + "Criar cartão"
export default function FranchiseDrawer({ task, row, userId, isAdmin = false, onClose, onChanged, onCreateCard }) {
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState("");
  const [meetingMode, setMeetingMode] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [showRaioX, setShowRaioX] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const taskId = task?.id || null;
  const isPreview = !task && !!row;
  const open = !!task || !!row;
  const fid = task?.franchise_id ?? row?.franchise_id ?? null;
  const drawerKey = taskId || row?.franchise_id || null;

  const loadEvents = useCallback(async () => {
    if (!taskId) { setEvents([]); return; }
    try { setEvents(await getCsTaskEvents(taskId)); }
    catch (e) { console.error("[FranchiseDrawer] events", e); }
  }, [taskId]);

  useEffect(() => {
    setNote(""); setMeetingMode(false); setMeetingDate(""); setEditingId(null); setConfirmId(null);
    setShowRaioX(!task && !!row); // no preview do Radar, já abre o raio-x
    loadEvents();
  }, [drawerKey, task, row, loadEvents]);

  const afterAction = async (msg) => { toast.success(msg); setNote(""); setMeetingMode(false); setMeetingDate(""); await loadEvents(); onChanged?.(); };
  const nowIso = () => new Date().toISOString();

  const registerContact = async () => {
    if (!taskId || saving) return;
    setSaving(true);
    try {
      await updateCsTask(taskId, { column_status: "aguardando_retorno", moved_to_column_at: nowIso() });
      await addCsTaskEvent(taskId, "contact", note, userId, fid);
      await afterAction("Contato registrado — foi pra “Aguardando retorno”");
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const confirmMeeting = async () => {
    if (!meetingDate) { toast.error("Escolha a data da reunião."); return; }
    if (!taskId || saving) return;
    setSaving(true);
    try {
      const iso = new Date(`${meetingDate}T12:00:00`).toISOString(); // evita off-by-one de fuso
      const br = meetingDate.split("-").reverse().join("/");
      const evNote = `📅 ${br}` + (note.trim() ? ` — ${note.trim()}` : "");
      await updateCsTask(taskId, { column_status: "em_andamento", meeting_at: iso, moved_to_column_at: nowIso() });
      await addCsTaskEvent(taskId, "meeting", evNote, userId, fid);
      await afterAction(`Reunião marcada para ${br}`);
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const resolve = async () => {
    if (!taskId || saving) return;
    setSaving(true);
    try {
      if (note.trim()) await addCsTaskEvent(taskId, "note", note, userId, fid);
      await moveCsTask(taskId, "feito", userId, fid); // registra 'resolve'
      await afterAction("Resolvido ✓");
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const reopen = async () => {
    if (!taskId || saving) return;
    setSaving(true);
    try {
      await updateCsTask(taskId, { column_status: "a_fazer", resolved_at: null, moved_to_column_at: nowIso() });
      await addCsTaskEvent(taskId, "reopen", note, userId, fid);
      await afterAction("Cartão reaberto");
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const justNote = async () => {
    if (!taskId || saving || !note.trim()) return;
    setSaving(true);
    try { await addCsTaskEvent(taskId, "note", note, userId, fid); await afterAction("Anotação salva"); }
    catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const assignToMe = async () => {
    if (!taskId || saving) return;
    setSaving(true);
    try { await updateCsTask(taskId, { assignee: userId }); toast.success("Você assumiu esse cartão"); onChanged?.(); }
    catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível salvar.")); }
    finally { setSaving(false); }
  };

  const startEdit = (ev) => { setConfirmId(null); setEditingId(ev.id); setEditText(ev.note || ""); };
  const saveEdit = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    try {
      await updateCsWorklistEventNote(editingId, editText);
      setEditingId(null); setEditText("");
      toast.success("Nota atualizada");
      await loadEvents();
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível editar.")); }
    finally { setSaving(false); }
  };
  const removeEvent = async (ev) => {
    if (saving) return;
    setSaving(true);
    try {
      await deleteCsWorklistEvent(ev.id);
      setConfirmId(null);
      toast.success("Registro apagado");
      await loadEvents();
    } catch (e) { console.error(e); toast.error(safeErrorMessage(e, "Não foi possível apagar.")); }
    finally { setSaving(false); }
  };

  const tier = row ? (row.is_standout ? "standout" : row.tier) : null;
  const headerTitle = row ? row.franchise_name : (task?.title || "Cartão");
  const headerSub = row ? `${row.city || ""}${row.state_uf ? ` · ${row.state_uf}` : ""}` : "Tarefa geral";
  const deltaStr = row?.revenue_delta_pct != null ? `${row.revenue_delta_pct > 0 ? "+" : ""}${row.revenue_delta_pct}%` : null;
  const mktCur = marketingLiquid(row?.marketing_amount_current || 0);
  const mktPrev = marketingLiquid(row?.marketing_amount_prev || 0);
  const agingDays = task ? differenceInCalendarDays(new Date(), new Date(task.moved_to_column_at)) : null;
  const isDone = task?.column_status === "feito";

  const raioX = row && (
    <div className="grid grid-cols-2 gap-2">
      <Metric icon="payments" label="Faturamento 30d" value={formatBRL(row.revenue_30d || 0)}
        hint={deltaStr ? `${deltaStr} vs mês anterior` : "base curta"}
        tone={row.revenue_delta_pct != null && row.revenue_delta_pct <= -15 ? "text-red-600" : undefined} />
      <Metric icon="trending_up" label="Margem bruta" value={row.gross_margin_pct_30d != null ? `${row.gross_margin_pct_30d}%` : "—"}
        tone={row.gross_margin_pct_30d != null && row.gross_margin_pct_30d < 0 ? "text-red-600" : undefined} />
      <Metric icon="shopping_cart" label="Última venda" value={daysAgo(row.days_since_last_sale)} />
      <Metric icon="local_shipping" label="Última compra fábrica" value={daysAgo(row.days_since_last_purchase)}
        tone={row.days_since_last_purchase >= 30 ? "text-red-600" : undefined} />
      <Metric icon="repeat" label="Compras 30d" value={`${row.purchase_count_30d ?? 0}`} hint={`antes: ${row.purchase_count_prev ?? 0}`} />
      <Metric icon="category" label="Variedade comprada" value={`${row.mix_distinct_30d ?? 0}`} hint={`antes: ${row.mix_distinct_prev ?? 0}`} />
      <Metric icon="inventory_2" label="Itens-chave zerados" value={`${row.zeroed_key_items_count ?? 0}`}
        hint={`de ${row.key_items_total ?? 0} que vende`} tone={row.zeroed_key_items_count >= 3 ? "text-amber-600" : undefined} />
      <Metric icon="smart_toy" label="Conversão do bot" value={row.bot_conversion_30d != null ? `${row.bot_conversion_30d}%` : "—"} />
      <Metric icon="credit_card" label="Assinatura R$150" value={row.subscription_overdue ? "Atrasada" : "Em dia"}
        tone={row.subscription_overdue ? "text-red-600" : "text-green-600"} />
      <Metric icon="campaign" label="Marketing 30d" value={formatBRL(mktCur)} hint={`antes: ${formatBRL(mktPrev)}`}
        tone={mktCur < mktPrev ? "text-red-600" : mktCur > 0 ? "text-green-600" : undefined} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {tier && <span>{TIER[tier].dot}</span>} {headerTitle}
              </DialogTitle>
              <p className="text-sm text-[#8a7e7e]">{headerSub}</p>
              {tier && (
                <span className={`inline-block w-fit text-xs px-2 py-0.5 rounded-full border ${TIER[tier].chip}`}>
                  {TIER[tier].label}
                </span>
              )}
            </DialogHeader>

            {/* Estado do cartão */}
            {task && (
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-[#b91c1c]/10 text-[#b91c1c] font-medium">
                  {task.source === "auto" ? "🤖 automático" : "✍️ manual"} · {COLUMN_LABEL[task.column_status]}
                </span>
                {!isDone && (
                  <span className={agingDays >= 7 ? "text-red-600 font-semibold" : agingDays >= 3 ? "text-amber-600" : "text-[#8a7e7e]"}>
                    parado há {agingDays}d
                  </span>
                )}
                {task.assignee === userId ? (
                  <span className="text-[#8a7e7e]">👤 você assumiu</span>
                ) : task.assignee ? (
                  <span className="text-[#8a7e7e]">👤 assumido por outro</span>
                ) : (
                  <button onClick={assignToMe} disabled={saving} className="text-[#b91c1c] font-medium underline">assumir</button>
                )}
              </div>
            )}
            {task?.description && !row && <p className="text-sm text-[#4a3d3d]">{task.description}</p>}

            {/* 🔎 POR QUÊ (só franquia) */}
            {(row?.flags?.length || 0) > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">Por quê</h3>
                <div className="flex flex-wrap gap-1.5">
                  {row.flags.map((f, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded ${SEV[f.sev] || SEV.low}`}>{f.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ✍️ REGISTRAR (só com cartão) */}
            {task && (
              <div className="border-t border-[#291715]/5 pt-4">
                <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">Registrar o que você fez</h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: liguei, vão repor o estoque na quinta…"
                  rows={2}
                  maxLength={1000}
                  className="w-full text-sm rounded-lg border border-[#291715]/15 p-2.5 focus:outline-none focus:border-[#b91c1c] resize-none"
                />

                {meetingMode ? (
                  <div className="mt-2 flex items-center flex-wrap gap-2 text-sm">
                    <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)}
                      className="rounded-md border border-[#291715]/15 px-2 py-1.5 text-sm focus:outline-none focus:border-[#b91c1c]" />
                    <Button size="sm" disabled={saving} onClick={confirmMeeting} className="bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1">
                      <MaterialIcon icon="check" size={16} /> Confirmar reunião
                    </Button>
                    <button onClick={() => { setMeetingMode(false); setMeetingDate(""); }} className="text-[#8a7e7e]">cancelar</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!isDone && (
                      <>
                        <Button size="sm" disabled={saving} onClick={registerContact}
                          className="bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1 min-h-[40px]">
                          <MaterialIcon icon="call" size={16} /> Falei com a franquia
                        </Button>
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => setMeetingMode(true)} className="gap-1 min-h-[40px]">
                          <MaterialIcon icon="event" size={16} /> Marcar reunião
                        </Button>
                        <Button size="sm" variant="outline" disabled={saving} onClick={resolve}
                          className="gap-1 min-h-[40px] text-green-700 border-green-300 hover:bg-green-50">
                          <MaterialIcon icon="check" size={16} /> Resolver
                        </Button>
                      </>
                    )}
                    {isDone && (
                      <Button size="sm" variant="outline" disabled={saving} onClick={reopen} className="gap-1 min-h-[40px]">
                        <MaterialIcon icon="undo" size={16} /> Reabrir
                      </Button>
                    )}
                    {note.trim() && (
                      <Button size="sm" variant="ghost" disabled={saving} onClick={justNote} className="gap-1 min-h-[40px]">
                        <MaterialIcon icon="sticky_note_2" size={16} /> Só anotar
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-[#8a7e7e] mt-2 leading-snug">
                  Cada registro entra no histórico abaixo (só você e o Nelson veem).
                  {task.source === "auto" && " Cartões automáticos reabrem sozinhos se o problema voltar."}
                </p>
              </div>
            )}

            {/* 📋 O QUE JÁ FOI FEITO */}
            {task && (
              <div className="border-t border-[#291715]/5 pt-4">
                <h3 className="text-xs font-bold text-[#4a3d3d] uppercase tracking-wide mb-2">O que já foi feito</h3>
                {events.length === 0 ? (
                  <p className="text-xs text-[#8a7e7e]">Nada registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev) => {
                      const canManage = isAdmin || (ev.created_by && ev.created_by === userId);
                      const isEditing = editingId === ev.id;
                      return (
                        <div key={ev.id} className="text-xs bg-[#fbf9fa] rounded-lg p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#4a3d3d] flex items-center gap-1">
                              <MaterialIcon icon={EVENT_ICON[ev.event_type] || "circle"} size={13} />
                              {EVENT_LABEL[ev.event_type] || ev.event_type}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[#8a7e7e]">{new Date(ev.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                              {canManage && !isEditing && (confirmId === ev.id ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[#8a7e7e]">Apagar?</span>
                                  <button type="button" onClick={() => removeEvent(ev)} disabled={saving} className="text-[#b91c1c] font-semibold">Sim</button>
                                  <button type="button" onClick={() => setConfirmId(null)} className="text-[#8a7e7e]">Não</button>
                                </span>
                              ) : (
                                <>
                                  <button type="button" onClick={() => startEdit(ev)} title="Editar nota" className="text-[#8a7e7e] hover:text-[#b91c1c]">
                                    <MaterialIcon icon="edit" size={14} />
                                  </button>
                                  <button type="button" onClick={() => setConfirmId(ev.id)} title="Apagar registro" className="text-[#8a7e7e] hover:text-[#b91c1c]">
                                    <MaterialIcon icon="delete" size={14} />
                                  </button>
                                </>
                              ))}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="mt-1.5">
                              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} maxLength={1000}
                                className="w-full text-xs rounded-md border border-[#291715]/15 p-2 focus:outline-none focus:border-[#b91c1c] resize-none" />
                              <div className="flex gap-2 mt-1">
                                <button type="button" onClick={saveEdit} disabled={saving} className="text-[#b91c1c] font-semibold">Salvar</button>
                                <button type="button" onClick={() => { setEditingId(null); setEditText(""); }} className="text-[#8a7e7e]">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            ev.note && <p className="text-[#4a3d3d] mt-1 whitespace-pre-wrap">{ev.note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 📊 RAIO-X (colapsável) */}
            {row && (
              <div className="border-t border-[#291715]/5 pt-4">
                <button onClick={() => setShowRaioX((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#4a3d3d] uppercase tracking-wide">
                  <span>Raio-x da unidade</span>
                  <MaterialIcon icon={showRaioX ? "expand_less" : "expand_more"} size={18} className="text-[#8a7e7e]" />
                </button>
                {showRaioX && <div className="mt-2">{raioX}</div>}
              </div>
            )}

            {/* Preview do Radar: criar cartão */}
            {isPreview && (
              <div className="border-t border-[#291715]/5 pt-4">
                <Button onClick={() => onCreateCard?.(row)} className="w-full bg-[#b91c1c] hover:bg-[#991b1b] text-white gap-1 min-h-[44px]">
                  <MaterialIcon icon="add" size={16} /> Criar cartão pra essa franquia
                </Button>
                <p className="text-[11px] text-[#8a7e7e] mt-2 leading-snug">
                  As franquias 🟡 atenção não viram cartão automático — crie um aqui quando quiser agir.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
