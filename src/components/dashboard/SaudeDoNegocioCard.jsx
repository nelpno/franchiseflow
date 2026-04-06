import { useState } from "react";
import ProgressRing from "@/components/onboarding/ProgressRing";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/healthScore";
import DiagnosticoSheet from "./DiagnosticoSheet";

export default function SaudeDoNegocioCard({ healthResult, franchise, botReport }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!healthResult) return null;

  const statusColors = STATUS_COLORS[healthResult.status] || STATUS_COLORS.nova;
  const statusLabel = STATUS_LABELS[healthResult.status] || "Nova";
  const score = Math.round(healthResult.total);
  const coachingMessage = healthResult.problems?.length > 0
    ? healthResult.problems[0]
    : "Tudo em dia! Continue assim.";
  const hasProblems = healthResult.problems?.length > 0;

  return (
    <>
      <div
        className="mb-4 rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow"
        style={{
          background: `linear-gradient(135deg, ${statusColors.bg}, #ffffff)`,
          borderColor: statusColors.border,
        }}
        onClick={() => setSheetOpen(true)}
      >
        <div className="flex items-center gap-4">
          <ProgressRing
            size={72}
            progress={score}
            color={statusColors.text}
            label={String(score)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15px] font-semibold text-[#1b1c1d]">Saúde do Negócio</span>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}
              >
                {statusLabel}
              </span>
            </div>
            <p className="text-[13px] text-[#4a3d3d] leading-snug">
              {hasProblems ? (
                <><span className="mr-1">⚠️</span><strong className="font-medium">Foco:</strong> {coachingMessage}</>
              ) : (
                coachingMessage
              )}
            </p>
            <p className="text-xs text-[#b91c1c] font-medium mt-1">
              Ver diagnóstico completo →
            </p>
          </div>
        </div>
      </div>

      <DiagnosticoSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        healthResult={healthResult}
        franchise={franchise}
        botReport={botReport}
      />
    </>
  );
}
