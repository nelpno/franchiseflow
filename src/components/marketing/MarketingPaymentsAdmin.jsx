import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarketingPayment, MarketingMetaDeposit } from "@/entities/all";
import { safeHref } from "@/lib/safeHref";
import { format, addMonths, parseISO } from "date-fns";
import { getMarketingTargetMonth } from "@/lib/franchiseUtils";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatBRL";
import { MARKETING_TAX_RATE, marketingLiquid } from "@/lib/franchiseUtils";
import MetaDepositDialog from "./MetaDepositDialog";
import { FranchiseConfiguration } from "@/entities/all";

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -3; i <= 1; i++) {
    const d = addMonths(now, i);
    options.push({
      value: format(d, "yyyy-MM"),
      label: capitalizeFirst(format(d, "MMMM yyyy", { locale: ptBR })),
    });
  }
  return options;
}

const STATUS_CONFIG = {
  confirmed: { label: "Confirmado", color: "#16a34a", icon: "check_circle" },
  pending: { label: "Pendente", color: "#d4af37", icon: "schedule" },
  rejected: { label: "Recusado", color: "#dc2626", icon: "error" },
  not_paid: { label: "Nao pagou", color: "#dc2626", icon: "cancel" },
};

export default function MarketingPaymentsAdmin({ franchises = [] }) {
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    () => format(getMarketingTargetMonth(), "yyyy-MM")
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(null); // { paymentId }
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [configs, setConfigs] = useState([]);

  const monthOptions = generateMonthOptions();

  // Map evolution_instance_id → franchise_name from configs
  const configNameMap = React.useMemo(() => {
    const map = {};
    configs.forEach((c) => {
      if (c.franchise_evolution_instance_id && c.franchise_name) {
        map[c.franchise_evolution_instance_id] = c.franchise_name;
      }
    });
    return map;
  }, [configs]);

  const getFranchiseDisplayName = useCallback((f) => {
    return configNameMap[f.evolution_instance_id] || `Maxi Massas ${f.city || ""}`.trim();
  }, [configNameMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsResult, depositsResult, configsResult] = await Promise.allSettled([
        MarketingPayment.filter({ reference_month: selectedMonth }, "created_at", 200),
        MarketingMetaDeposit.filter({ reference_month: selectedMonth }, "deposit_date", 100),
        FranchiseConfiguration.list("franchise_name", 200),
      ]);
      if (!mountedRef.current) return;
      setPayments(paymentsResult.status === "fulfilled" ? paymentsResult.value : []);
      setDeposits(depositsResult.status === "fulfilled" ? depositsResult.value : []);
      setConfigs(configsResult.status === "fulfilled" ? configsResult.value : []);
    } catch (err) {
      console.error("Erro ao carregar dados investimento:", err);
      toast.error("Erro ao carregar dados de investimento");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // ─── Calculos ───
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const totalCollected = confirmedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalLiquid = marketingLiquid(totalCollected);
  const totalDeposited = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const balance = totalCollected - totalDeposited;
  const paidCount = payments.filter((p) => p.status !== "rejected").length;

  // ─── Merge franquias + pagamentos ───
  const franchiseRows = franchises.map((f) => {
    const payment = payments.find((p) => p.franchise_id === f.evolution_instance_id);
    let status = "not_paid";
    if (payment) status = payment.status;
    return { franchise: f, payment, status };
  });

  // Sort: pending > confirmed > not_paid > rejected
  const statusOrder = { pending: 0, confirmed: 1, not_paid: 2, rejected: 3 };
  franchiseRows.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  // Filter
  const filteredRows = filterStatus === "all"
    ? franchiseRows
    : franchiseRows.filter((r) => r.status === filterStatus);

  // ─── Acoes ───
  const handleConfirm = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await MarketingPayment.update(paymentId, { status: "confirmed", rejection_reason: null });
      toast.success("Pagamento confirmado!");
      await loadData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setActionLoading(rejectDialog.paymentId);
    try {
      await MarketingPayment.update(rejectDialog.paymentId, {
        status: "rejected",
        rejection_reason: rejectReason.trim() || null,
      });
      toast.success("Pagamento recusado");
      setRejectDialog(null);
      setRejectReason("");
      await loadData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* ─── Filtros ─── */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48 border-[#e9e8e9]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 border-[#e9e8e9]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="not_paid">Nao pagaram</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Resumo do Mes ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#7a6d6d] mb-1">Arrecadado</p>
            <p className="text-lg font-bold text-[#1b1c1d]">{formatBRL(totalCollected)}</p>
            <p className="text-xs text-[#7a6d6d] mt-1">{paidCount} de {franchises.length} pagaram</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#7a6d6d] mb-1">Liquido Campanha</p>
            <p className="text-lg font-bold text-[#1b1c1d]">{formatBRL(totalLiquid)}</p>
            <p className="text-xs text-[#7a6d6d] mt-1">-{MARKETING_TAX_RATE * 100}% imposto</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#7a6d6d] mb-1">Depositado Meta</p>
            <p className="text-lg font-bold text-[#1b1c1d]">{formatBRL(totalDeposited)}</p>
            <p className="text-xs text-[#7a6d6d] mt-1">{deposits.length} deposito{deposits.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#7a6d6d] mb-1">Saldo a Depositar</p>
            <p className={`text-lg font-bold ${balance > 0 ? "text-[#d4af37]" : "text-[#16a34a]"}`}>
              {formatBRL(Math.max(0, balance))}
            </p>
            {balance <= 0 && <p className="text-xs text-[#16a34a] mt-1">Tudo depositado</p>}
          </CardContent>
        </Card>
      </div>

      {/* ─── Depositos Meta ─── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-plus-jakarta font-bold text-sm text-[#1b1c1d]">
              Depositos Meta
            </h3>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-[#b91c1c] text-[#b91c1c]"
              onClick={() => setShowDepositDialog(true)}
            >
              <MaterialIcon icon="add" size={14} className="mr-1" />
              Registrar Deposito
            </Button>
          </div>

          {deposits.length === 0 ? (
            <p className="text-xs text-[#7a6d6d] py-4 text-center">
              Nenhum deposito registrado em {monthLabel}
            </p>
          ) : (
            <div className="space-y-2">
              {deposits.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-[#e9e8e9] last:border-0">
                  <div className="flex items-center gap-3">
                    <MaterialIcon icon="account_balance" size={16} className="text-[#7a6d6d]" />
                    <div>
                      <p className="text-sm font-medium text-[#1b1c1d]">
                        {formatBRL(parseFloat(d.amount))}
                      </p>
                      {d.notes && <p className="text-xs text-[#7a6d6d]">{d.notes}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-[#7a6d6d]">
                    {format(parseISO(d.deposit_date), "dd/MM/yyyy")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tabela Franquias ─── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-plus-jakarta font-bold text-sm text-[#1b1c1d] mb-3">
            Franquias — {monthLabel}
          </h3>

          {/* Header desktop */}
          <div className="hidden md:grid grid-cols-12 gap-2 pb-2 border-b border-[#e9e8e9] text-xs font-medium text-[#7a6d6d]">
            <div className="col-span-3">Franquia</div>
            <div className="col-span-2 text-right">Valor Pago</div>
            <div className="col-span-2 text-right">Campanha</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-center">Acoes</div>
          </div>

          {filteredRows.length === 0 ? (
            <p className="text-xs text-[#7a6d6d] py-8 text-center">
              Nenhuma franquia encontrada com esse filtro
            </p>
          ) : (
            <div className="divide-y divide-[#e9e8e9]">
              {filteredRows.map((row) => {
                const { franchise: f, payment: p, status } = row;
                const cfg = STATUS_CONFIG[status];
                const amount = p ? parseFloat(p.amount) || 0 : 0;
                const liquid = p ? marketingLiquid(amount) : 0;
                const isLoading = actionLoading === p?.id;

                return (
                  <div
                    key={f.id}
                    className="py-3 md:grid md:grid-cols-12 md:gap-2 md:items-center flex flex-col gap-2"
                  >
                    {/* Franquia */}
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-[#1b1c1d]">
                        {getFranchiseDisplayName(f)}
                      </p>
                      <p className="text-xs text-[#7a6d6d]">{f.owner_name || f.city}{f.state ? ` — ${f.state}` : ""}</p>
                    </div>

                    {/* Valor */}
                    <div className="md:col-span-2 md:text-right">
                      <span className="text-sm text-[#1b1c1d]">
                        {p ? formatBRL(amount) : "—"}
                      </span>
                    </div>

                    {/* Campanha (liquido) */}
                    <div className="md:col-span-2 md:text-right">
                      <span className="text-sm text-[#4a3d3d]">
                        {p ? formatBRL(liquid) : "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-2 md:text-center">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color: cfg.color,
                          backgroundColor: `${cfg.color}10`,
                        }}
                      >
                        <MaterialIcon icon={cfg.icon} size={14} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Acoes */}
                    <div className="md:col-span-3 flex items-center justify-center gap-1">
                      {p && status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-[#16a34a] hover:bg-[#16a34a]/10"
                            onClick={() => handleConfirm(p.id)}
                            disabled={isLoading}
                            title="Confirmar"
                          >
                            <MaterialIcon icon="check" size={18} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-[#dc2626] hover:bg-[#dc2626]/10"
                            onClick={() => setRejectDialog({ paymentId: p.id })}
                            disabled={isLoading}
                            title="Recusar"
                          >
                            <MaterialIcon icon="close" size={18} />
                          </Button>
                        </>
                      )}
                      {p?.proof_url && (
                        <a
                          href={safeHref(p.proof_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#7a6d6d] hover:bg-[#e9e8e9]"
                          title="Ver comprovante"
                        >
                          <MaterialIcon icon="visibility" size={18} />
                        </a>
                      )}
                      {!p && (
                        <span className="text-xs text-[#7a6d6d]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialogs ─── */}
      <MetaDepositDialog
        open={showDepositDialog}
        onOpenChange={setShowDepositDialog}
        referenceMonth={selectedMonth}
        onSaved={loadData}
      />

      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar Pagamento</DialogTitle>
            <DialogDescription>Informe o motivo da recusa (opcional)</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm">Motivo</Label>
            <Textarea
              placeholder="Ex: Comprovante ilegivel"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              className="border-[#e9e8e9] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              disabled={!!actionLoading}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
            >
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
