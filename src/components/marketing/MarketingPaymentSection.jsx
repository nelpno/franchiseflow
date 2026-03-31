import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarketingPayment } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatBRL";

const BUCKET = "marketing-comprovantes";
const MIN_AMOUNT = 200;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function getDefaultMonth() {
  const now = new Date();
  const day = now.getDate();
  const target = day > 15 ? addMonths(now, 1) : now;
  return format(target, "yyyy-MM");
}

function getMonthOptions() {
  const now = new Date();
  return [
    { value: format(addMonths(now, -1), "yyyy-MM"), label: format(addMonths(now, -1), "MMMM yyyy", { locale: ptBR }) },
    { value: format(now, "yyyy-MM"), label: format(now, "MMMM yyyy", { locale: ptBR }) },
    { value: format(addMonths(now, 1), "yyyy-MM"), label: format(addMonths(now, 1), "MMMM yyyy", { locale: ptBR }) },
  ];
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function MarketingPaymentSection() {
  const { selectedFranchise: ctxFranchise } = useAuth();
  const mountedRef = useRef(true);
  const evoId = ctxFranchise?.evolution_instance_id;

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const monthOptions = getMonthOptions();

  const loadPayments = useCallback(async () => {
    if (!evoId) return;
    try {
      const data = await MarketingPayment.filter(
        { franchise_id: evoId },
        "-reference_month",
        12
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

  const currentPayment = payments.find((p) => p.reference_month === selectedMonth);
  const monthLabel = cap(
    monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth
  );

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Formato aceito: JPG, PNG, WebP ou PDF");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande (max 5MB)");
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < MIN_AMOUNT) {
      toast.error(`Valor minimo: ${formatBRL(MIN_AMOUNT)}`);
      return;
    }

    setSubmitting(true);
    try {
      let proofUrl = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const filePath = `${evoId}/${selectedMonth}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        proofUrl = urlData.publicUrl;
      }

      const payload = {
        franchise_id: evoId,
        reference_month: selectedMonth,
        amount: numAmount,
        status: "pending",
        proof_url: proofUrl,
      };

      if (editMode && currentPayment) {
        await MarketingPayment.update(currentPayment.id, {
          amount: numAmount,
          status: "pending",
          proof_url: proofUrl,
          rejection_reason: null,
        });
      } else {
        await MarketingPayment.create(payload);
      }

      toast.success("Pagamento registrado!");
      setAmount("");
      setFile(null);
      setEditMode(false);
      await loadPayments();
    } catch (err) {
      console.error("Erro ao registrar pagamento:", err);
      toast.error(`Erro: ${err.message || "Tente novamente"}`);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  if (loading || !evoId) return null;

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#b91c1c]/10 rounded-lg">
              <MaterialIcon icon="campaign" className="text-[#b91c1c]" size={20} />
            </div>
            <div>
              <h3 className="font-plus-jakarta font-bold text-sm text-[#1b1c1d]">
                Investimento em Marketing
              </h3>
              <p className="text-xs text-[#7a6d6d]">Minimo {formatBRL(MIN_AMOUNT)}/mes</p>
            </div>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-40 text-xs border-[#e9e8e9]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {cap(m.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── Ja registrou ─── */}
        {currentPayment && !editMode ? (
          <div>
            <div className="flex items-center justify-between p-3 bg-[#fbf9fa] rounded-xl">
              <div>
                <p className="text-lg font-bold text-[#1b1c1d]">
                  {formatBRL(parseFloat(currentPayment.amount))}
                </p>
                <p className="text-xs text-[#7a6d6d]">
                  Enviado em {format(parseISO(currentPayment.created_at), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {currentPayment.proof_url && (
                  <a
                    href={currentPayment.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#b91c1c] hover:underline"
                  >
                    <MaterialIcon icon="receipt_long" size={16} />
                    Comprovante
                  </a>
                )}
                {currentPayment.status === "confirmed" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full">
                    <MaterialIcon icon="check_circle" size={14} />
                    Confirmado
                  </span>
                )}
                {currentPayment.status === "pending" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#d4af37] bg-[#d4af37]/10 px-2 py-1 rounded-full">
                    <MaterialIcon icon="schedule" size={14} />
                    Aguardando
                  </span>
                )}
                {currentPayment.status === "rejected" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#dc2626] bg-[#dc2626]/10 px-2 py-1 rounded-full">
                    <MaterialIcon icon="error" size={14} />
                    Recusado
                  </span>
                )}
              </div>
            </div>

            {currentPayment.status === "rejected" && (
              <div className="mt-3 p-3 bg-[#dc2626]/5 rounded-xl">
                <p className="text-xs text-[#dc2626] mb-2">
                  {currentPayment.rejection_reason || "Pagamento recusado"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-[#dc2626] text-[#dc2626]"
                  onClick={() => {
                    setEditMode(true);
                    setAmount(String(currentPayment.amount));
                  }}
                >
                  <MaterialIcon icon="refresh" size={14} className="mr-1" />
                  Reenviar
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ─── Formulario ─── */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#4a3d3d]">Valor (R$)</Label>
                <Input
                  type="number"
                  min={MIN_AMOUNT}
                  step="0.01"
                  placeholder="200,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9 text-sm border-[#e9e8e9]"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs text-[#4a3d3d]">Comprovante (opcional)</Label>
                <label className="flex items-center gap-1.5 h-9 px-3 border border-dashed border-[#cac0c0] rounded-md cursor-pointer hover:bg-[#fbf9fa] text-xs text-[#4a3d3d] mt-0.5">
                  <MaterialIcon icon="attach_file" size={14} />
                  <span className="truncate">{file ? file.name : "Anexar"}</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !amount}
                className="flex-1 h-9 bg-[#b91c1c] hover:bg-[#991b1b] text-white text-sm font-medium"
              >
                {submitting ? (
                  <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
                ) : (
                  <>
                    <MaterialIcon icon="send" size={16} className="mr-1.5" />
                    {editMode ? "Reenviar" : "Registrar Pagamento"}
                  </>
                )}
              </Button>
              {editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => { setEditMode(false); setAmount(""); setFile(null); }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
