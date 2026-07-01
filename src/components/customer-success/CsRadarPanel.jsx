import { useState, useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Input } from "@/components/ui/input";
import { TIER, SEV } from "./tierConfig";

// Radar da rede: as 56 franquias por tier (o que o Celso já via no v1).
// Daqui ele cria cartão (as 🟡 atenção não viram cartão automático — só as 🔴).

function effectiveTier(row) {
  return row.is_standout ? "standout" : row.tier;
}

const FILTERS = [
  { key: "risco", label: "Em risco" },
  { key: "critical", label: "🔴 Crítico" },
  { key: "attention", label: "🟡 Atenção" },
  { key: "standout", label: "🏆 Destaque" },
  { key: "healthy", label: "🟢 Saudável" },
  { key: "dormant", label: "⚪ Dormente" },
  { key: "todas", label: "Todas" },
];

export default function CsRadarPanel({ rows, openCardIds, onCreateCard, onOpenPreview }) {
  const [filter, setFilter] = useState("risco");
  const [search, setSearch] = useState("");
  const open = openCardIds || new Set();

  const counts = useMemo(() => {
    const c = { risco: 0, critical: 0, attention: 0, standout: 0, healthy: 0, dormant: 0, todas: rows.length };
    for (const r of rows) {
      const t = effectiveTier(r);
      c[t] = (c[t] || 0) + 1;
      if (r.tier === "critical" || r.tier === "attention") c.risco += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (q && !`${r.franchise_name} ${r.city || ""}`.toLowerCase().includes(q)) return false;
      const t = effectiveTier(r);
      if (filter === "todas") return true;
      if (filter === "risco") return r.tier === "critical" || r.tier === "attention";
      return t === filter;
    });
    list.sort((a, b) => {
      const ra = TIER[effectiveTier(a)].rank, rb = TIER[effectiveTier(b)].rank;
      if (ra !== rb) return ra - rb;
      return (b.flags?.length || 0) - (a.flags?.length || 0);
    });
    return list;
  }, [rows, filter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              filter === f.key
                ? "bg-[#b91c1c] text-white border-[#b91c1c]"
                : "bg-white text-[#4a3d3d] border-[#291715]/10 hover:border-[#b91c1c]/40"
            }`}
          >
            {f.label}
            {counts[f.key] != null && (
              <span className={`ml-1.5 ${filter === f.key ? "opacity-90" : "text-[#8a7e7e]"}`}>{counts[f.key]}</span>
            )}
          </button>
        ))}
      </div>

      <Input
        placeholder="Buscar por nome ou cidade…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {visible.length === 0 ? (
        <div className="text-center py-12 text-[#8a7e7e]">Nenhuma franquia neste filtro.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const t = effectiveTier(r);
            const hasCard = open.has(r.franchise_id);
            return (
              <div
                key={r.franchise_id}
                className="bg-white rounded-xl border border-[#291715]/5 shadow-sm hover:shadow-md transition-all p-3 flex items-start gap-3"
              >
                <button onClick={() => onOpenPreview?.(r)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                  <span className="text-lg leading-none mt-0.5">{TIER[t].dot}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1b1c1d] truncate">{r.franchise_name}</span>
                      <span className="text-xs text-[#8a7e7e]">{r.city}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(r.flags || []).slice(0, 3).map((f, i) => (
                        <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded ${SEV[f.sev] || SEV.low}`}>{f.label}</span>
                      ))}
                      {(r.flags?.length || 0) > 3 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">+{r.flags.length - 3}</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="shrink-0">
                  {hasCard ? (
                    <span className="text-[11px] text-[#8a7e7e] flex items-center gap-1">
                      <MaterialIcon icon="task_alt" size={14} /> no mural
                    </span>
                  ) : (
                    <button
                      onClick={() => onCreateCard?.(r)}
                      className="text-[11px] font-semibold text-[#b91c1c] border border-[#b91c1c]/30 rounded-full px-2 py-1 hover:bg-[#b91c1c]/5 flex items-center gap-1"
                    >
                      <MaterialIcon icon="add" size={14} /> cartão
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
