import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Sale, SaleItem } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import SaleForm from "./SaleForm";
import SaleReceipt from "./SaleReceipt";
import ExportButtons from "@/components/shared/ExportButtons";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { generateReceiptImage, shareImage, printReceipt } from "@/lib/shareUtils";
import { getSaleNetValue } from "@/lib/financialCalcs";
import { formatBRL as formatCurrency } from "@/lib/formatters";
import { formatPhone, getWhatsAppLink } from "@/lib/whatsappUtils";
import { SALES_EXPORT_COLUMNS, buildSalesExportRows } from "@/lib/salesExport";
import { fireCapiOnConfirm, fireCapiBatch } from "@/lib/capiManual";
import { patchRecebimento } from "@/lib/recebimento";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import {
  filtrarVendas,
  resumoVendas,
  agruparPorDia,
  gruposVisiveis,
  vendasAReceber,
  rotuloRecebimento,
  telefoneDaVenda,
  horaEmBrasilia,
  diaMes,
  PAGINA_VENDAS,
} from "@/lib/vendasLista";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth, endOfMonth, addMonths, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTH_OFFSET_MIN = -5;

function formatMonthLabel(offset) {
  const raw = format(addMonths(new Date(), offset), "MMM/yyyy", { locale: ptBR });
  // date-fns pt-BR retorna "mai./2026" — remover ponto e capitalizar
  const cleaned = raw.replace(".", "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const PERIOD_FILTERS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todas" },
];

const CONFIRMATION_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "confirmed", label: "Confirmadas" },
];

const SOURCE_CONFIG = {
  manual: { label: "Manual", icon: "edit", className: "bg-ink-2/10 text-ink-2" },
  bot: { label: "Bot", icon: "smart_toy", className: "bg-brand-gold-ink/10 text-brand-gold-ink" },
};

function getPaymentIcon(method) {
  const pm = PAYMENT_METHODS.find((p) => p.value === method);
  return pm?.icon || "payments";
}

function getPaymentLabel(method) {
  const pm = PAYMENT_METHODS.find((p) => p.value === method);
  return pm?.label || method || "—";
}

function formatDateSafe(dateString) {
  if (!dateString) return "—";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "—";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatTimeSafe(dateString) {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "";
    return format(date, "HH:mm");
  } catch {
    return "";
  }
}

