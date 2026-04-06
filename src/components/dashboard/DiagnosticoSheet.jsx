import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ProgressRing from "@/components/onboarding/ProgressRing";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/healthScore";
import BotCoachSheet from "./BotCoachSheet";

const DIMENSION_CONFIG = {
  vendas: { label: "Vendas", icon: "point_of_sale" },
  estoque: { label: "Estoque", icon: "inventory_2" },
  reposicao: { label: "Reposição", icon: "local_shipping" },
  setup: { label: "Configuração", icon: "settings" },
  bot: { label: "Vendedor Digital", icon: "smart_toy" },
};

function DimensionBar({ name, dim }) {
  const cfg = DIMENSION_CONFIG[name];
  if (!cfg) return null;
  if (name === "bot" && !dim.hasData) return null;

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

export default function DiagnosticoSheet({ isOpen, onClose, healthResult, franchise, botReport }) {
  const navigate = useNavigate();
  const [botSheetOpen, setBotSheetOpen] = useState(false);

  if (!healthResult) return null;

  const statusColors = STATUS_COLORS[healthResult.status] || STATUS_COLORS.nova;
  const statusLabel = STATUS_LABELS[healthResult.status] || "Nova";
  const evoId = franchise?.evolution_instance_id;

  return (
    <>
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

          {/* Bot section */}
          <div className="border-t border-[#e9e8e9] pt-4 mb-6">
            <h3 className="text-sm font-semibold text-[#1b1c1d] mb-2 flex items-center gap-2">
              <MaterialIcon icon="smart_toy" size={18} />
              Vendedor Digital
            </h3>
            {botReport ? (
              <div className="space-y-3">
                {botReport.metrics?.autonomy_rate != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4a3d3d]">Autonomia</span>
                    <span className="font-semibold" style={{
                      color: botReport.metrics.autonomy_rate >= 60 ? "#16a34a" : botReport.metrics.autonomy_rate >= 30 ? "#d97706" : "#dc2626"
                    }}>
                      {Math.round(botReport.metrics.autonomy_rate)}%
                    </span>
                  </div>
                )}
                {botReport.metrics?.total_conversations != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4a3d3d]">Atendimentos no período</span>
                    <span className="font-semibold text-[#1b1c1d]">{botReport.metrics.total_conversations}</span>
                  </div>
                )}
                {botReport.metrics?.conversion_rate != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4a3d3d]">Taxa de conversão</span>
                    <span className="font-semibold text-[#1b1c1d]">{Math.round(botReport.metrics.conversion_rate)}%</span>
                  </div>
                )}
                {botReport.report_text && (
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e9e8e9]">
                    <p className="text-xs font-semibold text-[#7a6d6d] mb-1">Análise do Coach</p>
                    <div className="relative max-h-[72px] overflow-hidden">
                      <p className="text-sm text-[#4a3d3d] leading-relaxed whitespace-pre-line">{botReport.report_text}</p>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#f8fafc] to-transparent" />
                    </div>
                    <button
                      onClick={() => setBotSheetOpen(true)}
                      className="text-xs text-[#b91c1c] font-medium mt-1 hover:underline"
                    >
                      Ler relatório completo →
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setBotSheetOpen(true)}
                  className="text-sm text-[#b91c1c] font-medium hover:underline"
                >
                  Ver histórico completo →
                </button>
              </div>
            ) : evoId ? (
              <div>
                <p className="text-sm text-[#4a3d3d] mb-2">
                  Aguardando primeiro relatório do bot. Dados aparecem após o relatório quinzenal.
                </p>
                <button
                  onClick={() => setBotSheetOpen(true)}
                  className="text-sm text-[#b91c1c] font-medium hover:underline"
                >
                  Ver detalhes →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[#4a3d3d] mb-3">
                  Franquias com vendedor digital vendem em média 40% mais. Ative o seu!
                </p>
                <Button
                  size="sm"
                  onClick={() => { onClose(false); navigate("/FranchiseSettings"); }}
                  className="bg-[#b91c1c] hover:bg-[#991b1b] text-white"
                >
                  <MaterialIcon icon="smart_toy" size={16} className="mr-1" />
                  Configurar Vendedor
                </Button>
              </div>
            )}
          </div>

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

      {evoId && (
        <BotCoachSheet
          franchiseId={evoId}
          isOpen={botSheetOpen}
          onClose={() => setBotSheetOpen(false)}
        />
      )}
    </>
  );
}
