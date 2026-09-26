import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Franchise, FranchiseConfiguration, SystemSubscription } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { classifySubscription, compareCobranca, SITUACAO, SITUACAO_LABEL } from "@/lib/subscriptionStatus";
import { formatDateOnly } from "@/lib/dateOnly";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { nomeCurto } from "@/lib/networkOverview";
import { montarMensagemFranqueado } from "@/lib/mensagemFranqueado";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { safeHref } from "@/lib/safeHref";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import MaisAcoesMenu from "@/components/shared/MaisAcoesMenu";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO } from "@/components/shared/adminUi";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { missingFiscalFields, saveFiscalData } from "@/lib/saveFiscalData";
import FranchiseForm from "@/components/franchises/FranchiseForm";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { precisaSincronizarDocumento } from "@/lib/fiscalSync";
import SincronizarDocAsaasDialog from "@/components/franchises/SincronizarDocAsaasDialog";

// A origem veio da Ficha (state.from) quando o caminho é /Unidade — decisão 7 do redesenho.
const vindoDaFicha = (from) => typeof from === "string" && /^\/Unidade(\?|$)/.test(from);

// Situações válidas no ?situacao= da URL (F8): as mesmas de subscriptionStatus.js.
const SITUACOES_URL = new Set(Object.values(SITUACAO));

/**
 * Chama a edge asaas-billing devolvendo o MOTIVO real da falha.
 *
 * `supabase.functions.invoke` embrulha qualquer resposta não-2xx em
 * "Edge Function returned a non-2xx status code" — a mensagem que a função escreveu
 * (ex.: "CPF/CNPJ informado é inválido") fica dentro de `error.context`, que ninguém lia.
 */
async function invokeAsaas(body) {
  const { data, error } = await supabase.functions.invoke("asaas-billing", { body });
  if (error) {
    let detalhe = "";
    try {
      const payload = await error.context?.json?.();
      detalhe = payload?.error || "";
    } catch { /* resposta sem JSON — fica com a mensagem genérica */ }
    throw new Error(detalhe || error.message || "Falha na comunicação com o sistema de cobrança");
  }
  return data;
}

/**
 * Lê o array de resultados de uma action em lote (subscribe-batch / register-batch),
 * que responde HTTP 200 mesmo quando TODOS os itens falharam. Até 19/08/2026 o painel
 * ignorava isso e dizia "3 assinatura(s) criada(s)!" com zero criada.
 */
function resumoLote(data) {
  const itens = Array.isArray(data) ? data : [];
  const ok = itens.filter((r) => r?.success);
  const falhas = itens.filter((r) => r && !r.success);
  return { itens, ok, falhas };
}

function formatCpfCnpj(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskCpfCnpj(value) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
}

function displayFranchiseName(name) {
  if (!name) return "—";
  return /^maxi\s+massas/i.test(name) ? name : `Maxi Massas ${name}`;
}

// #5/#13: mensagem de cobrança reusa montarMensagemFranqueado (padrão único do admin) e
// passa o link de pagamento quando o ASAAS já devolveu um (current_payment_url) — sem
// isso a franqueada tinha que pedir o link de novo por fora. O texto com/sem link é
// montado inteiro dentro de mensagemFranqueado.js (nunca concatenar por fora: gerava
// "Posso te mandar o link de novo? Link para pagar: …", incoerente).
function mensagemCobranca(f, cls, sub) {
  return montarMensagemFranqueado({
    motivo: "mensalidade",
    nome: f.owner_name,
    franchiseName: f.name,
    vencimento: cls.vencimento,
    link: sub?.current_payment_url,
  });
}

// "Sincronizar com ASAAS" (achado ALTO 26/09): fatura/assinatura apagada no painel do
// ASAAS não volta pro dashboard por conta própria (docs/claude/asaas.md) — precisa ficar
// visível, não escondido dentro do menu "Resolver"/"Mais ações".
function BotaoSincronizar({ syncingAll, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncingAll}
      title="Sincronizar com ASAAS"
      aria-label="Sincronizar com ASAAS"
      className={`${BTN_SECUNDARIO} h-11 w-11 shrink-0 px-0`}
    >
      <MaterialIcon icon={syncingAll ? "sync" : "cloud_sync"} size={18} className={syncingAll ? "animate-spin" : ""} aria-hidden="true" />
    </button>
  );
}

