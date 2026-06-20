import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { getFranchiseHealthSignals, getCsWorklist } from "@/entities/all";
import FranchiseDrawer from "@/components/customer-success/FranchiseDrawer";
import { TIER, SEV } from "@/components/customer-success/tierConfig";

const STATUS_LABEL = {
  a_contatar: "A contatar",
  contatado: "Contatado",
  reuniao_marcada: "Reunião marcada",
  resolvido: "Resolvido",
};

function effectiveTier(row) {
  return row.is_standout ? "standout" : row.tier;
}

// Suprime alertas leves após contato; crítico NUNCA é suprimido (reabre sozinho)
function computeSuppressed(row, wl) {
  if (!wl || row.tier === "critical") return false;
  if (wl.status === "resolvido") return true;
  if ((wl.status === "contatado" || wl.status === "reuniao_marcada") && wl.last_contact_at) {
    const days = (Date.now() - new Date(wl.last_contact_at).getTime()) / 86400000;
    return days < 7;
  }
  return false;
}

const FILTERS = [
  { key: "alertas", label: "Alertas", icon: "notifications_active" },
  { key: "critical", label: "🔴 Crítico" },
  { key: "attention", label: "🟡 Atenção" },
  { key: "standout", label: "🏆 Destaque" },
  { key: "healthy", label: "🟢 Saudável" },
  { key: "dormant", label: "⚪ Dormente" },
  { key: "todas", label: "Todas" },
];

export default function CustomerSuccess() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("alertas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [signals, worklist] = await Promise.all([getFranchiseHealthSignals(), getCsWorklist()]);
      const wlMap = Object.fromEntries((worklist || []).map((w) => [w.franchise_id, w]));
      const merged = (signals || []).map((s) => {
        const wl = wlMap[s.franchise_id] || null;
        return { ...s, wl, suppressed: computeSuppressed(s, wl), status: wl?.status || "a_contatar" };
      });
      if (mountedRef.current) setRows(merged);
    } catch (e) {
      console.error("[CustomerSuccess] load failed", e);
      if (mountedRef.current) setError("Não foi possível carregar a saúde da rede. Tente novamente.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { alertas: 0, critical: 0, attention: 0, standout: 0, healthy: 0, dormant: 0, todas: rows.length };
    for (const r of rows) {
      const t = effectiveTier(r);
      c[t] = (c[t] || 0) + 1;
      if ((r.tier === "critical" || r.tier === "attention") && !r.suppressed) c.alertas += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q && !(`${r.franchise_name} ${r.city || ""}`.toLowerCase().includes(q))) return false;
      const t = effectiveTier(r);
      if (filter === "todas") return true;
      if (filter === "alertas") return (r.tier === "critical" || r.tier === "attention") && !r.suppressed;
      return t === filter;
    });
    list.sort((a, b) => {
      if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
      const ra = TIER[effectiveTier(a)].rank, rb = TIER[effectiveTier(b)].rank;
      if (ra !== rb) return ra - rb;
      return (b.flags?.length || 0) - (a.flags?.length || 0);
    });
    return list;
  }, [rows, filter, search]);

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1b1c1d] flex items-center gap-2">
          <MaterialIcon icon="monitor_heart" className="text-[#b91c1c]" /> Customer Success
        </h1>
        <p className="text-sm text-[#4a3d3d] mt-1">
          Saúde da rede — quem precisa de atenção agora, por quê, e o que fazer.
        </p>
      </div>

      {/* Filtros */}
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
              <span className={`ml-1.5 ${filter === f.key ? "opacity-90" : "text-[#8a7e7e]"}`}>
                {counts[f.key]}
              </span>
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

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-[#4a3d3d]">
          <p>{error}</p>
          <button onClick={load} className="mt-3 text-[#b91c1c] font-semibold">Tentar novamente</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-[#8a7e7e]">
          <MaterialIcon icon="check_circle" size={40} className="text-green-500 mb-2" />
          <p>Nenhuma franquia neste filtro. 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const t = effectiveTier(r);
            return (
              <button
                key={r.franchise_id}
                onClick={() => setSelected(r)}
                className={`w-full text-left bg-white rounded-xl border border-[#291715]/5 shadow-sm hover:shadow-md transition-all p-4 flex items-start gap-3 ${
                  r.suppressed ? "opacity-50" : ""
                }`}
              >
                <span className="text-lg leading-none mt-0.5">{TIER[t].dot}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1b1c1d] truncate">{r.franchise_name}</span>
                    <span className="text-xs text-[#8a7e7e]">{r.city}</span>
                    {r.status !== "a_contatar" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#b91c1c]/10 text-[#b91c1c] font-medium">
                        {STATUS_LABEL[r.status]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(r.flags || []).slice(0, 4).map((f, i) => (
                      <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded ${SEV[f.sev] || SEV.low}`}>
                        {f.label}
                      </span>
                    ))}
                    {(r.flags?.length || 0) > 4 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        +{r.flags.length - 4}
                      </span>
                    )}
                    {t === "standout" && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        Acima da média da rede
                      </span>
                    )}
                  </div>
                </div>
                <MaterialIcon icon="chevron_right" className="text-[#c4b8b8] shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <FranchiseDrawer
        row={selected}
        userId={user?.id}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}