export default function TabLancar({
  franchiseId,
  franchiseName,
  unitWhatsApp = null,
  currentUser,
  sales,
  contacts,
  inventoryItems,
  historicoLoading = false,
  onRefresh,
  autoOpenForm = false,
  onFormOpened,
  initialContactId = null,
  initialPhone = null,
  initialPeriod = null,
}) {
  // S12 (28/09/2026): lista nova ("A receber" com "Recebi", WhatsApp na linha, dias,
  // paginação de 50) só com a chave ui_v2. Desligada = a tela de sempre.
  const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
  const [showFormDialog, setShowFormDialog] = useState(autoOpenForm);
  // Persist initial contact params in state so they survive URL param clearing
  const [savedContactId, setSavedContactId] = useState(initialContactId);
  const [savedPhone, setSavedPhone] = useState(initialPhone);

  // React to autoOpenForm changes (e.g. FAB clicked while already on Vendas)
  useEffect(() => {
    if (autoOpenForm) {
      setEditingSale(null);
      setShowFormDialog(true);
      if (initialContactId) setSavedContactId(initialContactId);
      if (initialPhone) setSavedPhone(initialPhone);
      onFormOpened?.();
    }
  }, [autoOpenForm]);

  const [editingSale, setEditingSale] = useState(null);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [deletingSale, setDeletingSale] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const excluindoRef = useRef(false);
  const [showCapiDeleteWarning, setShowCapiDeleteWarning] = useState(false);
  const [sharingSaleId, setSharingSaleId] = useState(null);
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const receiptRef = useRef(null);

  // Filters
  const [period, setPeriod] = useState("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmationFilter, setConfirmationFilter] = useState("all");
  const [togglingIds, setTogglingIds] = useState(new Set());
  const togglingRef = useRef(new Set());
  // S12.6 (P3): o "Desfazer" do aviso só vale enquanto nada mudou — nem a venda (outro
  // Recebi/Voltar depois dele), nem a unidade/tela (o aviso é global e sobrevive à navegação).
  const recebimentoSeqRef = useRef(new Map());
  const telaGeracaoRef = useRef(0);
  const desfazerToastsRef = useRef(new Set());
  useEffect(() => {
    const avisos = desfazerToastsRef.current;
    return () => {
      telaGeracaoRef.current += 1;
      avisos.forEach((id) => toast.dismiss(id));
      avisos.clear();
    };
  }, [franchiseId]);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [showConfirmAllDialog, setShowConfirmAllDialog] = useState(false);
  // S12.5: lista desenhada de 50 em 50 (os totais saem da lista filtrada INTEIRA).
  const [visiveis, setVisiveis] = useState(PAGINA_VENDAS);
  // S12.4: aviso de descartar mudanças ao fechar a EDIÇÃO (o SaleForm conta se mudou algo).
  const formDirtyRef = useRef(false);
  // P3 (2ª passada): enquanto o formulário envia a venda, ele não fecha (X, Esc, "Cancelar").
  // Fechar no meio deixava a operação antiga seguir e reabrir criava outra trava -> 2ª venda.
  const formEnviandoRef = useRef(false);
  const [confirmDescartar, setConfirmDescartar] = useState(false);

  // S12.5: "Vendas hoje" da Início abre a lista já em Hoje (?periodo=hoje). Aplica 1 vez,
  // quando a chave ligada é confirmada (ela chega depois do 1º render).
  const periodoInicialAplicadoRef = useRef(false);
  useEffect(() => {
    if (!uiV2 || periodoInicialAplicadoRef.current) return;
    periodoInicialAplicadoRef.current = true;
    if (initialPeriod === "today") setPeriod("today");
  }, [uiV2, initialPeriod]);

  // Filtro mudou: volta para a 1ª página.
  useEffect(() => {
    setVisiveis(PAGINA_VENDAS);
  }, [period, monthOffset, searchTerm, confirmationFilter]);

  // Contacts map for quick lookup
  const contactsMap = useMemo(() => {
    const map = {};
    contacts.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [contacts]);

  // Period filtering (regra em lib/vendasLista.js, a mesma de sempre, agora testada)
  const filteredSales = useMemo(() => {
    const monthRef = addMonths(new Date(), monthOffset);
    return filtrarVendas(sales, {
      period,
      todayStr: format(new Date(), "yyyy-MM-dd"),
      weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      monthStart: format(startOfMonth(monthRef), "yyyy-MM-dd"),
      monthEnd: format(endOfMonth(monthRef), "yyyy-MM-dd"),
      searchTerm,
      confirmationFilter,
      contactsMap,
    });
  }, [sales, period, monthOffset, searchTerm, confirmationFilter, contactsMap]);

  // S12.5 (chave ligada): lista por dia, 50 por vez; cabeçalho do dia com o total do dia inteiro.
  const gruposDoDia = useMemo(() => {
    if (!uiV2) return [];
    const hoje = new Date();
    return agruparPorDia(filteredSales, format(hoje, "yyyy-MM-dd"), format(subDays(hoje, 1), "yyyy-MM-dd"));
  }, [uiV2, filteredSales]);
  const gruposNaTela = useMemo(() => gruposVisiveis(gruposDoDia, visiveis), [gruposDoDia, visiveis]);
  const vendasNaTela = gruposNaTela.reduce((n, g) => n + g.vendas.length, 0);

  // S12.1 (chave ligada): caixa "A receber" com todas as vendas carregadas que faltam receber.
  const aReceber = useMemo(() => (uiV2 ? vendasAReceber(sales) : []), [uiV2, sales]);
  const aReceberTotal = useMemo(() => resumoVendas(aReceber).total, [aReceber]);

  // Load sale items for expanded view
  const handleToggleExpand = async (saleId) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }
    setExpandedSaleId(saleId);

    if (!expandedItems[saleId]) {
      try {
        const items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      } catch (err) {
        console.error("Erro ao carregar itens:", err);
        toast.error("Erro ao carregar itens da venda.");
      }
    }
  };

  // Open form for new sale
  const handleNewSale = () => {
    formDirtyRef.current = false;
    setEditingSale(null);
    setShowFormDialog(true);
  };

  // Open form for editing
  const handleEditSale = (sale) => {
    formDirtyRef.current = false;
    setEditingSale(sale);
    setShowFormDialog(true);
  };

  // Delete sale
  const handleConfirmDelete = async () => {
    if (!deletingSale) return;
    // Aviso quando venda ja enviou CAPI: deletar deixa Purchase fantasma no Meta.
    // Lê o capi_sent ATUAL no banco (P3 S12): a lista pode estar velha (o "Recebido" dado em
    // outra aba, ou o evento que saiu depois do último carregamento). Falhou a leitura = usa
    // o que a lista tem.
    if (excluindoRef.current) return; // 2 cliques no "Excluir" enquanto lê
    excluindoRef.current = true;
    setIsDeleting(true);
    // Leitura falhou = NÃO exclui com o valor velho (P3 2ª passada): pede para tentar de novo.
    let atual = null;
    let leu = false;
    try {
      [atual] = await Sale.filter({ id: deletingSale.id }, null, 1, { columns: "id, capi_sent" });
      leu = true;
    } catch {
      leu = false;
    } finally {
      excluindoRef.current = false;
      setIsDeleting(false);
    }
    if (!leu) {
      toast.error("Não foi possível conferir esta venda agora. Verifique a internet e tente excluir de novo.");
      return;
    }
    if (!atual) {
      toast.error("Esta venda já não existe mais (pode ter sido excluída em outra tela).");
      setDeletingSale(null);
      onRefresh();
      return;
    }
    const capiSent = !!atual.capi_sent;
    if (capiSent) {
      setShowCapiDeleteWarning(true);
      return;
    }
    await performDeleteSale();
  };

  const performDeleteSale = async () => {
    if (!deletingSale || excluindoRef.current) return;
    excluindoRef.current = true;
    setIsDeleting(true);
    try {
      await Sale.delete(deletingSale.id);
      toast.success("Venda excluída.");
      setDeletingSale(null);
      setShowCapiDeleteWarning(false);
      onRefresh();
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast.error(safeErrorMessage(error, "Erro ao excluir venda."));
    } finally {
      excluindoRef.current = false;
      setIsDeleting(false);
    }
  };

  // Toggle payment confirmation
  const handleToggleConfirmation = (e, sale) => {
    e.stopPropagation();
    return alterarRecebimento(sale, !sale.payment_confirmed);
  };

  // S12.6: "Recebi" ganha "Desfazer" no aviso (chave ligada) — o toque errado volta na hora,
  // sem ter de achar a venda (e o mês dela) para "Voltar para a receber". O anúncio já recebeu
  // a compra no "Recebi"; desfazer não a retira (igual ao "Voltar para a receber").
  const alterarRecebimento = async (sale, newValue) => {
    // Dois toques no mesmo quadro passam antes do disabled pintar: a ref segura o 2º.
    if (togglingRef.current.has(sale.id)) return;
    togglingRef.current.add(sale.id);
    const seq = (recebimentoSeqRef.current.get(sale.id) || 0) + 1;
    recebimentoSeqRef.current.set(sale.id, seq);
    const geracao = telaGeracaoRef.current;

    setTogglingIds((prev) => new Set(prev).add(sale.id));
    try {
      await Sale.update(sale.id, patchRecebimento(newValue));
      if (uiV2 && newValue && geracao === telaGeracaoRef.current) {
        const id = toast.success("Recebido!", {
          action: {
            label: "Desfazer",
            onClick: () => {
              desfazerToastsRef.current.delete(id);
              if (geracao !== telaGeracaoRef.current || recebimentoSeqRef.current.get(sale.id) !== seq) {
                toast.info("Essa venda já mudou. Abra a venda para ajustar.");
                return;
              }
              alterarRecebimento(sale, false);
            },
          },
        });
        desfazerToastsRef.current.add(id);
      } else if (uiV2 && newValue) toast.success("Recebido!");
      else if (uiV2) toast.success("Voltou para a receber.");
      else toast.success(newValue ? "Pagamento confirmado!" : "Confirmação removida.");
      // Dispara CAPI Purchase apenas na flip false -> true
      if (newValue) fireCapiOnConfirm(sale.id);
      onRefresh();
    } catch (err) {
      console.error("Erro ao confirmar pagamento:", err);
      toast.error("Erro ao atualizar confirmação.");
    } finally {
      togglingRef.current.delete(sale.id);
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(sale.id);
        return next;
      });
    }
  };

  // Confirm all visible pending sales (batched in groups of 10)
  const handleConfirmAllVisible = async () => {
    // S12.6 (P3): o lote divide a trava por venda com o "Recebi" individual e invalida o
    // "Desfazer" de avisos anteriores dessas vendas.
    const pendingSales = filteredSales.filter((s) => !s.payment_confirmed && !togglingRef.current.has(s.id));
    if (pendingSales.length === 0) {
      setShowConfirmAllDialog(false);
      if (filteredSales.some((s) => !s.payment_confirmed)) toast.info("Essas vendas já estão sendo marcadas. Aguarde um instante.");
      return;
    }
    pendingSales.forEach((s) => {
      togglingRef.current.add(s.id);
      recebimentoSeqRef.current.set(s.id, (recebimentoSeqRef.current.get(s.id) || 0) + 1);
    });

    setIsConfirmingAll(true);
    setShowConfirmAllDialog(false);
    const agora = new Date();
    let succeeded = 0;
    let failed = 0;
    try {
      const BATCH_SIZE = 10;
      const succeededIds = [];
      for (let i = 0; i < pendingSales.length; i += BATCH_SIZE) {
        const batch = pendingSales.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((s) =>
            Sale.update(s.id, patchRecebimento(true, agora))
          )
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") {
            succeeded += 1;
            succeededIds.push(batch[idx].id);
          } else {
            failed += 1;
          }
        });
      }
      if (failed > 0) {
        toast.error(`${failed} venda(s) não foram confirmadas.`);
      }
      if (succeeded > 0) {
        toast.success(`${succeeded} venda(s) confirmada(s)!`);
      }
      // Dispara CAPI em batch (throttle 5x para nao floodar Meta)
      if (succeededIds.length > 0) fireCapiBatch(succeededIds);
      onRefresh();
    } catch (err) {
      console.error("Erro ao confirmar vendas em lote:", err);
      toast.error("Erro ao confirmar vendas.");
    } finally {
      pendingSales.forEach((s) => togglingRef.current.delete(s.id));
      setIsConfirmingAll(false);
    }
  };

  // After save
  // Guarda o id da venda recem-criada para oferecer o comprovante assim que a lista
  // recarregar. Antes disso o unico caminho ate o cupom era achar a venda na lista —
  // e o tutorial "Registrando uma Venda" ja prometia que ele aparece na hora.
  const [pendingReceiptId, setPendingReceiptId] = useState(null);

  const closeForm = () => {
    if (formEnviandoRef.current) return;
    formDirtyRef.current = false;
    setConfirmDescartar(false);
    setShowFormDialog(false);
    setSavedContactId(null);
    setSavedPhone(null);
  };

  // Fechar pelo X, Esc ou "Cancelar": na EDIÇÃO com mudança sem salvar, pergunta antes (S12.4).
  const requestCloseForm = () => {
    if (formEnviandoRef.current) {
      toast.info("Aguarde: a venda está sendo salva.");
      return;
    }
    if (uiV2 && editingSale && formDirtyRef.current) {
      setConfirmDescartar(true);
      return;
    }
    closeForm();
  };

  const handleFormSave = (savedSaleId) => {
    formDirtyRef.current = false;
    formEnviandoRef.current = false;
    const wasEditing = !!editingSale;
    setShowFormDialog(false);
    setEditingSale(null);
    setExpandedItems({});
    if (savedSaleId && !wasEditing) setPendingReceiptId(savedSaleId);
    onRefresh();
  };

  // Share sale receipt
  const [shareData, setShareData] = useState(null);

  // Assim que a venda recem-salva aparece na lista recarregada, oferece o comprovante.
  // Espera a lista chegar de proposito: handleShareSale precisa da venda inteira
  // (contact_id, contact_phone, valores) e nao so do id.
  useEffect(() => {
    if (!pendingReceiptId) return;
    const nova = sales.find((s) => s.id === pendingReceiptId);
    if (!nova) return;
    setPendingReceiptId(null);
    toast.success("Venda registrada!", {
      id: `venda-salva-${nova.id}`,
      action: {
        label: "Comprovante",
        onClick: () => handleShareSaleRef.current?.(nova),
      },
      duration: 8000,
    });
  }, [pendingReceiptId, sales]);

  const handleShareSaleRef = useRef(null);

  const handleShareSale = useCallback(async (sale) => {
    const saleId = sale.id;
    setSharingSaleId(saleId);
    try {
      // Ensure items are loaded
      let items = expandedItems[saleId];
      if (!items) {
        items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      }

      const contact = sale.contact_id ? contactsMap[sale.contact_id] : null;

      // Set share data to render receipt off-screen
      setShareData({ sale, saleItems: items, contact });

      // Wait for React to render the receipt
      await new Promise((r) => setTimeout(r, 100));

      if (!receiptRef.current) {
        toast.error("Erro ao gerar comprovante.");
        return;
      }

      const blob = await generateReceiptImage(receiptRef.current);
      const dateStr = format(new Date(), "ddMMyyyy");
      const clientName = (contact?.nome || sale.customer_name)?.replace(/\s+/g, "-") || "venda";
      const filename = `comprovante-${clientName}-${dateStr}.png`;

      await shareImage(blob, filename);
    } catch (err) {
      console.error("Erro ao compartilhar:", err);
      toast.error("Erro ao gerar comprovante.");
    } finally {
      setSharingSaleId(null);
      setShareData(null);
    }
  }, [expandedItems, contactsMap]);

  const handlePrintSale = useCallback(async (sale) => {
    const saleId = sale.id;
    setPrintingSaleId(saleId);
    try {
      let items = expandedItems[saleId];
      if (!items) {
        items = await SaleItem.filter({ sale_id: saleId });
        setExpandedItems((prev) => ({ ...prev, [saleId]: items }));
      }

      const contact = sale.contact_id ? contactsMap[sale.contact_id] : null;
      setShareData({ sale, saleItems: items, contact });

      await new Promise((r) => setTimeout(r, 100));

      if (!receiptRef.current) {
        toast.error("Erro ao gerar comprovante.");
        return;
      }

      await printReceipt(receiptRef.current);
    } catch (err) {
      console.error("Erro ao imprimir:", err);
      toast.error("Erro ao imprimir comprovante.");
    } finally {
      setPrintingSaleId(null);
      setShareData(null);
    }
  }, [expandedItems, contactsMap]);

  // O effect que oferece o comprovante da venda recem-salva aparece ANTES daqui no
  // arquivo; a ref evita depender da ordem de declaracao (useCallback em ordem
  // circular = tela branca, gotcha ja documentado no CLAUDE.md).
  handleShareSaleRef.current = handleShareSale;

  const getContactName = (sale) => {
    if (sale.contact_id && contactsMap[sale.contact_id]) {
      return contactsMap[sale.contact_id].nome || "Sem nome";
    }
    // Venda sem cliente: título legível na lista, em vez de um traço solto (Onda 5).
    return sale.customer_name || "Sem cliente";
  };

  const getSourceBadge = (source) => {
    const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
    return (
      <Badge className={`${config.className} rounded-full px-2 py-0.5 text-[11px] font-bold gap-1`}>
        <MaterialIcon icon={config.icon} size={12} />
        {config.label}
      </Badge>
    );
  };

  // Total pending count (ignores confirmation filter — used for badge)
  const totalPendingCount = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthRef = addMonths(new Date(), monthOffset);
    const monthStart = format(startOfMonth(monthRef), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(monthRef), "yyyy-MM-dd");

    return sales.filter((s) => {
      if (s.payment_confirmed) return false;
      const saleDate = s.sale_date || s.created_at?.substring(0, 10) || "";
      if (period === "today" && saleDate !== todayStr) return false;
      if (period === "week" && saleDate < weekStart) return false;
      if (period === "month" && (saleDate < monthStart || saleDate > monthEnd)) return false;
      return true;
    }).length;
  }, [sales, period, monthOffset]);

  // Summary for the filtered period (lista filtrada INTEIRA, nunca só a página visível)
  const periodStats = useMemo(() => resumoVendas(filteredSales), [filteredSales]);

  // Export config — period label slug + filename
  const exportConfig = useMemo(() => {
    const periodLabel = period === "month"
      ? formatMonthLabel(monthOffset)
      : (PERIOD_FILTERS.find((p) => p.value === period)?.label || "vendas");
    const slug = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const today = format(new Date(), "yyyy-MM-dd");
    const filename = `vendas_${slug(franchiseName) || "franquia"}_${slug(periodLabel)}_${today}`;
    const title = `Vendas — ${franchiseName || ""} (${periodLabel})`;
    const data = buildSalesExportRows(filteredSales, contactsMap, { includeTotalsRow: true });
    return { filename, title, data };
  }, [filteredSales, contactsMap, period, monthOffset, franchiseName]);

  // Ações da venda aberta, lista nova (S12.5): tudo com texto; Excluir fica sozinho numa
  // linha de baixo, do outro lado, longe do Editar. "Voltar para a receber" é o estorno
  // (contrato S6: desmarca o recebido, o Sobrou não muda, o evento do anúncio não volta).
  const renderAcoesV2 = (sale) => (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleEditSale(sale); }}
          className="gap-1.5 h-10 text-ink-2"
        >
          <MaterialIcon icon="edit" size={16} />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleShareSale(sale); }}
          disabled={sharingSaleId === sale.id}
          className="gap-1.5 h-10 text-ink-2"
        >
          <MaterialIcon
            icon={sharingSaleId === sale.id ? "progress_activity" : "share"}
            size={16}
            className={sharingSaleId === sale.id ? "animate-spin" : ""}
          />
          {sharingSaleId === sale.id ? "Gerando..." : "Enviar comprovante"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handlePrintSale(sale); }}
          disabled={printingSaleId === sale.id}
          className="gap-1.5 h-10 text-ink-2"
        >
          <MaterialIcon
            icon={printingSaleId === sale.id ? "progress_activity" : "print"}
            size={16}
            className={printingSaleId === sale.id ? "animate-spin" : ""}
          />
          {printingSaleId === sale.id ? "Imprimindo..." : "Imprimir"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-shadow/5 pt-2">
        {sale.payment_confirmed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleToggleConfirmation(e, sale)}
            disabled={togglingIds.has(sale.id)}
            className="h-10 text-ink-2 underline underline-offset-2"
          >
            Voltar para a receber
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setDeletingSale(sale); }}
          className="gap-1.5 h-10 text-brand hover:bg-brand/5"
        >
          <MaterialIcon icon="delete" size={16} />
          Excluir venda
        </Button>
      </div>
    </div>
  );

  // Linha da venda, lista nova (S12.1/S12.5): nome, "#nº · hora · pagamento · entrega",
  // "Recebido em dd/mm" ou "A receber" + "Recebi", valor e WhatsApp do cliente.
  const renderLinhaV2 = (sale) => {
    const tel = telefoneDaVenda(sale, contactsMap);
    const detalhes = [
      sale.sale_number ? `#${sale.sale_number}` : null,
      horaEmBrasilia(sale.created_at),
      getPaymentLabel(sale.payment_method),
      sale.delivery_method === "delivery" ? "Entrega" : null,
    ].filter(Boolean).join(" · ");
    return (
      <div
        className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-surface/50 transition-colors"
        onClick={() => handleToggleExpand(sale.id)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-ink truncate">{getContactName(sale)}</span>
            {sale.source === "bot" && (
              <span className="shrink-0 rounded-full px-1.5 py-px text-[11px] font-bold bg-brand-gold-ink/10 text-brand-gold-ink">
                robô
              </span>
            )}
          </div>
          <p className="text-xs text-ink-2 truncate">{detalhes}</p>
          <p className={`text-xs ${sale.payment_confirmed ? "text-ok-ink" : "text-[#92400e] font-semibold"}`}>
            {rotuloRecebimento(sale)}
          </p>
          {sale.observacoes?.trim() && expandedSaleId !== sale.id && (
            <p className="mt-1 w-fit max-w-full text-xs text-[#92400e] bg-[#fef3c7]/50 rounded-md px-2 py-0.5 line-clamp-1 break-words">
              {sale.observacoes.trim()}
            </p>
          )}
        </div>
        <span className="font-bold text-ink font-mono-numbers shrink-0">
          {formatCurrency(getSaleNetValue(sale))}
        </span>
        {!sale.payment_confirmed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => handleToggleConfirmation(e, sale)}
            disabled={togglingIds.has(sale.id)}
            className="h-10 px-3 shrink-0 text-ok-ink border-ok/40 hover:bg-ok/5 font-semibold"
          >
            {togglingIds.has(sale.id) ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
            ) : (
              "Recebi"
            )}
          </Button>
        )}
        {tel && (
          <a
            href={getWhatsAppLink(tel)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`WhatsApp de ${getContactName(sale)}`}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-ok/10 text-ok-ink hover:bg-ok/20 transition-colors shrink-0"
          >
            <MaterialIcon icon="chat" size={20} />
          </a>
        )}
        <MaterialIcon
          icon={expandedSaleId === sale.id ? "expand_less" : "expand_more"}
          size={20}
          className="hidden sm:inline-block text-ink-2 shrink-0"
        />
      </div>
    );
  };

  const renderSaleCard = (sale) => {
      const isExpanded = expandedSaleId === sale.id;
      const saleItemsList = expandedItems[sale.id] || [];

      return (
        <Card
          key={sale.id}
          className={`bg-white rounded-2xl shadow-sm border border-ink-shadow/5 overflow-hidden border-l-[3px] ${
            sale.payment_confirmed
              ? "border-l-ok"
              : "border-l-[#f59e0b]"
          }`}
        >
          <CardContent className="p-0">
            {/* Main row — lista nova (S12) numa função própria; desligada = a linha de sempre */}
            {uiV2 ? renderLinhaV2(sale) : (
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface/50 transition-colors"
                onClick={() => handleToggleExpand(sale.id)}
              >
                {/* Payment icon */}
                <div className="p-2 bg-surface-line/50 rounded-xl shrink-0">
                  <MaterialIcon
                    icon={getPaymentIcon(sale.payment_method)}
                    size={20}
                    className="text-ink-2"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink truncate">
                      {getContactName(sale)}
                    </span>
                    {sale.sale_number ? (
                      <span className="font-mono text-xs text-ink-2/60 shrink-0 tabular-nums">
                        #{sale.sale_number}
                      </span>
                    ) : null}
                    {getSourceBadge(sale.source)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2 mt-0.5">
                    <span>{formatDateSafe(sale.sale_date || sale.created_at)}{formatTimeSafe(sale.created_at) && ` às ${formatTimeSafe(sale.created_at)}`}</span>
                    <span className="text-ink-shadow/20">|</span>
                    <span className="truncate">{getPaymentLabel(sale.payment_method)}</span>
                    {sale.delivery_method === "delivery" && (
                      <span className="flex items-center gap-0.5 text-brand/70">
                        <MaterialIcon icon="delivery_dining" size={12} />
                        Entrega
                      </span>
                    )}
                  </div>
                  {!isExpanded && sale.observacoes?.trim() && (
                    <div className="flex items-start gap-1 mt-1 w-fit max-w-full text-xs text-[#92400e] bg-[#fef3c7]/50 rounded-md px-2 py-1">
                      <MaterialIcon icon="sticky_note_2" size={13} className="shrink-0 mt-px text-[#b45309]" />
                      <span className="line-clamp-2 break-words">{sale.observacoes.trim()}</span>
                    </div>
                  )}
                </div>

                {/* Values */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-ink font-mono-numbers">
                    {formatCurrency(getSaleNetValue(sale))}
                  </p>
                  {(sale.delivery_fee > 0 || sale.discount_amount > 0) && (
                    <p className="text-xs text-ink-2 font-mono-numbers">
                      {formatCurrency(sale.value)}
                      {sale.discount_amount > 0 && ` − ${formatCurrency(sale.discount_amount)} desc`}
                      {sale.delivery_fee > 0 && ` + ${formatCurrency(sale.delivery_fee)} frete`}
                    </p>
                  )}
                </div>

                {/* Confirmation toggle chip */}
                <button
                  onClick={(e) => handleToggleConfirmation(e, sale)}
                  disabled={togglingIds.has(sale.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 min-h-[40px] transition-colors ${
                    sale.payment_confirmed
                      ? "bg-ok/10 text-ok-ink border-ok/20"
                      : "bg-[#fef3c7]/50 text-[#92400e] border-[#f59e0b]/30 hover:bg-ok/5 hover:text-ok-ink hover:border-ok/20"
                  }`}
                  title={sale.payment_confirmed ? "Pagamento recebido" : "Marcar como recebido"}
                >
                  {togglingIds.has(sale.id) ? (
                    <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
                  ) : (
                    <MaterialIcon
                      icon={sale.payment_confirmed ? "check_circle" : "radio_button_unchecked"}
                      size={16}
                    />
                  )}
                  <span className="sr-only sm:not-sr-only">
                    {sale.payment_confirmed ? "Recebido" : "Pendente"}
                  </span>
                </button>

                {/* Expand icon */}
                <MaterialIcon
                  icon={isExpanded ? "expand_less" : "expand_more"}
                  size={20}
                  className="text-ink-2 shrink-0"
                />
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-ink-shadow/5 px-4 py-3 bg-surface/50 space-y-3">
                {/* Cliente: nomes repetem na carteira (7 Adrianas, 3 Deboras...),
                    entao o que identifica QUAL cliente e o telefone + bairro. */}
                {(() => {
                  const contact = sale.contact_id ? contactsMap[sale.contact_id] : null;
                  if (!contact) return null;
                  const telefone = contact.telefone || "";
                  const local = [contact.bairro, contact.endereco]
                    .filter(Boolean)
                    .join(" - ");
                  return (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-ink-2 uppercase tracking-wider mb-1">
                        Cliente
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {telefone ? (
                            <span className="text-sm font-mono-numbers text-ink">
                              {formatPhone(telefone)}
                            </span>
                          ) : (
                            <span className="text-sm text-ink-2 italic">
                              Sem telefone cadastrado
                            </span>
                          )}
                          {local && (
                            <span className="text-xs text-ink-2 truncate">{local}</span>
                          )}
                        </div>
                        {telefone && (
                          <a
                            href={getWhatsAppLink(telefone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-ok/10 text-ok-ink hover:bg-ok/20 transition-colors shrink-0"
                          >
                            <MaterialIcon icon="chat" size={16} />
                            <span className="hidden sm:inline">WhatsApp</span>
                            <span className="sm:hidden">Zap</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Sale items */}
                {saleItemsList.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-2 uppercase tracking-wider mb-1">
                      Produtos
                    </p>
                    {saleItemsList.map((si) => (
                      <div
                        key={si.id}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="text-ink">
                          {si.product_name}{" "}
                          <span className="text-ink-2">x{si.quantity}</span>
                        </span>
                        <span className="font-mono-numbers text-ink-2">
                          {formatCurrency(si.quantity * si.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-2">
                    Sem detalhamento de produtos
                  </p>
                )}

                {/* Observação */}
                {sale.observacoes?.trim() && (
                  <div className="border-t border-ink-shadow/5 pt-2">
                    <p className="text-xs font-medium text-ink-2 uppercase tracking-wider mb-1">
                      Observação
                    </p>
                    <div className="flex items-start gap-1.5 text-sm text-[#92400e] bg-[#fef3c7]/50 rounded-md px-2.5 py-1.5">
                      <MaterialIcon icon="sticky_note_2" size={15} className="shrink-0 mt-0.5 text-[#b45309]" />
                      <span className="whitespace-pre-wrap break-words">{sale.observacoes.trim()}</span>
                    </div>
                  </div>
                )}

                {/* Financial breakdown */}
                {(sale.card_fee_amount > 0 || sale.delivery_fee > 0 || sale.discount_amount > 0) && (
                  <div className="border-t border-ink-shadow/5 pt-2 space-y-1 text-sm">
                    {sale.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-2">
                          Desconto{sale.discount_type === "percent" && sale.discount_input ? ` (${sale.discount_input}%)` : ""}
                        </span>
                        <span className="text-err font-mono-numbers">
                          − {formatCurrency(sale.discount_amount)}
                        </span>
                      </div>
                    )}
                    {sale.delivery_fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-2">Frete cobrado</span>
                        <span className="text-ok-ink font-mono-numbers">
                          + {formatCurrency(sale.delivery_fee)}
                        </span>
                      </div>
                    )}
                    {sale.card_fee_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-2">
                          Taxa {sale.payment_method === "payment_link" ? "link" : "cartão"} ({sale.card_fee_percent}%)
                        </span>
                        <span className="text-err font-mono-numbers">
                          - {formatCurrency(sale.card_fee_amount)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Profit margin (sai na lista nova: S12.5) */}
                {!uiV2 && saleItemsList.length > 0 && (() => {
                  const custoTotal = saleItemsList.reduce(
                    (sum, si) => sum + (parseFloat(si.cost_price) || 0) * (si.quantity || 1),
                    0
                  );
                  const totalRecebido = getSaleNetValue(sale);
                  const taxaCartao = sale.fee_passed_to_customer ? 0 : (parseFloat(sale.card_fee_amount) || 0);
                  const lucro = totalRecebido - custoTotal - taxaCartao;
                  const margem = totalRecebido > 0 ? (lucro / totalRecebido) * 100 : 0;
                  const isPositive = lucro >= 0;

                  return custoTotal > 0 ? (
                    <div className="border-t border-ink-shadow/5 pt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-ink-2">Custo dos produtos</span>
                        <span className="font-mono-numbers text-ink-2">
                          {formatCurrency(custoTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-2">Lucro da venda</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold font-mono-numbers ${
                              isPositive ? "text-ok-ink" : "text-err"
                            }`}
                          >
                            {formatCurrency(lucro)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold inline-flex items-center ${
                              !isPositive
                                ? "bg-err/10 text-err"
                                : margem < 25
                                ? "bg-[#f59e0b]/10 text-[#b45309]"
                                : "bg-ok/10 text-ok-ink"
                            }`}
                          >
                            {!isPositive ? "\u2193" : margem < 25 ? "!" : "\u2191"} {Math.abs(margem).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Actions — lista nova: botões com texto e Excluir longe de Editar (S12.5) */}
                {uiV2 && renderAcoesV2(sale)}
                {!uiV2 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareSale(sale);
                    }}
                    disabled={sharingSaleId === sale.id}
                    className="gap-1.5 h-10 min-w-[44px] text-ink-2"
                  >
                    {sharingSaleId === sale.id ? (
                      <>
                        <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                        <span className="sr-only sm:not-sr-only">Gerando...</span>
                      </>
                    ) : (
                      <>
                        <MaterialIcon icon="share" size={14} />
                        <span className="sr-only sm:not-sr-only">Compartilhar</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSale(sale);
                    }}
                    disabled={printingSaleId === sale.id}
                    className="gap-1.5 h-10 min-w-[44px] text-ink-2"
                  >
                    {printingSaleId === sale.id ? (
                      <>
                        <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                        <span className="sr-only sm:not-sr-only">Imprimindo...</span>
                      </>
                    ) : (
                      <>
                        <MaterialIcon icon="print" size={14} />
                        <span className="sr-only sm:not-sr-only">Imprimir</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditSale(sale);
                    }}
                    className="gap-1.5 h-10 min-w-[44px] text-ink-2"
                  >
                    <MaterialIcon icon="edit" size={14} />
                    <span className="sr-only sm:not-sr-only">Editar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSale(sale);
                    }}
                    className="gap-1.5 h-10 min-w-[44px] text-brand border-brand/30 hover:bg-brand/5"
                  >
                    <MaterialIcon icon="delete" size={14} />
                    <span className="sr-only sm:not-sr-only">Excluir</span>
                  </Button>
                </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      );
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Button
          onClick={handleNewSale}
          className="bg-brand hover:bg-brand-dark text-white gap-1.5 shrink-0"
        >
          <MaterialIcon icon="add_circle" size={18} />
          Nova Venda
        </Button>

        {/* Period tabs */}
        {/* Sem barra de rolagem visível no celular (390 px): o corte do último botão já indica que rola. */}
        <div className="flex gap-1 bg-white rounded-xl border border-ink-shadow/5 p-1 overflow-x-auto [scrollbar-width:none]">
          {PERIOD_FILTERS.map((pf) => {
            if (pf.value === "month") {
              const isActive = period === "month";
              const monthLabel = formatMonthLabel(monthOffset);
              const prevDisabled = monthOffset <= MONTH_OFFSET_MIN;
              const nextDisabled = monthOffset >= 0;
              return (
                <div
                  key="month"
                  className={`flex items-center rounded-lg whitespace-nowrap transition-colors min-h-[40px] ${
                    isActive ? "bg-brand text-white" : "text-ink-2"
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Mês anterior"
                    onClick={() => {
                      setPeriod("month");
                      setMonthOffset((o) => Math.max(MONTH_OFFSET_MIN, o - 1));
                    }}
                    disabled={prevDisabled}
                    className={`flex items-center justify-center min-w-[32px] min-h-[40px] rounded-l-lg transition-opacity ${
                      prevDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-black/10"
                    }`}
                  >
                    <MaterialIcon icon="chevron_left" size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Filtrar por ${monthLabel}`}
                    onClick={() => setPeriod("month")}
                    className="px-2 py-1.5 text-xs font-medium font-mono-numbers tabular-nums hover:bg-black/5 transition-colors min-w-[80px] text-center"
                  >
                    {monthLabel}
                  </button>
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => {
                      setPeriod("month");
                      setMonthOffset((o) => Math.min(0, o + 1));
                    }}
                    disabled={nextDisabled}
                    className={`flex items-center justify-center min-w-[32px] min-h-[40px] rounded-r-lg transition-opacity ${
                      nextDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-black/10"
                    }`}
                  >
                    <MaterialIcon icon="chevron_right" size={18} />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={pf.value}
                onClick={() => setPeriod(pf.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  period === pf.value
                    ? "bg-brand text-white"
                    : "text-ink-2 hover:bg-surface"
                }`}
              >
                {pf.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MaterialIcon
            icon="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2/60"
          />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Confirmation filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl border border-ink-shadow/5 p-1">
          {CONFIRMATION_FILTERS.map((cf) => (
            <button
              key={cf.value}
              onClick={() => setConfirmationFilter(cf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                confirmationFilter === cf.value
                  ? "bg-ink-2 text-white"
                  : "text-ink-2 hover:bg-surface"
              }`}
            >
              {uiV2 ? ({ all: "Todas", pending: "A receber", confirmed: "Recebidas" }[cf.value] || cf.label) : cf.label}
              {cf.value === "pending" && totalPendingCount > 0 && (
                <span className="ml-1.5 bg-[#f59e0b]/20 text-[#92400e] rounded-full px-1.5 py-0.5 text-[11px] font-bold">
                  {totalPendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Confirm all visible button — S12.2 (28/09/2026): sai com a chave ui_v2. A venda já nasce
            recebida e a caixa "A receber" tem o "Recebi" por venda; das 4 unidades que usavam, Embu
            ("tanto faz") e Vila dos Remédios ("não faz falta") responderam. Sem a chave, fica. */}
        {!uiV2 && periodStats.pendingCount > 0 && confirmationFilter !== "confirmed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmAllDialog(true)}
            disabled={isConfirmingAll}
            className="gap-1.5 text-ok-ink border-ok/30 hover:bg-ok/5"
          >
            {isConfirmingAll ? (
              <>
                <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <MaterialIcon icon="done_all" size={14} />
                <span className="hidden sm:inline">Confirmar todas</span>
                <span className="sm:hidden">Todas</span>
                <span className="font-mono-numbers">({periodStats.pendingCount})</span>
              </>
            )}
          </Button>
        )}

        {/* Export (Excel + PDF) */}
        <div className="ml-auto">
          <ExportButtons
            data={exportConfig.data}
            columns={SALES_EXPORT_COLUMNS}
            filename={exportConfig.filename}
            title={exportConfig.title}
            evento="planilha_vendas"
          />
        </div>
      </div>

      {/* S12.1 (chave ligada): o que falta receber, com "Recebi" direto na linha */}
      {uiV2 && aReceber.length > 0 && confirmationFilter !== "pending" && (
        <div className="bg-white rounded-2xl border border-brand-gold/40 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 bg-[#fffbeb]">
            <h2 className="font-plus-jakarta font-bold text-ink">
              A receber · <span className="font-mono-numbers">{aReceber.length}</span>
              {/* S12.6: a caixa soma TODOS os meses carregados (Vendas carrega 6 meses); o chip e o resumo abaixo, só o período */}
              <span className="ml-1.5 text-xs font-medium text-ink-2">dos últimos 6 meses</span>
            </h2>
            <span className="font-bold text-ink font-mono-numbers">{formatCurrency(aReceberTotal)}</span>
            <p className="w-full text-xs text-ink-2">
              Toque em Recebi quando o dinheiro entrar: confere o seu caixa e ensina o anúncio a achar clientes parecidos.
            </p>
          </div>
          <ul className="divide-y divide-ink-shadow/5">
            {aReceber.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">{getContactName(s)}</p>
                  <p className="text-xs text-ink-2 truncate">
                    {s.sale_number ? `#${s.sale_number} · ` : ""}
                    {getPaymentLabel(s.payment_method)} · {diaMes(s.sale_date) || formatDateSafe(s.created_at)}
                  </p>
                </div>
                <span className="font-bold text-ink font-mono-numbers shrink-0">
                  {formatCurrency(getSaleNetValue(s))}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleToggleConfirmation(e, s)}
                  disabled={togglingIds.has(s.id)}
                  className="h-10 px-3 shrink-0 text-ok-ink border-ok/40 hover:bg-ok/5 font-semibold"
                >
                  {togglingIds.has(s.id) ? (
                    <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
                  ) : (
                    "Recebi"
                  )}
                </Button>
              </li>
            ))}
          </ul>
          {aReceber.length > 5 && (
            <button
              type="button"
              onClick={() => { setPeriod("all"); setConfirmationFilter("pending"); setSearchTerm(""); }}
              className="w-full min-h-[44px] text-sm font-medium text-brand border-t border-ink-shadow/5 hover:bg-surface"
            >
              Ver as {aReceber.length} vendas a receber
            </button>
          )}
        </div>
      )}

      {/* Period summary */}
      {filteredSales.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="flex items-center gap-1">
            <MaterialIcon icon="schedule" size={14} className="text-[#f59e0b]" />
            <strong className="text-ink font-mono-numbers">{periodStats.pendingCount}</strong>
            {uiV2 ? " a receber" : ` pendente${periodStats.pendingCount !== 1 ? "s" : ""}`}
            {" "}<span className="font-mono-numbers">({formatCurrency(periodStats.pendingTotal)})</span>
          </span>
          <span className="text-ink-shadow/20">|</span>
          <span className="flex items-center gap-1">
            <MaterialIcon icon="check_circle" size={14} className="text-ok" />
            <strong className="text-ink font-mono-numbers">{periodStats.confirmedCount}</strong>
            {" "}recebida{periodStats.confirmedCount !== 1 ? "s" : ""}
            {" "}<span className="font-mono-numbers">({formatCurrency(periodStats.confirmedTotal)})</span>
          </span>
          <span className="text-ink-shadow/20">|</span>
          <span>
            Total{" "}
            <strong className="text-ink font-mono-numbers">
              {formatCurrency(periodStats.total)}
            </strong>
          </span>
        </div>
      )}

      {/* Sales list */}
      {filteredSales.length === 0 && historicoLoading ? (
        // S8.1: estoque já chegou (o form de venda abre normal); histórico ainda vem atrás —
        // skeleton em vez do vazio, pra não parecer "sem venda nenhuma" por engano.
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MaterialIcon icon="point_of_sale" size={64} className="text-ink-4 mb-4" />
          <h3 className="text-lg font-medium text-ink mb-1 font-plus-jakarta">
            Nenhuma venda registrada
          </h3>
          <p className="text-sm text-ink-2 max-w-sm">
            Comece lançando sua primeira venda!
          </p>
          <Button
            onClick={handleNewSale}
            className="mt-4 bg-brand hover:bg-brand-dark text-white gap-1.5"
          >
            <MaterialIcon icon="add_circle" size={18} />
            Nova Venda
          </Button>
        </div>
      ) : (
        uiV2 ? (
          <div className="space-y-4">
            {gruposNaTela.map((g) => (
              <section key={g.dia || "sem-data"} className="space-y-2">
                <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
                  {g.rotulo} · <span className="font-mono-numbers">{g.quantidade}</span> venda{g.quantidade !== 1 ? "s" : ""} ·{" "}
                  <span className="font-mono-numbers">{formatCurrency(g.total)}</span>
                </h3>
                <div className="space-y-3">{g.vendas.map(renderSaleCard)}</div>
              </section>
            ))}
            {filteredSales.length > vendasNaTela && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-xs text-ink-2">
                  Mostrando <span className="font-mono-numbers">{vendasNaTela}</span> de{" "}
                  <span className="font-mono-numbers">{filteredSales.length}</span> vendas
                </p>
                <Button
                  variant="outline"
                  onClick={() => setVisiveis((v) => v + PAGINA_VENDAS)}
                  className="h-11 px-5"
                >
                  Ver mais {Math.min(PAGINA_VENDAS, filteredSales.length - vendasNaTela)}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSales.map(renderSaleCard)}
          </div>
        )
      )}

      {/* Sale Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        if (open) setShowFormDialog(true);
        else requestCloseForm();
      }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl w-[95vw] max-h-[85dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">
              {editingSale ? "Editar Venda" : "Nova Venda"}
            </DialogTitle>
          </DialogHeader>
          <SaleForm
            sale={editingSale}
            franchiseId={franchiseId}
            contacts={contacts}
            inventoryItems={inventoryItems}
            currentUser={currentUser}
            onSave={handleFormSave}
            onCancel={requestCloseForm}
            onDirtyChange={(sujo) => { formDirtyRef.current = sujo; }}
            onEnviandoChange={(enviando) => { formEnviandoRef.current = enviando; }}
            initialContactId={!editingSale ? savedContactId : null}
            initialPhone={!editingSale ? savedPhone : null}
          />
        </DialogContent>
      </Dialog>

      {/* S12.4: fechar a edição com mudança sem salvar */}
      <AlertDialog open={confirmDescartar} onOpenChange={setConfirmDescartar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-plus-jakarta">Descartar as mudanças?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              Você mudou esta venda e ainda não salvou. Se sair agora, a venda fica como estava.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={closeForm} className="bg-brand hover:bg-brand-dark text-white">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Off-screen receipt for image generation */}
      {shareData && (
        <div style={{ position: "fixed", left: -9999, top: -9999, zIndex: -1 }}>
          <SaleReceipt
            ref={receiptRef}
            sale={shareData.sale}
            saleItems={shareData.saleItems}
            contact={shareData.contact}
            franchiseName={franchiseName}
            unitWhatsApp={unitWhatsApp}
          />
        </div>
      )}

      {/* Confirm all dialog */}
      <Dialog open={showConfirmAllDialog} onOpenChange={setShowConfirmAllDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Confirmar recebimento?</DialogTitle>
            <DialogDescription className="text-ink-2">
              Marcar{" "}
              <strong>{periodStats.pendingCount} venda{periodStats.pendingCount !== 1 ? "s" : ""}</strong>{" "}
              como recebida{periodStats.pendingCount !== 1 ? "s" : ""}?
              <br />
              <span className="font-mono-numbers">
                Total: <strong>{formatCurrency(periodStats.pendingTotal)}</strong>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmAllDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAllVisible}
              className="bg-ok hover:bg-[#15803d] text-white gap-1.5"
            >
              <MaterialIcon icon="done_all" size={16} />
              Confirmar todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingSale} onOpenChange={() => setDeletingSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Excluir venda?</DialogTitle>
            <DialogDescription className="text-ink-2">
              Esta ação não pode ser desfeita. A venda de{" "}
              <strong>{formatCurrency(deletingSale?.value)}</strong> será removida
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingSale(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {isDeleting ? (
                <>
                  <MaterialIcon icon="progress_activity" size={16} className="animate-spin mr-1" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CAPI warning before deleting a sale already reported to Meta Ads */}
      <AlertDialog open={showCapiDeleteWarning} onOpenChange={setShowCapiDeleteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-plus-jakarta">Atenção</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              Essa venda já foi contada no seu anúncio do Facebook. Excluir agora pode
              bagunçar o relatório do anúncio. Excluir mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDeleteSale}
              disabled={isDeleting}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {isDeleting ? "Excluindo..." : "Excluir mesmo assim"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
