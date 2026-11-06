import MaterialIcon from "@/components/ui/MaterialIcon";
import HelpTip from "@/components/shared/HelpTip";
import { hojeBRT, novoItem, vencido } from "@/lib/horarioEspecial";

/**
 * Horário especial com data (06/11/2026): feriado, viagem, evento. Vale só nas datas; o horário da semana não muda.
 * Formato e regras: src/lib/horarioEspecial.js (o robô lê a mesma coluna, franchise_configurations.horario_especial).
 * Item vencido aparece riscado e sai ao salvar (buildDbPayload).
 */
const campo = "bg-surface-line border-none rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/20";
const rotulo = "block text-[11px] font-semibold text-ink-2 mb-1";
const dica = "text-[11px] text-ink-2/60 mt-1";

export default function HorarioEspecialCard({ value, onChange, hasDelivery, hasPickup }) {
  const lista = Array.isArray(value) ? value : [];
  const hoje = hojeBRT();
  const duas = !!hasDelivery && !!hasPickup;
  const set = (i, patch) => onChange(lista.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3 sm:rounded-2xl sm:border sm:border-surface-line/20 sm:p-4">
      <div>
        <p className="text-sm font-bold text-ink-2 flex items-center gap-1.5">
          <MaterialIcon icon="calendar_clock" size={16} />Horário especial <HelpTip tip="horarioEspecial" />
        </p>
        <p className={dica}>Um dia ou período fora do normal (feriado, viagem, evento). Vale só nessas datas; o horário da semana não muda.</p>
      </div>
      {lista.map((x, i) => {
        const passou = vencido(x, hoje);
        const horario = x.tipo === "horario";
        return (
          <div key={i} className={`rounded-xl bg-surface p-2.5 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-2 sm:gap-3 ${passou ? "opacity-60" : ""}`}>
            <label className="min-w-0">
              <span className={rotulo}>{horario ? "Dia" : "De"}</span>
              <input type="date" className={`${campo} w-full sm:w-40`} min={passou ? undefined : hoje} value={x.de || ""}
                onChange={(e) => { const de = e.target.value; set(i, { de, ate: horario || !x.ate || x.ate < de ? de : x.ate }); }} />
            </label>
            {!horario && (
              <label className="min-w-0">
                <span className={rotulo}>Até</span>
                <input type="date" className={`${campo} w-full sm:w-40`} min={x.de || hoje} value={x.ate || x.de || ""}
                  onChange={(e) => set(i, { ate: e.target.value })} />
              </label>
            )}
            <label className="min-w-0 col-span-2 sm:col-span-1">
              <span className={rotulo}>Como fica</span>
              <select className={`${campo} w-full sm:w-44`} value={horario ? "horario" : "fechado"}
                onChange={(e) => (e.target.value === "horario"
                  ? set(i, { tipo: "horario", ate: x.de, abre: x.abre || "09:00", fecha: x.fecha || "13:00" })
                  : set(i, { tipo: "fechado", abre: undefined, fecha: undefined }))}>
                <option value="fechado">Fechado</option>
                <option value="horario">Horário diferente</option>
              </select>
            </label>
            {horario && (
              <>
                <label className="min-w-0">
                  <span className={rotulo}>Abre</span>
                  <input type="time" className={`${campo} w-full sm:w-28`} value={x.abre || ""} onChange={(e) => set(i, { abre: e.target.value })} />
                </label>
                <label className="min-w-0">
                  <span className={rotulo}>Fecha</span>
                  <input type="time" className={`${campo} w-full sm:w-28`} value={x.fecha || ""} onChange={(e) => set(i, { fecha: e.target.value })} />
                </label>
              </>
            )}
            {duas && (
              <label className="min-w-0 col-span-2 sm:col-span-1">
                <span className={rotulo}>Vale para</span>
                <select className={`${campo} w-full sm:w-48`} value={x.vale || "ambos"} onChange={(e) => set(i, { vale: e.target.value })}>
                  <option value="ambos">Entrega e retirada</option>
                  <option value="entrega">Só entrega</option>
                  <option value="retirada">Só retirada</option>
                </select>
              </label>
            )}
            <div className="col-span-2 sm:col-span-1 sm:ml-auto flex items-center justify-between gap-2">
              {passou && <span className="text-[11px] text-ink-2/70"><span className="line-through">já passou</span>: o robô não usa mais</span>}
              <button type="button" aria-label="Apagar horário especial" onClick={() => onChange(lista.filter((_, j) => j !== i))}
                className="ml-auto text-ink-2/40 hover:text-err p-2">
                <MaterialIcon icon="close" size={18} />
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...lista, novoItem()])}
        className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark">
        <MaterialIcon icon="add" size={16} />Adicionar dia especial
      </button>
    </div>
  );
}
