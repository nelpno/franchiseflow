import { useState } from "react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function SubscriptionPaywall() {
  const { isOverdue, isLoading, subscription, checkPaymentNow, isChecking } = useSubscriptionStatus();
  const [copiedPix, setCopiedPix] = useState(false);

  // Never block while loading, and never block if not overdue
  if (isLoading || !isOverdue || !subscription) return null;

  const {
    current_payment_value,
    current_payment_due_date,
    current_payment_url,
    pix_payload,
    pix_qr_code_url,
  } = subscription;

  const formattedValue = formatBRL(current_payment_value || 150);
  const formattedDate = current_payment_due_date
    ? format(parseISO(current_payment_due_date), "dd/MM/yyyy", { locale: ptBR })
    : "—";

  const handleCopyPix = async () => {
    if (!pix_payload) return;
    try {
      await navigator.clipboard.writeText(pix_payload);
      setCopiedPix(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
            <MaterialIcon icon="warning" size={36} className="text-[#b91c1c]" />
          </div>
          <h1 className="text-2xl font-semibold font-plus-jakarta text-gray-900">
            Mensalidade em atraso
          </h1>
          <p className="text-gray-500 text-sm">
            Regularize sua mensalidade para continuar usando o sistema.
          </p>
        </div>

        {/* Payment details card */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Valor</span>
            <span className="text-lg font-semibold text-gray-900">{formattedValue}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Vencimento</span>
            <span className="text-sm font-medium text-red-600">{formattedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <MaterialIcon icon="error" size={14} />
              Vencido
            </span>
          </div>
        </div>

        {/* Payment options */}
        <div className="space-y-3">
          {/* PIX */}
          {pix_payload && (
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="qr_code" size={20} className="text-[#b91c1c]" />
                <span className="font-medium text-sm">Pagar com PIX</span>
              </div>
              {pix_qr_code_url && (
                <div className="flex justify-center">
                  <img
                    src={pix_qr_code_url}
                    alt="QR Code PIX"
                    className="w-40 h-40 rounded-lg"
                  />
                </div>
              )}
              <button
                onClick={handleCopyPix}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#b91c1c] text-white rounded-lg text-sm font-medium hover:bg-[#991b1b] transition-colors active:scale-[0.98]"
              >
                <MaterialIcon icon={copiedPix ? "check" : "content_copy"} size={18} />
                {copiedPix ? "Copiado!" : "Copiar código PIX"}
              </button>
            </div>
          )}

          {/* Boleto */}
          {current_payment_url && (
            <a
              href={current_payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors active:scale-[0.98]"
            >
              <MaterialIcon icon="receipt_long" size={18} />
              Abrir boleto bancário
            </a>
          )}
        </div>

        {/* Already paid button — real-time ASAAS check */}
        <button
          onClick={checkPaymentNow}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98] disabled:opacity-60"
        >
          <MaterialIcon icon={isChecking ? "sync" : "check_circle"} size={18} className={isChecking ? "animate-spin" : ""} />
          {isChecking ? "Verificando pagamento..." : "Já paguei, verificar agora"}
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Ou aguarde — após o pagamento, o acesso é liberado automaticamente.
        </p>
      </div>
    </div>
  );
}
