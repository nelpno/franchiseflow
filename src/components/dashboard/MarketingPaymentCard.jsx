import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarketingPayment } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getMarketingTargetMonth } from "@/lib/franchiseUtils";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Lembrete inteligente de marketing no Dashboard.
 * Aparece APENAS quando o franqueado precisa agir:
 * - Ultimos 5 dias do mes e nao registrou proximo mes
 * - Mes corrente e nao registrou este mes
 * - Pagamento rejeitado
 * Desaparece quando pagamento esta pending ou confirmed.
 */
export default function MarketingPaymentCard() {
  const { selectedFranchise: ctxFranchise } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const evoId = ctxFranchise?.evolution_instance_id;

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    if (!evoId) return;
    try {
      const data = await MarketingPayment.filter(
        { franchise_id: evoId },
        "-reference_month",
        6
      );
      if (mountedRef.current) setPayments(data);
    } catch (err) {
      console.warn("Erro ao carregar pagamentos marketing:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [evoId]);

  useEffect(() => {
    mountedRef.current = true;
    loadPayments();
    return () => { mountedRef.current = false; };
  }, [loadPayments]);

  if (loading || !evoId) return null;

  const targetDate = getMarketingTargetMonth();
  const targetMonth = format(targetDate, "yyyy-MM");
  const targetMonthLabel = cap(format(targetDate, "MMMM", { locale: ptBR }));

  const payment = payments.find((p) => p.reference_month === targetMonth);

  // Nao mostrar se: ja registrou e nao foi rejeitado
  if (payment && payment.status !== "rejected") return null;

  // Mostrar lembrete
  const isRejected = payment?.status === "rejected";

  return (
    <Card
      className="mb-4 border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => navigate("/Marketing")}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isRejected ? "bg-[#dc2626]/10" : "bg-[#d4af37]/10"}`}>
            <MaterialIcon
              icon={isRejected ? "error" : "campaign"}
              size={22}
              className={isRejected ? "text-[#dc2626]" : "text-[#d4af37]"}
            />
          </div>
          <div className="flex-1 min-w-0">
            {isRejected ? (
              <>
                <p className="text-sm font-medium text-[#dc2626]">
                  Pagamento de {targetMonthLabel} recusado
                </p>
                <p className="text-xs text-[#7a6d6d] truncate">
                  {payment.rejection_reason || "Reenvie seu comprovante"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[#1b1c1d]">
                  Investimento Marketing — {targetMonthLabel}
                </p>
                <p className="text-xs text-[#7a6d6d]">
                  Registre seu investimento (min {formatBRL(200)})
                </p>
              </>
            )}
          </div>
          <MaterialIcon icon="chevron_right" size={20} className="text-[#7a6d6d]" />
        </div>
      </CardContent>
    </Card>
  );
}
