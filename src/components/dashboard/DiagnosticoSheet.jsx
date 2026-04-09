import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ProgressRing from "@/components/onboarding/ProgressRing";
import { STATUS_COLORS, STATUS_LABELS, SETUP_SIGNAL_LABELS } from "@/lib/healthScore";

const DIMENSION_CONFIG = {
  vendas: { label: "Vendas", icon: "point_of_sale" },
  estoque: { label: "Estoque", icon: "inventory_2" },
  reposicao: { label: "Reposição", icon: "local_shipping" },
  setup: { label: "Configuração", icon: "settings" },
};

function DimensionBar({ name, dim }) {
  const cfg = DIMENSION_CONFIG[name];
  if (!cfg) return null;

  const score = Math.round(dim.score);
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="flex items-center gap-3">
      <MaterialIcon icon={cfg.icon} size={18} style={{ color }} />
      <span className="text-xs text-[#4a3d3d] w-20 shrink-0">{cfg.label}</span>
      <div className="flex-1 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{score}%</span>
    </div>
  );
}

export default function DiagnosticoSheet({ isOpen, onClose, healthResult, franchise }) {
  const navigate = useNavigate();

  if (!healthResult) return null;

  const statusColors = STATUS_COLORS[healthResult.status] || STATUS_COLORS.nova;
  const statusLabel = STATUS_LABELS[healthResult.status] || "Nova";

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-[#1b1c1d]">
              Diagnóstico — {franchise?.city || "Sua Franquia"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex items-center gap-4 mb-6">
            <ProgressRing
              size={80}
              progress={healthResult.total}
              color={statusColors.text}
              label={String(Math.round(healthResult.total))}
            />
            <div>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
              >
                {statusLabel}
              </span>
              <p className="text-sm text-[#4a3d3d] mt-1">
                {healthResult.total >= 75
                  ? "Seu negócio está indo muito bem!"
                  : healthResult.total >= 50
                  ? "Há pontos que precisam de atenção."
                  : "Algumas áreas precisam de ação urgente."}
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-[#1b1c1d]">Dimensões</h3>
            {Object.entries(healthResult.dimensions).map(([key, dim]) => (
              <DimensionBar key={key} name={key} dim={dim} />
            ))}
          </div>

          {/* Setup signals checklist */}
          {healthResult.dimensions.setup?.signals && (
            <div className="border-t border-[#e9e8e9] pt-4 mb-6">
              <h3 className="text-sm font-semibold text-[#1b1c1d] mb-3 flex items-center gap-2">
                <MaterialIcon icon="checklist" size={18} />
                Configuração Operacional
              </h3>
              <div className="space-y-2">
                {Object.entries(healthResult.dimensions.setup.signals).map(([key, done]) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <MaterialIcon
                      icon={done ? "check_circle" : "radio_button_unchecked"}
                      size={18}
                      style={{ color: done ? "#16a34a" : "#d1d5db" }}
                    />
                    <span className={`text-sm ${done ? "text-[#4a3d3d]" : "text-[#7a6d6d]"}`}>
                      {SETUP_SIGNAL_LABELS[key] || key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Problems */}
          {healthResult.problems?.length > 0 && (
            <div className="border-t border-[#e9e8e9] pt-4">
              <h3 className="text-sm font-semibold text-[#1b1c1d] mb-2">Problemas identificados</h3>
              <ul className="space-y-2">
                {healthResult.problems.map((problem, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#4a3d3d]">
                    <MaterialIcon icon="warning" size={16} className="text-[#d97706] mt-0.5 shrink-0" />
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SheetContent>
    </Sheet>
  );
}