function SubscriptionBadge({ sub }) {
  const { situacao, diasAtraso } = classifySubscription(sub);
  const estilo = {
    [SITUACAO.PAGO]: { bg: "bg-ok/10", fg: "text-ok-ink", icon: "check_circle" },
    [SITUACAO.VENCIDO]: { bg: "bg-err/10", fg: "text-err", icon: "error" },
    [SITUACAO.PENDENTE]: { bg: "bg-brand-gold-soft", fg: "text-brand-dark", icon: "schedule" },
    // "Sem cobranca" e o mais grave: nao existe assinatura, entao o cron de sync
    // nunca vai olhar para esta unidade e ninguem vai cobrar. Antes aparecia como
    // um travessao neutro.
    [SITUACAO.SEM_COBRANCA]: { bg: "bg-err/15", fg: "text-brand-dark", icon: "money_off" },
    [SITUACAO.AGUARDANDO]: { bg: "bg-brand-gold-soft", fg: "text-brand-dark", icon: "hourglass_empty" },
    [SITUACAO.CANCELADA]: { bg: "bg-surface-2", fg: "text-ink-3", icon: "block" },
  }[situacao];

  const texto = situacao === SITUACAO.VENCIDO && diasAtraso > 0
    ? `Vencido há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}`
    : SITUACAO_LABEL[situacao];

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${estilo.bg} ${estilo.fg}`}>
      <MaterialIcon icon={estilo.icon} size={14} aria-hidden="true" />
      {texto}
    </span>
  );
}

// #5/#13: ação principal da linha. Vencido → "Cobrar no WhatsApp" primário; o resto (sem
// cobrança, aguardando, pendente, pago, cancelada) usa o menu "Mais ações" — cobrar é a
// única ação que merece destaque na cobrança do dia a dia (B1: 1 primário por bloco).
// `phone` já vem em dígitos puros (fallback f.phone_number || personal_phone_for_summary,
// igual ao get_unit_360/admin-08 — CLAUDE.md: phone_number é quase sempre NULL na base).
// `podeCobrar` é só a SITUAÇÃO (vencido); sem telefone o botão primário cai no aviso "Sem
// telefone" em vez de a linha inteira cair muda no menu genérico (achado ALTO 26/09).
function AcaoLinha({ f, cls, sub, missing, phone, onCriar, criando, onEditarFiscal, onCancelar }) {
  const podeCobrar = cls.situacao === SITUACAO.VENCIDO;
  const link = podeCobrar && phone ? getWhatsAppLink(phone, mensagemCobranca(f, cls, sub)) : null;

  const itensMenu = [
    missing.length > 0 && {
      label: `Faltam ${missing.length} ${missing.length === 1 ? "campo" : "campos"} → Preencher`,
      icon: "warning",
      onClick: onEditarFiscal,
    },
    missing.length === 0 &&
      !sub?.asaas_customer_id && {
        label: "Cadastrar no ASAAS",
        icon: "cloud_upload",
        disabled: criando,
        onClick: onCriar,
      },
    { label: "Editar dados de cobrança", icon: "edit", onClick: onEditarFiscal },
    sub?.asaas_subscription_id && { label: "Cancelar assinatura", icon: "block", perigo: true, onClick: onCancelar },
  ].filter(Boolean);

  if (podeCobrar) {
    return (
      <div className="flex items-center justify-end gap-2">
        {link ? (
          <a href={safeHref(link)} target="_blank" rel="noopener noreferrer" className={`${BTN_PRIMARIO} whitespace-nowrap`}>
            <MaterialIcon icon="chat" size={16} aria-hidden="true" />
            Cobrar no WhatsApp
          </a>
        ) : (
          <span className="text-xs text-ink-3">Sem telefone</span>
        )}
        <MaisAcoesMenu actions={itensMenu} />
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <MaisAcoesMenu actions={itensMenu} rotulo="Ações" />
    </div>
  );
}

export default function AsaasSetupPanel() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const franchiseParam = searchParams.get("franchise") || "";
  const daFicha = vindoDaFicha(location.state?.from);
  const limparFranquia = () =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("franchise");
      return p;
    });
  const [franchises, setFranchises] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [syncDocAsaas, setSyncDocAsaas] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState(null);
  // Cancelamento
  const [cancellingSub, setCancellingSub] = useState(null); // franchise object | null
  const [isCancelling, setIsCancelling] = useState(false);
  // Atualizar valor (fica em "Mais ações" — #20)
  const [monthlyValue, setMonthlyValue] = useState(150);
  const valorAntesDialogRef = useRef(null);
  const [showValueDialog, setShowValueDialog] = useState(false);
  const [applyToCurrent, setApplyToCurrent] = useState(false);
  const [isUpdatingValue, setIsUpdatingValue] = useState(false);
  const [creatingAsaas, setCreatingAsaas] = useState({});
  const [creatingAll, setCreatingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // Franquias removidas da lista de "Criar assinaturas" antes de confirmar (ex: franquias de teste)
  const [excludedSubIds, setExcludedSubIds] = useState(() => new Set());
  const toggleExcludeSub = (evoId) =>
    setExcludedSubIds(prev => {
      const next = new Set(prev);
      if (next.has(evoId)) next.delete(evoId);
      else next.add(evoId);
      return next;
    });
  const [revealedCpfs, setRevealedCpfs] = useState({});
  // Editar dados fiscais/cobrança (CPF, email, endereço) — um dialog só, sem edição inline
  // na linha da tabela (#13: CPF/email/endereço saem da linha e vão para cá).
  const [editingFiscal, setEditingFiscal] = useState(null);
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  const mountedRef = useRef(true);

  function toggleCpfReveal(franchiseId) {
    setRevealedCpfs(prev => ({ ...prev, [franchiseId]: !prev[franchiseId] }));
  }

  const loadData = useCallback(async () => {
    setErro(null);
    try {
      const [fRes, cRes, sRes] = await Promise.allSettled([
        Franchise.list("name", null, { columns: "id,name,owner_name,city,phone_number,evolution_instance_id,cpf_cnpj,state_uf,address_number,address_complement,neighborhood,status,billing_email" }),
        FranchiseConfiguration.list(null, null, { columns: "franchise_evolution_instance_id,street_address,cep,franchise_name,neighborhood,city,personal_phone_for_summary" }),
        SystemSubscription.list(null, null, { columns: "*" }),
      ]);
      if (!mountedRef.current) return;
      if (fRes.status === "rejected") {
        setErro(safeErrorMessage(fRes.reason, "Não foi possível carregar as franquias."));
        return;
      }
      setFranchises(fRes.value);
      setConfigs(cRes.status === "fulfilled" ? cRes.value : []);
      setSubscriptions(sRes.status === "fulfilled" ? sRes.value : []);
    } catch (err) {
      setErro(safeErrorMessage(err, "Erro ao carregar dados."));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // F8: filtro de situação fica na URL (?situacao=), lido também de fora (Fechamento do
  // mês → "Cobrar em Mensalidades →" já chega com ?situacao=vencido).
  const situacaoUrl = searchParams.get("situacao") || "";
  const situacaoFiltro = SITUACOES_URL.has(situacaoUrl) ? situacaoUrl : null;
  const setSituacaoFiltro = (sit) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (sit) p.set("situacao", sit);
      else p.delete("situacao");
      return p;
    }, { replace: true });

  const getConfig = (evoId) => configs.find(c => c.franchise_evolution_instance_id === evoId);
  const getSub = (evoId) => subscriptions.find(s => s.franchise_id === evoId);
  // f.phone_number é quase sempre NULL (CLAUDE.md) — mesmo fallback do get_unit_360/
  // admin-08: personal_phone_for_summary, só dígitos.
  const telefoneCobranca = (f) => (f.phone_number || getConfig(f.evolution_instance_id)?.personal_phone_for_summary || "").replace(/\D/g, "");

  const activeFranchises = franchises.filter(f => f.status === "active");

  // Uma passada so: classifica a mensalidade de cada unidade e ordena por urgencia de
  // cobranca (sem cobranca -> maior atraso -> ... -> paga). Antes a tabela vinha na
  // ordem do banco, com 67 linhas e nenhum jeito de achar quem deve.
  const linhasCobranca = activeFranchises
    .map(f => ({ f, cls: classifySubscription(getSub(f.evolution_instance_id)) }))
    .sort((a, b) => compareCobranca(a.cls, b.cls));

  const contagemSituacao = linhasCobranca.reduce((acc, { cls }) => {
    acc[cls.situacao] = (acc[cls.situacao] || 0) + 1;
    return acc;
  }, {});

  // Chegou pela Ficha com ?franchise=<evo> (decisão 8): mostra só aquela unidade, com uma
  // faixa pra voltar pra ficha ou ver a rede inteira — em vez de o admin ter que achar a
  // linha dele no meio de 67.
  const franchiseRow = franchiseParam ? linhasCobranca.find(({ f }) => f.evolution_instance_id === franchiseParam) : null;
  const linhasVisiveis = franchiseParam
    ? franchiseRow
      ? [franchiseRow]
      : []
    : situacaoFiltro
      ? linhasCobranca.filter(({ cls }) => cls.situacao === situacaoFiltro)
      : linhasCobranca;
  const nomeFranquiaFiltrada = franchiseRow ? nomeCurto(franchiseRow.f.name) : location.state?.label || "";

  const handleCreateAsaas = async (franchise) => {
    const evoId = franchise.evolution_instance_id;
    setCreatingAsaas(prev => ({ ...prev, [evoId]: true }));
    try {
      await invokeAsaas({ action: "register", franchise_id: evoId });
      toast.success(`${franchise.name} cadastrado no ASAAS`);
      // Reload data after a short delay for n8n to process
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao cadastrar no ASAAS."));
    } finally {
      setCreatingAsaas(prev => ({ ...prev, [evoId]: false }));
    }
  };

  const handleCreateAllSubscriptions = async (franchiseIds) => {
    if (!franchiseIds || franchiseIds.length === 0) {
      toast.error("Selecione ao menos uma franquia para criar assinatura.");
      return;
    }
    if (!Number.isFinite(monthlyValue) || monthlyValue < 5 || monthlyValue > 5000) {
      toast.error("Informe um valor de mensalidade entre R$ 5 e R$ 5.000.");
      return;
    }
    setCreatingAll(true);
    try {
      const data = await invokeAsaas({
        action: "subscribe-batch",
        value: monthlyValue,
        franchise_ids: franchiseIds,
      });
      // A edge responde 200 com um resultado POR franquia — sucesso do HTTP não é
      // sucesso da criação. Reportar o que de fato aconteceu, nomeando quem falhou.
      const { ok, falhas } = resumoLote(data);
      const nomeDe = (fid) => franchises.find(f => f.evolution_instance_id === fid)?.name || fid;

      if (falhas.length === 0 && ok.length > 0) {
        toast.success(`${ok.length} assinatura(s) criada(s) a R$ ${monthlyValue.toFixed(2)}!`);
      } else if (ok.length === 0) {
        toast.error(
          `Nenhuma assinatura criada. ${falhas.map(r => `${nomeDe(r.franchise_id)}: ${r.error}`).join(" · ") ||
            "A função não retornou resultado."}`,
          { duration: 15000 }
        );
      } else {
        toast.warning(
          `${ok.length} criada(s), ${falhas.length} falhou/falharam — ${falhas
            .map(r => `${nomeDe(r.franchise_id)}: ${r.error}`)
            .join(" · ")}`,
          { duration: 15000 }
        );
      }
      if (ok.length > 0) {
        setShowReview(false);
        setExcludedSubIds(new Set());
      }
      setTimeout(() => loadData(), 5000);
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao criar assinaturas."));
    } finally {
      setCreatingAll(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancellingSub) return;
    setIsCancelling(true);
    try {
      await invokeAsaas({ action: "cancel-subscription", franchise_id: cancellingSub.evolution_instance_id });
      toast.success(`Assinatura de ${cancellingSub.name} cancelada`);
      setCancellingSub(null);
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao cancelar."));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateValue = async () => {
    if (!Number.isFinite(monthlyValue) || monthlyValue < 5 || monthlyValue > 5000) {
      toast.error("Valor deve estar entre R$ 5 e R$ 5.000");
      return;
    }
    setIsUpdatingValue(true);
    try {
      const data = await invokeAsaas({
        action: "update-subscription-value",
        all_active: true,
        new_value: monthlyValue,
        apply_to_current: applyToCurrent,
      });
      const updated = data?.updated ?? 0;
      const total = data?.total ?? 0;
      toast.success(`${updated}/${total} assinaturas atualizadas para R$ ${monthlyValue.toFixed(2)}`);
      setShowValueDialog(false);
      setApplyToCurrent(false);
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao atualizar valor."));
    } finally {
      setIsUpdatingValue(false);
    }
  };

  const handleSaveFiscal = async (franchiseData, _email, addressExtras) => {
    if (!editingFiscal) return;
    setIsSavingFiscal(true);
    try {
      await saveFiscalData(
        editingFiscal.franchise.id,
        editingFiscal.franchise.evolution_instance_id,
        {
          billing_email: franchiseData.billing_email,
          cpf_cnpj: franchiseData.cpf_cnpj,
          address_number: franchiseData.address_number,
          address_complement: franchiseData.address_complement,
          neighborhood: franchiseData.neighborhood,
          state_uf: franchiseData.state_uf,
          city: franchiseData.city,
          cep: addressExtras?.cep,
          street_address: addressExtras?.street_address,
        }
      );
      toast.success("Dados de cobrança atualizados!");
      const docAntigo = editingFiscal.franchise.cpf_cnpj;
      const franquiaSalva = editingFiscal.franchise;
      const subSalva = subscriptions.find(x => x.franchise_id === franquiaSalva.evolution_instance_id);
      setEditingFiscal(null);
      loadData();
      // O ASAAS não acompanha o painel (ver lib/fiscalSync.js).
      if (subSalva?.asaas_customer_id &&
          precisaSincronizarDocumento({ docAntigo, docNovo: franchiseData.cpf_cnpj, temClienteAsaas: true })) {
        setSyncDocAsaas({ franquia: franquiaSalva, docAntigo, docNovo: franchiseData.cpf_cnpj });
      }
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao salvar dados de cobrança."));
    } finally {
      setIsSavingFiscal(false);
    }
  };

  // Helper: franquia tem todos os campos necessários para ASAAS?
  const getMissing = (f) => missingFiscalFields(f, getConfig(f.evolution_instance_id));
  const isFiscalComplete = (f) => getMissing(f).length === 0;

  // Stats de COBRANÇA (#20): o que importa no dia a dia é vencida/a vencer/paga, não
  // cadastro (64 das 66 já prontas) — cadastro foi para "Mais ações".
  const totalActive = activeFranchises.length;
  const nVencidas = contagemSituacao[SITUACAO.VENCIDO] || 0;
  // "A vencer" é fatura pendente com data (SITUACAO.PENDENTE). AGUARDANDO é cliente ASAAS
  // SEM assinatura ainda — não existe fatura nenhuma para vencer, então não entra aqui
  // (senão infla o número e confunde "falta cadastrar" com "tem cobrança a caminho").
  const nAVencer = contagemSituacao[SITUACAO.PENDENTE] || 0;
  const nPagas = contagemSituacao[SITUACAO.PAGO] || 0;
  const valorVencidas = linhasCobranca
    .filter(({ cls }) => cls.situacao === SITUACAO.VENCIDO)
    .reduce((s, { cls }) => s + (cls.valor || 0), 0);

  const fiscalComplete = activeFranchises.filter(isFiscalComplete).length;
  const withSubscription = activeFranchises.filter(f => getSub(f.evolution_instance_id)?.asaas_subscription_id).length;
  const pendingRegister = activeFranchises.filter(f => isFiscalComplete(f) && !getSub(f.evolution_instance_id)?.asaas_customer_id);
  const semAssinatura = activeFranchises.length - withSubscription;
  const hasAnyActiveSub = activeFranchises.some(f => {
    const s = getSub(f.evolution_instance_id);
    return s?.asaas_subscription_id && s?.subscription_status !== "CANCELLED";
  });

  // #20: o que era a primeira dobra (cadastro + reajuste em massa) agora mora aqui —
  // 1 clique errado a menos entre "cobrar" e "reajustar o valor de todos".
  const acoesCadastro = [
    hasAnyActiveSub && {
      label: `Atualizar valor de todos (R$ ${monthlyValue.toFixed(2).replace(".", ",")})`,
      icon: "price_change",
      onClick: () => { valorAntesDialogRef.current = monthlyValue; setShowValueDialog(true); },
    },
    pendingRegister.length > 0 && {
      label: `Cadastrar ${pendingRegister.length} pendentes no ASAAS`,
      icon: "cloud_upload",
      disabled: creatingAll,
      onClick: async () => {
        setCreatingAll(true);
        try {
          const data = await invokeAsaas({
            action: "register-batch",
            franchise_ids: pendingRegister.map(f => f.evolution_instance_id),
          });
          const { ok, falhas } = resumoLote(data);
          const nomeDe = (fid) => franchises.find(f => f.evolution_instance_id === fid)?.name || fid;
          if (falhas.length === 0) {
            toast.success(`${ok.length} franqueado(s) cadastrado(s) no ASAAS`);
          } else {
            toast.warning(
              `${ok.length} cadastrado(s), ${falhas.length} com erro — ${falhas
                .map(r => `${nomeDe(r.franchise_id)}: ${r.error}`)
                .join(" · ")}`,
              { duration: 15000 }
            );
          }
          setTimeout(() => loadData(), 5000);
        } catch (err) {
          toast.error(safeErrorMessage(err, "Erro no cadastro batch."));
        } finally {
          setCreatingAll(false);
        }
      },
    },
    {
      label: "Criar assinaturas",
      icon: "autorenew",
      onClick: () => { setExcludedSubIds(new Set()); setShowReview(true); },
    },
  ].filter(Boolean);

  // #20: "Sincronizar com ASAAS" (nome que os runbooks/docs/claude/asaas.md citam) saiu do
  // menu "Resolver"/"Mais ações" e virou botão-ícone SEMPRE visível (achado ALTO 26/09) —
  // é a única ação de recuperação (fatura/assinatura apagada no painel do ASAAS) e ficava
  // escondida atrás de 1-2 cliques justo quando o admin mais precisa dela.
  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const data = await invokeAsaas({ action: "check-payment-batch" });
      const { total = 0, updated = 0, errors = [] } = data || {};
      if (errors.length > 0) {
        toast.warning(`${updated} de ${total} sincronizadas — ${errors.length} com erro`);
      } else {
        toast.success(`${updated} de ${total} franquias sincronizadas`);
      }
      await loadData();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao sincronizar com ASAAS"));
    } finally {
      setSyncingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl motion-reduce:animate-none" />
          <Skeleton className="h-24 rounded-2xl motion-reduce:animate-none" />
          <Skeleton className="h-24 rounded-2xl motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-full motion-reduce:animate-none" />
        <Skeleton className="h-64 w-full rounded-2xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (erro) {
    return <ErrorState texto={erro} onTentarNovamente={() => { setIsLoading(true); loadData(); }} cartao />;
  }

  // Review screen before creating subscriptions
  if (showReview) {
    const readyForSubscription = activeFranchises.filter(f => {
      const sub = getSub(f.evolution_instance_id);
      return sub?.asaas_customer_id && !sub?.asaas_subscription_id;
    });
    const selectedForSubscription = readyForSubscription.filter(
      f => !excludedSubIds.has(f.evolution_instance_id)
    );
    const selectedIds = selectedForSubscription.map(f => f.evolution_instance_id);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowReview(false)} className="p-1 hover:bg-surface rounded-lg transition-colors">
            <MaterialIcon icon="arrow_back" size={20} aria-hidden="true" />
          </button>
          <h2 className="text-lg font-semibold font-plus-jakarta">Confirmar Assinaturas</h2>
        </div>

        <div className="rounded-2xl border border-warn/40 bg-warn-soft p-4 flex items-start gap-3">
          <MaterialIcon icon="info" size={20} className="text-warn-ink mt-0.5" aria-hidden="true" />
          <div className="text-sm text-ink">
            <p className="font-medium">Revise antes de confirmar</p>
            <p>Serão criadas {selectedForSubscription.length} assinatura(s) de R$ {monthlyValue.toFixed(2).replace(".", ",")}/mês com vencimento no dia 5. Toque no ✕ para tirar alguma da lista (ex: franquias de teste).</p>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Mensalidade (R$)</span>
              <input
                type="number"
                min="5"
                max="5000"
                step="0.01"
                value={monthlyValue}
                onChange={e => setMonthlyValue(parseFloat(e.target.value) || 0)}
                className="h-10 w-32 rounded-xl border border-surface-line bg-white px-3 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          {readyForSubscription.map(f => {
            const config = getConfig(f.evolution_instance_id);
            const isExcluded = excludedSubIds.has(f.evolution_instance_id);
            return (
              <div key={f.id} className={`${CARTAO} flex items-center justify-between gap-2 ${isExcluded ? "opacity-50" : ""}`}>
                <div className={isExcluded ? "line-through" : ""}>
                  <p className="font-medium text-sm">{displayFranchiseName(f.name)}</p>
                  <p className="text-xs text-ink-3 inline-flex items-center gap-1">
                    {f.owner_name} —{" "}
                    {revealedCpfs[f.evolution_instance_id || f.id] ? formatCpfCnpj(f.cpf_cnpj) : maskCpfCnpj(f.cpf_cnpj)}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleCpfReveal(f.evolution_instance_id || f.id); }}
                      className="text-ink-3 hover:text-ink-2 transition-colors"
                      title={revealedCpfs[f.evolution_instance_id || f.id] ? "Ocultar" : "Revelar"}
                    >
                      <MaterialIcon icon={revealedCpfs[f.evolution_instance_id || f.id] ? "visibility_off" : "visibility"} size={14} aria-hidden="true" />
                    </button>
                  </p>
                  <p className="text-xs text-ink-3">{config?.street_address || f.city}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-ink-2">R$ {monthlyValue.toFixed(2).replace(".", ",")}</span>
                  <button
                    type="button"
                    onClick={() => toggleExcludeSub(f.evolution_instance_id)}
                    className={`min-h-10 min-w-10 flex items-center justify-center rounded-lg transition-colors ${isExcluded ? "text-brand hover:bg-err/10" : "text-ink-3 hover:bg-surface hover:text-brand"}`}
                    title={isExcluded ? "Incluir de volta" : "Tirar da lista"}
                  >
                    <MaterialIcon icon={isExcluded ? "undo" : "close"} size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {readyForSubscription.length > 0 ? (
          <button
            onClick={() => handleCreateAllSubscriptions(selectedIds)}
            disabled={creatingAll || selectedIds.length === 0}
            className={`${BTN_PRIMARIO} w-full`}
          >
            {creatingAll ? (
              <>
                <MaterialIcon icon="sync" size={18} className="animate-spin" aria-hidden="true" />
                Criando assinaturas...
              </>
            ) : (
              <>
                <MaterialIcon icon="send" size={18} aria-hidden="true" />
                {selectedIds.length > 0 ? `Criar ${selectedIds.length} assinatura(s)` : "Selecione ao menos uma"}
              </>
            )}
          </button>
        ) : (
          <p className="text-center text-sm text-ink-3">Nenhum franqueado pronto para assinatura. Cadastre no ASAAS primeiro.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* #20: 3 números de COBRANÇA (o que importa no dia a dia), não de cadastro. */}
      <div className="grid grid-cols-3 gap-3">
        <div className={CARTAO}>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Vencidas</p>
          <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-err sm:text-3xl">{nVencidas}</p>
          {valorVencidas > 0 && <p className="mt-1 text-sm text-ink-2">{formatBRLInteger(valorVencidas)}</p>}
        </div>
        <div className={CARTAO}>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">A vencer</p>
          <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{nAVencer}</p>
        </div>
        <div className={CARTAO}>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Pagas</p>
          <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ok-ink sm:text-3xl">{nPagas}</p>
        </div>
      </div>

      {/* Aviso quando falta cadastro — só aparece quando falta algo (B10: nunca texto morto). */}
      {(semAssinatura > 0 || fiscalComplete < totalActive) && !franchiseParam && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm text-ink">
          <span>
            {semAssinatura} {semAssinatura === 1 ? "unidade ativa está" : "unidades ativas estão"} sem assinatura no ASAAS
            {fiscalComplete < totalActive ? ` (${totalActive - fiscalComplete} com dado de cobrança faltando)` : ""}.
          </span>
          <div className="flex items-center gap-2">
            <BotaoSincronizar syncingAll={syncingAll} onClick={handleSyncAll} />
            <MaisAcoesMenu actions={acoesCadastro} rotulo="Resolver" />
          </div>
        </div>
      )}
      {!(semAssinatura > 0 || fiscalComplete < totalActive) && !franchiseParam && (
        <div className="flex items-center justify-end gap-2">
          <BotaoSincronizar syncingAll={syncingAll} onClick={handleSyncAll} />
          <MaisAcoesMenu actions={acoesCadastro} />
        </div>
      )}

      {franchiseParam && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-gold-line bg-brand-gold-soft px-3 py-2.5 text-sm">
          <span className="text-ink-2">
            Você veio de <strong className="text-ink">{nomeFranquiaFiltrada || "uma unidade"}</strong>
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <BotaoSincronizar syncingAll={syncingAll} onClick={handleSyncAll} />
            <MaisAcoesMenu actions={acoesCadastro} />
            {daFicha && (
              <Link to={location.state.from} className="min-h-10 inline-flex items-center font-semibold text-brand-dark hover:underline">
                ← Voltar para a ficha{nomeFranquiaFiltrada ? ` de ${nomeFranquiaFiltrada}` : ""}
              </Link>
            )}
            <button type="button" onClick={limparFranquia} className="min-h-10 inline-flex items-center font-semibold text-brand-dark hover:underline">
              Ver todas →
            </button>
          </div>
        </div>
      )}

      {/* Chips de situação (F1-F3): contam PAGAMENTO. Somem quando a lista já está presa
          numa unidade só (?franchise=). */}
      {!franchiseParam && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {[
            SITUACAO.VENCIDO,
            SITUACAO.SEM_COBRANCA,
            SITUACAO.AGUARDANDO,
            SITUACAO.PENDENTE,
            SITUACAO.PAGO,
            SITUACAO.CANCELADA,
          ].map((sit) => {
            const n = contagemSituacao[sit] || 0;
            if (n === 0) return null;
            const ativo = situacaoFiltro === sit;
            return (
              <button
                key={sit}
                type="button"
                onClick={() => setSituacaoFiltro(ativo ? null : sit)}
                aria-pressed={ativo}
                className={`${CHIP} ${ativo ? CHIP_ATIVO : CHIP_INATIVO}`}
              >
                {SITUACAO_LABEL[sit]} · {n}
              </button>
            );
          })}
        </div>
      )}

      {linhasVisiveis.length === 0 ? (
        <EmptyState
          icone="search_off"
          titulo={franchiseParam ? "Essa unidade não está entre as ativas" : "Nenhuma unidade nesta situação"}
          texto={franchiseParam ? "Pode ter sido encerrada." : "Escolha outra situação no filtro acima."}
          acao={franchiseParam ? { rotulo: "Ver todas", onClick: limparFranquia } : { rotulo: "Limpar filtro", onClick: () => setSituacaoFiltro(null) }}
          cartao
        />
      ) : (
        // Sem overflow-hidden (achado ALTO 26/09): o menu "Mais ações"/"Ações" de cada
        // linha é absolute e w-64 — nas últimas linhas ele saía da caixa e o overflow
        // cortava o menu inteiro (também escondia o de ?franchise=, que é linha única).
        // O container só precisa do overflow-hidden para o CABEÇALHO (bg própria); as
        // linhas não têm bg própria, então não sobram cantos quadrados visíveis.
        <div className="rounded-2xl border border-surface-line bg-white">
          {/* Cabeçalho desktop */}
          <div className="hidden gap-3 rounded-t-2xl border-b border-surface-line bg-surface-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto]">
            <span>Unidade</span>
            <span>Situação</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span className="sr-only">Ação</span>
          </div>
          <div className="divide-y divide-surface-line">
            {linhasVisiveis.map(({ f, cls }) => {
              const sub = getSub(f.evolution_instance_id);
              const missing = getMissing(f);
              const acaoProps = {
                f, cls, sub, missing,
                phone: telefoneCobranca(f),
                criando: creatingAsaas[f.evolution_instance_id],
                onCriar: () => handleCreateAsaas(f),
                onEditarFiscal: () => setEditingFiscal({ franchise: f, config: getConfig(f.evolution_instance_id) }),
                onCancelar: () => setCancellingSub(f),
              };
              return (
                <div key={f.id}>
                  {/* Celular (T9): nome + situação · vencimento+valor · ação. */}
                  <div className="p-4 md:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold text-ink">{nomeCurto(f.name)}</p>
                      <SubscriptionBadge sub={sub} />
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-ink-2">
                      {cls.vencimento ? formatDateOnly(cls.vencimento) : "sem vencimento"}
                      {cls.valor != null ? ` · ${formatBRL(cls.valor)}` : ""}
                    </p>
                    <div className="mt-2">
                      <AcaoLinha {...acaoProps} />
                    </div>
                  </div>

                  {/* Desktop: colunas alinhadas com o cabeçalho. */}
                  <div className="hidden items-center gap-3 px-5 py-3.5 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto]">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug text-ink">{displayFranchiseName(f.name)}</p>
                      <p className="truncate text-sm text-ink-3">{f.owner_name}</p>
                    </div>
                    <SubscriptionBadge sub={sub} />
                    <span className={cls.diasAtraso > 0 ? "text-err font-medium" : "text-ink-2"}>
                      {cls.vencimento ? formatDateOnly(cls.vencimento) : <span className="text-ink-3">—</span>}
                    </span>
                    <span className="tabular-nums text-ink-2">{cls.valor != null ? formatBRL(cls.valor) : <span className="text-ink-3">—</span>}</span>
                    <AcaoLinha {...acaoProps} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog: cancelar assinatura */}
      <Dialog
        open={!!cancellingSub}
        onOpenChange={(open) => { if (!open && !isCancelling) setCancellingSub(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-err">
              <MaterialIcon icon="block" size={20} aria-hidden="true" />
              Cancelar assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3 text-sm text-ink-2">
            <p>
              Confirmar cancelamento da assinatura de{" "}
              <strong>{cancellingSub?.name}</strong>?
            </p>
            <ul className="space-y-1 text-xs list-disc list-inside bg-surface p-3 rounded-lg">
              <li>Cobrança recorrente mensal será encerrada no ASAAS</li>
              <li>Fatura pendente do mês também será cancelada</li>
              <li>Cliente ASAAS será mantido (permite recriar assinatura depois)</li>
              <li className="font-semibold text-brand-dark">A franquia NÃO será desativada</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setCancellingSub(null)}
              disabled={isCancelling}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-err hover:bg-brand text-white font-bold rounded-xl"
            >
              {isCancelling ? (
                <>
                  <MaterialIcon icon="sync" size={16} className="animate-spin mr-2" aria-hidden="true" />
                  Cancelando...
                </>
              ) : (
                "Sim, cancelar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: atualizar valor da mensalidade */}
      <Dialog
        open={showValueDialog}
        onOpenChange={(open) => {
          if (!open && !isUpdatingValue) {
            // Cancelar não pode deixar o valor digitado aqui valendo para a próxima "Criar assinaturas".
            if (valorAntesDialogRef.current != null) setMonthlyValue(valorAntesDialogRef.current);
            setShowValueDialog(false);
            setApplyToCurrent(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
              <MaterialIcon icon="price_change" size={20} aria-hidden="true" />
              Atualizar valor da mensalidade
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4 text-sm text-ink-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-ink-3">Novo valor (R$)</span>
              <input
                type="number"
                min="5"
                max="5000"
                step="0.01"
                value={monthlyValue}
                onChange={e => setMonthlyValue(parseFloat(e.target.value) || 0)}
                className="h-11 w-40 rounded-xl border border-surface-line px-3 text-sm"
              />
            </label>
            <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-xs text-ink">
              Serão atualizadas <strong>{withSubscription}</strong> franquias com assinatura ativa para <strong>R$ {monthlyValue.toFixed(2)}</strong>.
            </div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <Checkbox
                checked={applyToCurrent}
                onCheckedChange={(v) => setApplyToCurrent(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs">
                <strong className="block">Aplicar também à fatura pendente do mês atual</strong>
                <span className="text-ink-3">
                  Refaz fatura + gera PIX novo. Se desmarcado, só próximos ciclos usam o novo valor.
                </span>
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setShowValueDialog(false); setApplyToCurrent(false); }}
              disabled={isUpdatingValue}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateValue}
              disabled={isUpdatingValue}
              className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
            >
              {isUpdatingValue ? (
                <>
                  <MaterialIcon icon="sync" size={16} className="animate-spin mr-2" aria-hidden="true" />
                  Atualizando...
                </>
              ) : (
                "Confirmar atualização"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar dados de cobrança (CPF/CNPJ, email, endereço) — único ponto de
          edição desses campos (#13: saíram da linha da tabela). */}
      <Dialog
        open={!!editingFiscal}
        onOpenChange={(open) => { if (!open && !isSavingFiscal) setEditingFiscal(null); }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          {editingFiscal && (() => {
            const f = editingFiscal.franchise;
            const c = editingFiscal.config;
            return (
              <div>
                <DialogHeader className="sr-only">
                  <DialogTitle>Dados de cobrança de {displayFranchiseName(f.name)}</DialogTitle>
                </DialogHeader>
                <div className="px-5 pt-4 pb-3 bg-brand-gold-soft border-b border-brand-gold-line flex items-start gap-2">
                  <MaterialIcon icon="info" size={18} className="text-brand-dark mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="text-xs text-ink">
                    {/* O nome do menu varia por linha (vencido = "Mais ações", resto =
                        "Ações") — texto genérico ("menu da linha") em vez de citar um
                        nome. Nunca orientar recadastro por troca de documento: cria
                        cliente DUPLICADO no ASAAS (CLAUDE.md, docs/claude/asaas.md); a
                        troca de CPF/CNPJ já é tratada na hora, no diálogo que abre ao
                        salvar (achado ALTO 26/09). */}
                    <p className="font-semibold">Após salvar, se ainda não tem cadastro no ASAAS, use "Cadastrar no ASAAS" no menu da linha.</p>
                    <p>Troca de CPF/CNPJ é tratada na hora, na janela que abre ao salvar.</p>
                  </div>
                </div>
                <FranchiseForm
                  mode="fiscal-only"
                  initialData={{
                    name: f.name,
                    owner_name: f.owner_name,
                    city: f.city || c?.city || "",
                    status: f.status,
                    billing_email: f.billing_email,
                    cpf_cnpj: f.cpf_cnpj,
                    cep: c?.cep,
                    street_address: c?.street_address,
                    address_number: f.address_number,
                    address_complement: f.address_complement,
                    neighborhood: f.neighborhood || c?.neighborhood || "",
                    state_uf: f.state_uf,
                  }}
                  onSubmit={handleSaveFiscal}
                  onCancel={isSavingFiscal ? undefined : () => setEditingFiscal(null)}
                  isSubmitting={isSavingFiscal}
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {syncDocAsaas && (
        <SincronizarDocAsaasDialog
          franquia={syncDocAsaas.franquia}
          docAntigo={syncDocAsaas.docAntigo}
          docNovo={syncDocAsaas.docNovo}
          onClose={() => { setSyncDocAsaas(null); loadData(); }}
        />
      )}
    </div>
  );
}
