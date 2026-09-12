import React, { useRef, useEffect } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

const STEPS = [
  { num: 1, label: "Sua unidade", icon: "storefront" },
  { num: 2, label: "Entrega e retirada", icon: "local_shipping" },
  { num: 3, label: "Pagamento", icon: "payments" },
  { num: 4, label: "Vendedor", icon: "smart_toy" },
  { num: 5, label: "Revisão", icon: "checklist" },
];

export { STEPS };

export default function WizardStepper({ currentStep, completedSteps = [], skippedSteps = [], onStepClick }) {
  // Revisão (step 5) não conta como etapa — é apenas visualização
  const REVIEW_STEP = 5;
  const countableSteps = STEPS.filter(s => s.num !== REVIEW_STEP && !skippedSteps.includes(s.num));
  const completedCount = completedSteps.filter(s => s !== REVIEW_STEP && !skippedSteps.includes(s)).length;
  const progressPct = countableSteps.length > 0 ? Math.round((completedCount / countableSteps.length) * 100) : 0;
  const scrollRef = useRef(null);
  const stepRefs = useRef({});

  // Auto-scroll to center active step
  useEffect(() => {
    const container = scrollRef.current;
    const activeEl = stepRefs.current[currentStep];
    if (container && activeEl) {
      const scrollLeft = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    }
  }, [currentStep]);

  return (
    <div className="w-full space-y-3">
      {/* Progress summary */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-surface-line rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-brand to-brand-gold"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-ink-2 whitespace-nowrap">
          {completedCount}/{countableSteps.length} etapas
        </span>
      </div>

      {/* Step indicators — auto-scroll to active */}
      <div ref={scrollRef} className="overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div className="flex items-center gap-1 w-max md:w-full md:justify-between px-2">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.num;
            const isCompleted = completedSteps.includes(step.num);
            const isSkipped = skippedSteps.includes(step.num);
            const isLast = idx === STEPS.length - 1;

            return (
              <React.Fragment key={step.num}>
                <button
                  ref={(el) => { stepRefs.current[step.num] = el; }}
                  type="button"
                  onClick={() => onStepClick?.(step.num)}
                  className="flex flex-col items-center gap-1 group cursor-pointer shrink-0"
                  title={step.label}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? "bg-brand text-white shadow-md shadow-brand/30 ring-2 ring-brand/20 ring-offset-2 scale-110"
                        : isCompleted
                        ? "bg-brand/15 text-brand"
                        : isSkipped
                        ? "bg-surface-line/50 text-[#3d4a42]/30"
                        : "bg-surface-line text-[#3d4a42]"
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
                    className={`text-[11px] font-medium leading-tight text-center w-20 ${
                      isActive
                        ? "text-brand font-bold"
                        : isCompleted
                        ? "text-brand/70 font-semibold"
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
                    className={`w-6 md:flex-1 h-[2px] shrink-0 transition-colors ${
                      isCompleted ? "bg-brand/30" : "bg-surface-line"
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
