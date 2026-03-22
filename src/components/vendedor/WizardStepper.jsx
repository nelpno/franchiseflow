import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

const STEPS = [
  { num: 1, label: "Sua Unidade", icon: "storefront" },
  { num: 2, label: "Horários", icon: "schedule" },
  { num: 3, label: "Operação", icon: "settings" },
  { num: 4, label: "Entrega", icon: "delivery_dining" },
  { num: 5, label: "Vendedor", icon: "smart_toy" },
  { num: 6, label: "Revisão", icon: "checklist" },
];

export { STEPS };

export default function WizardStepper({ currentStep, completedSteps = [], skippedSteps = [], onStepClick }) {
  const activeSteps = STEPS.filter(s => !skippedSteps.includes(s.num));
  const completedCount = completedSteps.filter(s => !skippedSteps.includes(s)).length;
  const progressPct = activeSteps.length > 0 ? Math.round((completedCount / activeSteps.length) * 100) : 0;

  return (
    <div className="w-full space-y-3">
      {/* Progress summary */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-[#e9e8e9] rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-[#b91c1c] to-[#d4af37]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[#534343] whitespace-nowrap">
          {completedCount}/{activeSteps.length} etapas
        </span>
      </div>

      {/* Step indicators */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center justify-between min-w-[600px] md:min-w-0">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.num;
            const isCompleted = completedSteps.includes(step.num);
            const isSkipped = skippedSteps.includes(step.num);
            const isLast = idx === STEPS.length - 1;

            return (
              <React.Fragment key={step.num}>
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.num)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                  title={step.label}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#b91c1c] text-white shadow-md shadow-[#b91c1c]/30 ring-2 ring-[#b91c1c]/20 ring-offset-2"
                        : isCompleted
                        ? "bg-[#b91c1c]/15 text-[#b91c1c]"
                        : isSkipped
                        ? "bg-[#e9e8e9]/50 text-[#3d4a42]/30"
                        : "bg-[#e9e8e9] text-[#3d4a42]"
                    }`}
                  >
                    {isCompleted ? (
                      <MaterialIcon icon="check_circle" filled size={20} />
                    ) : isSkipped ? (
                      <MaterialIcon icon="remove" size={16} />
                    ) : (
                      <MaterialIcon icon={step.icon} size={18} />
                    )}
                  </div>
                  <span
                    className={`hidden md:block text-[10px] font-medium leading-tight text-center max-w-[70px] ${
                      isActive
                        ? "text-[#b91c1c] font-bold"
                        : isCompleted
                        ? "text-[#b91c1c]/70 font-semibold"
                        : isSkipped
                        ? "text-[#3d4a42]/30"
                        : "text-[#3d4a42]/60"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className={`flex-1 h-[2px] mx-1 mt-[-16px] md:mt-[-12px] transition-colors ${
                      isCompleted ? "bg-[#b91c1c]/30" : "bg-[#e9e8e9]"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
