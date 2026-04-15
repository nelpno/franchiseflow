import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";
import { safeHref } from "@/lib/safeHref";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function SubscriptionPaymentSheet({ open, onOpenChange, subscription, checkPaymentNow, isChecking }) {
  if (!subscription) return null;

  const {
    current_payment_status,
    current_payment_value,
    current_payment_due_date,
    pix_payload,
    pix_qr_code_url,
    current_payment_url,
  } = subscription;

  const value = current_payment_value ?? 150;

  const formattedDueDate = current_payment_due_date
    ? format(new Date(current_payment_due_date), "dd/MM/yyyy", { locale: ptBR })
    : null;

  const isOverdue = current_payment_status === "OVERDUE";
  const isPending = current_payment_status === "PENDING";

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pix_payload);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar o código PIX.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-semibold flex items-center gap-2">
            <MaterialIcon icon="workspace_premium" className="text-[#d4af37]" />
            Sua Equipe Digital
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-600">
            {formattedDueDate
              ? `${formatBRL(value)} · Vencimento ${formattedDueDate}`
              : formatBRL(value)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          {(isOverdue || isPending) && (
            <div className="flex items-center gap-2">
              {isOverdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                  <MaterialIcon icon="warning" style={{ fontSize: 14 }} />
                  Vencido
                </span>
              )}
              {isPending && !isOverdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700" style={{ color: "#d4af37", backgroundColor: "#fefce8", borderColor: "#d4af37" }}>
                  <MaterialIcon icon="schedule" style={{ fontSize: 14 }} />
                  Pendente
                </span>
              )}
            </div>
          )}

          {pix_qr_code_url && (
            <div className="flex justify-center">
              <img
                src={pix_qr_code_url}
                alt="QR Code PIX"
                width={160}
                height={160}
                className="rounded-lg border border-gray-200"
              />
            </div>
          )}

          {pix_payload && (
            <Button
              className="w-full gap-2 text-white"
              style={{ backgroundColor: "#b91c1c" }}
              onClick={handleCopyPix}
            >
              <MaterialIcon icon="content_copy" style={{ fontSize: 18 }} />
              Copiar código PIX
            </Button>
          )}

          {current_payment_url && (
            <Button
              variant="outline"
              className="w-full gap-2"
              asChild
            >
              <a href={safeHref(current_payment_url)} target="_blank" rel="noopener noreferrer">
                <MaterialIcon icon="receipt_long" style={{ fontSize: 18 }} />
                Abrir boleto bancário
              </a>
            </Button>
          )}

          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={checkPaymentNow}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <MaterialIcon icon="sync" style={{ fontSize: 18 }} className="animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <MaterialIcon icon="check_circle" style={{ fontSize: 18 }} />
                Já paguei, verificar agora
              </>
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Após pagamento via PIX, a liberação é automática em minutos.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
