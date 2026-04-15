import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";
import { getMarketingTargetMonth } from "@/lib/franchiseUtils";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import SubscriptionPaymentSheet from "@/components/shared/SubscriptionPaymentSheet";

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function FinancialObligationsCard({ marketingPayment }) {
  const navigate = useNavigate();
  const { subscription, isLoading: subLoading, checkPaymentNow, isChecking } = useSubscriptionStatus();
  const [sheetOpen, setSheetOpen] = useState(false);

  const targetDate = getMarketingTargetMonth();
  const targetMonth = format(targetDate, "yyyy-MM");
  const targetMonthLabel = cap(format(targetDate, "MMMM", { locale: ptBR }));

  const marketingPaymentForMonth =
    marketingPayment?.reference_month === targetMonth ? marketingPayment : null;
  const showMarketingRow =
    !marketingPaymentForMonth || marketingPaymentForMonth.status === "rejected";

  const showSubscriptionRow = !!subscription;
  const subStatus = subscription?.current_payment_status;

  if (!showSubscriptionRow && !showMarketingRow) return null;

  const subMonthLabel = (() => {
    if (!subscription?.current_payment_due_date) {
      return cap(format(new Date(), "MMMM", { locale: ptBR }));
    }
    return cap(
      format(new Date(subscription.current_payment_due_date + "T12:00:00"), "MMMM", { locale: ptBR })
    );
  })();

  const subDueDateFormatted = subscription?.current_payment_due_date
    ? format(new Date(subscription.current_payment_due_date + "T12:00:00"), "dd/MM")
    : null;

  const subValue = subscription?.current_payment_value
    ? formatBRL(subscription.current_payment_value)
    : "R$ 150,00";

  const isPaidStatus =
    subStatus === "PAID" || subStatus === "RECEIVED" || subStatus === "CONFIRMED";

  const subIconName = isPaidStatus
    ? "check_circle"
    : subStatus === "OVERDUE"
    ? "warning"
    : "schedule";

  const subIconBg = isPaidStatus
    ? "bg-green-100"
    : subStatus === "OVERDUE"
    ? "bg-red-100"
    : "bg-[#d4af37]/10";

  const subIconColor = isPaidStatus
    ? "text-green-600"
    : subStatus === "OVERDUE"
    ? "text-red-600"
    : "text-[#d4af37]";

  const subSubtitle = isPaidStatus
    ? "Pago"
    : subStatus === "OVERDUE"
    ? "Regularize para evitar bloqueio"
    : subDueDateFormatted
    ? `${subValue} · vence ${subDueDateFormatted}`
    : subValue;

  const isRejected = marketingPaymentForMonth?.status === "rejected";

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardContent className="p-0">
        {showSubscriptionRow && (
          <div className="p-4 flex items-center gap-3">
            <div
              className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${subIconBg}`}
            >
              <MaterialIcon icon={subIconName} size={20} className={subIconColor} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1b1c1d] truncate">
                Sua Equipe Digital — {subMonthLabel}
              </p>
              <p className="text-xs text-[#7a6d6d] mt-0.5">{subSubtitle}</p>
            </div>

            <div className="shrink-0">
              {isPaidStatus ? (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Pago
                </span>
              ) : subStatus === "OVERDUE" ? (
                <button
                  onClick={() => setSheetOpen(true)}
                  className="rounded-lg text-xs font-medium px-3 py-1.5 active:scale-95 transition-transform bg-[#b91c1c] text-white"
                >
                  Regularizar
                </button>
              ) : (
                <button
                  onClick={() => setSheetOpen(true)}
                  className="rounded-lg text-xs font-medium px-3 py-1.5 active:scale-95 transition-transform border border-[#b91c1c] text-[#b91c1c] bg-white"
                >
                  Pagar →
                </button>
              )}
            </div>
          </div>
        )}

        {showSubscriptionRow && showMarketingRow && <Separator />}

        {showMarketingRow && (
          <div
            className="p-4 flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/Marketing")}
          >
            <div
              className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${
                isRejected ? "bg-red-100" : "bg-[#d4af37]/10"
              }`}
            >
              <MaterialIcon
                icon={isRejected ? "error" : "campaign"}
                size={20}
                className={isRejected ? "text-red-600" : "text-[#d4af37]"}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  isRejected ? "text-red-600" : "text-[#1b1c1d]"
                }`}
              >
                {isRejected
                  ? `Pagamento de ${targetMonthLabel} recusado`
                  : `Investimento Marketing — ${targetMonthLabel}`}
              </p>
              <p className="text-xs text-[#7a6d6d] mt-0.5">
                {isRejected
                  ? marketingPaymentForMonth?.rejection_reason || "Reenvie seu comprovante"
                  : "Registre seu investimento (min R$ 200)"}
              </p>
            </div>

            <MaterialIcon icon="chevron_right" size={20} className="text-[#7a6d6d] shrink-0" />
          </div>
        )}
      </CardContent>

      <SubscriptionPaymentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        subscription={subscription}
        checkPaymentNow={checkPaymentNow}
        isChecking={isChecking}
      />
    </Card>
  );
}
