import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MarketingPayment, MarketingMetaDeposit } from "@/entities/all";
import { useAdminNetworkOverview, invalidarAdmin } from "@/hooks/useAdminNetworkOverview";
import { MARKETING_TAX_PCT, marketingLiquid } from "@/lib/franchiseUtils";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { safeHref } from "@/lib/safeHref";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import { nomeCurto, linkFicha } from "@/lib/networkOverview";
import { nomeMes, haDias, diasDesde } from "@/lib/adminFormat";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import MarketingPaymentsAdmin from "@/components/marketing/MarketingPaymentsAdmin";
import MetaDepositDialog from "@/components/marketing/MetaDepositDialog";
import ErrorState from "@/components/shared/ErrorState";
import { CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import {
  FILTRO_LABELS,
  mesesVerba,
  montarListasVerba,
  montarMensagemVerba,
  montarMensagemComprovante,
  montarMensagemAdiantar,
  textoMesSeguinte,
} from "./verbaHelpers";

// Painel "Verba do mês-alvo" — Fase 3 do redesenho (~/.claude/plans/admin-redesign-2026-09-26.md).
// Foco em 4 filas acionáveis (a confirmar, falta subir, não pagaram, sem comprovante);
// o resto (recusar, cancelar, depósitos Meta, retorno de anúncio, histórico) fica em
// "Mais ações", reaproveitando o MarketingPaymentsAdmin sem reescrever nada dele.
export default function VerbaAlvoPanel({ franchises = [], filtro, onClearFiltro }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  // Overview COMPARTILHADA (react-query, hook único) — o mês do calendário e o mês-alvo vêm
  // do banco por aqui, nunca do relógio do aparelho (achado "duplicidades" alto 26/09).
  const { overview, isLoading: overviewLoading, error: overviewErrorObj, refetch: refetchOverview } = useAdminNetworkOverview();
  const [payments, setPayments] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null); // { paymentId }
  const [rejectReason, setRejectReason] = useState("");
  const [maisAcoes, setMaisAcoes] = useState(false);
  const [verMesAlvo, setVerMesAlvo] = useState(false);
  // "Adiantar o mês-alvo" chega recolhida (achado do Nelson 26/09: com 64 unidades faltando,
  // a lista com "Chamar" já aberta competia em peso com o que é urgente de verdade no dia 26).
  // Uma linha neutra abre a lista só quando alguém clica; a mensagem pronta e o botão Chamar
  // continuam dentro dela.
  const [verAdiantar, setVerAdiantar] = useState(false);
  const [verSemComprovante, setVerSemComprovante] = useState(false);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  // Achado "medio" 26/09: com a overview já em cache (Hoje/Unidades carregaram antes), o
  // painel desenhava as filas com payments=[]/pendentes=[] no instante entre `mesAtual` existir
  // e `load()` terminar — mostrando "Pagamento não encontrado" e escondendo "A confirmar" por
  // um instante. Só sai do esqueleto depois que a PRIMEIRA carga de pagamentos terminar.
  const [carregouPagamentos, setCarregouPagamentos] = useState(false);
  // Telefone = coluna phone da overview (supabase/2026-09-26-admin-08-overview-enxuta.sql,
  // aplicado ANTES do deploy deste front). Sem telefone cadastrado → "Sem telefone · Abrir ficha".
  const phoneDaUnidade = (row) => row?.phone ?? null;

  const meses = mesesVerba(overview);
  const mesAtual = meses?.mes || null;
  const mesAlvo = meses?.alvo || mesAtual;
  const janela = !!meses?.janela;

  const load = useCallback(async () => {
    if (!mesAtual) return;
    setError(null);
    try {
      const mesesReferencia = [...new Set([mesAtual, mesAlvo])];
      const [pg, pend, dep] = await Promise.all([
        MarketingPayment.filter({ reference_month: mesesReferencia }, "created_at", 300),
        // "A confirmar" é qualquer mês pendente (mesma régua de marketing_a_confirmar na RPC
        // de pendências) — senão o número clicado no card Hoje não bate com a lista (achado alto)
        MarketingPayment.filter({ status: "pending" }, "created_at", 300),
        // Depósito no Meta é sempre do mês do CALENDÁRIO (a campanha que está no ar agora) —
        // achado "alto" 26/09: essa tarefa do admin só existia dentro de "Mais ações".
        MarketingMetaDeposit.filter({ reference_month: mesAtual }, "deposit_date", 100),
      ]);
      if (!mountedRef.current) return;
      setPayments(pg || []);
      setPendentes(pend || []);
      setDeposits(dep || []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(safeErrorMessage(err, "Não foi possível carregar a verba do mês."));
    } finally {
      if (mountedRef.current) setCarregouPagamentos(true);
    }
  }, [mesAtual, mesAlvo]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // Qualquer mutação (aqui ou em "Mais ações") precisa recarregar as DUAS fontes: a overview
  // compartilhada (Hoje/Unidades também leem dela) e as filas locais de pagamento. Sem o
  // callback pro MarketingPaymentsAdmin, confirmar/recusar/cancelar por lá deixava as filas
  // daqui congeladas (achado Codex 26/09: "Mais ações não atualiza as filas").
  const recarregarTudo = useCallback(async () => {
    await Promise.all([invalidarAdmin(queryClient), load()]);
  }, [queryClient, load]);

  const listas = useMemo(
    () => montarListasVerba({ overview, payments, pendentes, mesAtual, mesAlvo }),
    [overview, payments, pendentes, mesAtual, mesAlvo]
  );

  const totalDepositado = useMemo(
    () => deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [deposits]
  );

  const handleConfirm = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await MarketingPayment.update(paymentId, { status: "confirmed", rejection_reason: null });
      toast.success("Pagamento confirmado!");
      await recarregarTudo();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao confirmar pagamento."));
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
      toast.success("Pagamento recusado.");
      setRejectDialog(null);
      setRejectReason("");
      await recarregarTudo();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Erro ao recusar pagamento."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarquei = async (payment) => {
    setActionLoading(payment.id);
    try {
      await MarketingPayment.update(payment.id, {
        campaign_raised_at: new Date().toISOString(),
        campaign_raised_by: user?.id || null,
      });
      toast.success("Campanha marcada como subida.");
      await recarregarTudo();
    } catch (err) {
      toast.error(safeErrorMessage(err, "Não foi possível marcar a campanha."));
    } finally {
      setActionLoading(null);
    }
  };

  if (overviewLoading || !carregouPagamentos) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error || overviewErrorObj) {
    return (
      <ErrorState
        texto={error || safeErrorMessage(overviewErrorObj, "Não foi possível carregar a verba do mês.")}
        onTentarNovamente={() => { refetchOverview(); load(); }}
        cartao
      />
    );
  }

  const { naoPagaram, naoPagaramTodas, faltaSubir, semComprovante, semComprovanteTodos, aConfirmar, adiantar, resumo } = listas;
  // Resumo principal = mês do CALENDÁRIO (decisão 2 da Onda 1); nos últimos 5 dias, um link
  // neutro troca pro mês-alvo sem nunca zerar nem esconder o mês que está no ar.
  const resumoAtivo = verMesAlvo && janela ? resumo.alvo : resumo;
  const mesResumoAtivo = verMesAlvo && janela ? mesAlvo : mesAtual;
  const brutoLiquido = marketingLiquid(resumoAtivo.brutoPago);
  // Saldo a depositar no Meta é sempre do mês do CALENDÁRIO (o depósito acompanha a campanha
  // que está no ar), nunca do mês-alvo que `verMesAlvo` mostra — achado "alto" 26/09: essa
  // conta ficava escondida dentro de "Mais ações".
  const saldoDepositar = Math.max(0, resumo.brutoPago - totalDepositado);
  const filtroValido = filtro && FILTRO_LABELS[filtro];
  // Chegada filtrada esconde "A confirmar" (só a fila de origem aparece) — sem a versão
  // "Todas", o card "N sem verba"/"N sem comprovante" do Hoje levava a uma lista mais curta
  // que N (achados "alto"/"medio" 26/09). Navegação normal (sem filtro) segue com a lista de
  // qualidade, porque "A confirmar" já está visível ali do lado.
  const naoPagaramExibida = filtro === "sem_verba" ? naoPagaramTodas : naoPagaram;
  const semComprovanteExibida = filtro === "sem_comprovante" ? semComprovanteTodos : semComprovante;

  // Chegada filtrada (princípio 2): só a fila de origem aparece, com a faixa "Você veio de".
  const somenteFiltro = (chave, conteudo) => {
    if (!filtroValido) return conteudo;
    return filtro === chave ? conteudo : null;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-plus-jakarta text-xl font-bold text-ink">
            Verba de anúncio · {nomeMes(mesResumoAtivo, { ano: true, maiuscula: true })}
          </h2>
          {!filtroValido && janela && (
            <button
              type="button"
              onClick={() => setVerMesAlvo((v) => !v)}
              // Nos últimos 5 dias do mês, o mês seguinte é informação NEUTRA (nunca
              // cobrança) — `text-brand-dark` é visualmente vermelho (a marca da Maxi é
              // #b91c1c) e o Nelson leu "0 de 66 pagaram" como alarme (achado 26/09).
              className="mt-0.5 text-sm font-semibold text-ink-3 hover:underline"
            >
              {verMesAlvo
                ? `← Ver ${nomeMes(mesAtual, { maiuscula: true })}`
                : textoMesSeguinte(mesAlvo, resumo.alvo, resumo.total)}
            </button>
          )}
        </div>
      </div>

      {filtroValido && (
        <section className="flex flex-col gap-2 rounded-2xl bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-dark">
              Você veio de: {FILTRO_LABELS[filtro]}
            </span>
          </p>
          <button
            type="button"
            onClick={onClearFiltro}
            className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-brand-dark bg-white px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft"
          >
            Ver toda a verba →
          </button>
        </section>
      )}

      {!filtroValido && (
        <section aria-label="Resumo da verba" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={CARTAO}>
            <p className="text-xs font-semibold text-ink-3">UNIDADES QUE PAGARAM</p>
            <p className="mt-1.5 font-plus-jakarta text-2xl font-extrabold text-ink">
              {resumoAtivo.pagaramCount} <span className="text-base font-semibold text-ink-3">de {resumo.total}</span>
            </p>
          </div>
          <div className={CARTAO}>
            {/* Com verMesAlvo o valor é só o que as unidades pagaram (depósito é do mês do
                calendário): o rótulo "DEPOSITADO NO META" ali fez o Nelson achar que o depósito
                de outubro já tinha sido registrado (30/09). */}
            <p className="text-xs font-semibold text-ink-3">
              {verMesAlvo ? "PAGO PELAS UNIDADES" : "PAGO · DEPOSITADO NO META"}
            </p>
            <p className="mt-1.5 font-plus-jakarta text-2xl font-extrabold text-ink">
              {formatBRLInteger(resumoAtivo.brutoPago)}
              {/* O depósito sempre acompanha o mês do CALENDÁRIO (a campanha no ar), nunca o
                  mês-alvo — misturar os dois na mesma linha sem rótulo confundia dois meses
                  diferentes (achado "medio" 26/09). Com verMesAlvo ligado, mostra só o pago. */}
              {!verMesAlvo && (
                <span className="text-base font-semibold text-ink-3"> · {formatBRLInteger(totalDepositado)}</span>
              )}
            </p>
            {!verMesAlvo && (saldoDepositar > 0 ? (
              <button
                type="button"
                onClick={() => setShowDepositDialog(true)}
                className="mt-1 text-sm font-semibold text-warn-ink hover:underline"
              >
                Falta depositar {formatBRLInteger(saldoDepositar)} → Registrar depósito
              </button>
            ) : resumo.brutoPago > 0 ? (
              <p className="mt-1 text-sm text-ok-ink">Tudo depositado</p>
            ) : null)}
            {verMesAlvo && saldoDepositar > 0 && (
              <button
                type="button"
                onClick={() => setShowDepositDialog(true)}
                className="mt-1 text-sm font-semibold text-warn-ink hover:underline"
              >
                {nomeMes(mesAtual, { maiuscula: true })}: falta depositar {formatBRLInteger(saldoDepositar)} → Registrar depósito
              </button>
            )}
            {resumoAtivo.brutoPago > 0 && (
              <p
                className="mt-0.5 text-xs text-ink-3"
                title={`Vai para anúncio (depois de ${MARKETING_TAX_PCT}% de imposto): ${formatBRLInteger(brutoLiquido)}`}
              >
                líquido para anúncio: {formatBRLInteger(brutoLiquido)} ({100 - MARKETING_TAX_PCT}%)
              </p>
            )}
          </div>
          <div className={CARTAO}>
            <p className="text-xs font-semibold text-ink-3">CAMPANHAS SUBIDAS</p>
            <p className="mt-1.5 font-plus-jakarta text-2xl font-extrabold text-ink">
              {resumoAtivo.subidasCount} <span className="text-base font-semibold text-ink-3">de {resumoAtivo.pagaramCount} pagas</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-3">marcadas por você</p>
          </div>
        </section>
      )}

      {!filtroValido && janela && adiantar.length > 0 && (
        <button
          type="button"
          onClick={() => setVerAdiantar((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-surface-line bg-white px-5 py-3 text-left hover:bg-surface"
        >
          <span className="text-sm text-ink-2">
            {nomeMes(mesAlvo, { maiuscula: true })}: {resumo.alvo.pagaramCount} de {resumo.total} já pagaram
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-dark">
            Ver quem falta
            <MaterialIcon icon={verAdiantar ? "expand_less" : "expand_more"} size={16} aria-hidden="true" />
          </span>
        </button>
      )}

      {!filtroValido && janela && adiantar.length > 0 && verAdiantar && (
        <section aria-label="Adiantar o mês seguinte" className="rounded-2xl border border-brand/25 bg-white p-5">
          <h3 className="text-base font-bold text-ink">
            Adiantar {nomeMes(mesAlvo)} · {adiantar.length} {adiantar.length === 1 ? "falta" : "faltam"}
          </h3>
          <p className="mt-0.5 text-sm text-ink-3">
            {nomeMes(mesAtual, { maiuscula: true })} está acabando — quem adiantar {nomeMes(mesAlvo)} não fica com o anúncio parado.
          </p>
          <div className="mt-2 divide-y divide-surface-line">
            {adiantar.map((row) => {
              const phone = phoneDaUnidade(row);
              const { to, state } = linkFicha(row.franchise_id, {
                from: `${window.location.pathname}${window.location.search}`,
                label: "Marketing",
              });
              return (
                <div key={row.franchise_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-semibold text-ink">{nomeCurto(row.franchise_name)}</span>
                  {phone ? (
                    <a
                      href={safeHref(getWhatsAppLink(phone, montarMensagemAdiantar(mesAlvo, row)))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={LINK_ACAO}
                    >
                      <MaterialIcon icon="chat" size={16} aria-hidden="true" className="mr-1" />
                      Chamar para adiantar {nomeMes(mesAlvo)} →
                    </a>
                  ) : (
                    <Link to={to} state={state} className={`${LINK_ACAO} text-ink-3`}>
                      Cadastrar telefone →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {filtro === "a_confirmar" && aConfirmar.length === 0 && (
        <p className="rounded-2xl border border-surface-line bg-white p-5 text-sm text-ink-3">Nenhuma verba esperando confirmação agora.</p>
      )}

      {somenteFiltro("a_confirmar", aConfirmar.length > 0) && (
        <section aria-label="A confirmar" className="rounded-2xl border border-warn/40 bg-warn-soft p-5">
          <h3 className="text-base font-bold text-ink">A confirmar · {aConfirmar.length}</h3>
          <div className="mt-2 divide-y divide-warn/20">
            {aConfirmar.map(({ payment, row }) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold text-ink">{row ? nomeCurto(row.franchise_name) : payment.franchise_id}</p>
                  <p className="text-sm text-ink-2">
                    {formatBRL(Number(payment.amount) || 0)} · verba de {nomeMes(payment.reference_month)}
                    {" · enviado "}{haDias(diasDesde(payment.created_at))}
                    {!payment.proof_url && <span className="text-warn-ink"> · sem comprovante</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {payment.proof_url && (
                    <a
                      href={safeHref(payment.proof_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center text-sm font-semibold text-warn-ink hover:underline"
                    >
                      Ver comprovante
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 border-ok text-ok-ink hover:bg-ok/10"
                    disabled={actionLoading === payment.id}
                    onClick={() => handleConfirm(payment.id)}
                  >
                    <MaterialIcon icon="check" size={16} className="mr-1" />
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-10 text-err hover:bg-err/10"
                    disabled={actionLoading === payment.id}
                    onClick={() => setRejectDialog({ paymentId: payment.id })}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {somenteFiltro("sem_campanha", (
        <section aria-label="Pagou e a campanha não subiu" className="rounded-2xl border border-brand/25 bg-white p-5">
          <h3 className="text-base font-bold text-ink">
            Pagou e a campanha ainda não subiu · {faltaSubir.length}
          </h3>
          {faltaSubir.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Nenhuma na fila.</p>
          ) : (
            <div className="mt-2 divide-y divide-surface-line">
              {faltaSubir.map(({ row, payment, mes, valor, dias }) => (
                <div key={row.franchise_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold text-ink">{nomeCurto(row.franchise_name)}</p>
                    <p className="text-sm text-ink-3">
                      {formatBRL(Number(valor) || 0)}
                      {mes && mes !== mesAtual ? ` · ${nomeMes(mes, { ano: true })}` : ""}
                      {dias !== null ? ` · paga ${haDias(dias)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment?.proof_url && (
                      <a
                        href={safeHref(payment.proof_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-dark hover:underline"
                      >
                        Ver comprovante
                      </a>
                    )}
                    {payment ? (
                      <Button
                        size="sm"
                        className="min-h-10 bg-brand-dark text-white hover:bg-brand"
                        disabled={actionLoading === payment.id}
                        onClick={() => handleMarquei(payment)}
                      >
                        Já subi no Meta
                      </Button>
                    ) : (
                      <Link
                        {...linkFicha(row.franchise_id, { from: `${window.location.pathname}${window.location.search}`, label: "Marketing" })}
                        className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink-3 hover:underline"
                      >
                        Pagamento não encontrado — abrir ficha →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {somenteFiltro("sem_verba", (
        <section aria-label="Não pagaram" className="rounded-2xl border border-surface-line bg-white p-5">
          <h3 className="text-base font-bold text-ink">Não pagaram a verba · {naoPagaramExibida.length}</h3>
          {naoPagaramExibida.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Todas pagaram.</p>
          ) : (
            <div className="mt-1 divide-y divide-surface-line">
              {naoPagaramExibida.map(({ row, obs, mes, aguardandoConfirmacao }) => {
                const phone = phoneDaUnidade(row);
                const { to, state } = linkFicha(row.franchise_id, {
                  from: `${window.location.pathname}${window.location.search}`,
                  label: "Marketing",
                });
                return (
                  <div key={row.franchise_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 text-[15px]">
                      <strong className="text-ink">{nomeCurto(row.franchise_name)}</strong>{" "}
                      {aguardandoConfirmacao ? (
                        <span className="text-sm text-warn-ink">pagamento a confirmar</span>
                      ) : (
                        obs && <span className="text-sm text-ink-3">{obs}</span>
                      )}
                    </span>
                    {aguardandoConfirmacao ? (
                      <span className="inline-flex min-h-10 shrink-0 items-center text-sm text-ink-3">Em "A confirmar"</span>
                    ) : phone ? (
                      <a
                        href={safeHref(getWhatsAppLink(
                          phone,
                          janela ? montarMensagemAdiantar(mesAlvo, row) : montarMensagemVerba(mes, row)
                        ))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
                      >
                        <MaterialIcon icon="chat" size={16} aria-hidden="true" />
                        {janela ? `Chamar sobre ${nomeMes(mesAlvo)} →` : "Chamar →"}
                      </a>
                    ) : (
                      <Link
                        to={to}
                        state={state}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-ink-3 hover:underline"
                      >
                        Cadastrar telefone →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {/* Sem filtro e recolhida por padrão: são pagamentos que o próprio admin já confirmou
          (o dinheiro foi conferido) — pedir a foto dias depois raramente muda alguma coisa,
          então a fila não compete em peso visual com o que é urgente (achado "media" 26/09). */}
      {!filtroValido && semComprovanteExibida.length > 0 && (
        <button
          type="button"
          onClick={() => setVerSemComprovante((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-3 hover:underline"
        >
          <MaterialIcon icon={verSemComprovante ? "expand_less" : "expand_more"} size={16} aria-hidden="true" />
          {semComprovanteExibida.length === 1
            ? "1 pagamento confirmado sem foto do comprovante"
            : `${semComprovanteExibida.length} pagamentos confirmados sem foto do comprovante`}
        </button>
      )}

      {somenteFiltro("sem_comprovante", (!filtroValido && !verSemComprovante) ? null : (
        <section aria-label="Pagou sem comprovante" className="rounded-2xl border border-surface-line bg-white p-5">
          <h3 className="text-base font-bold text-ink">Pagou sem comprovante · {semComprovanteExibida.length}</h3>
          {semComprovanteExibida.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Nenhuma pendência.</p>
          ) : (
            <div className="mt-2 divide-y divide-surface-line">
              {semComprovanteExibida.map(({ payment, row, pendente }) => {
                const phone = row ? phoneDaUnidade(row) : null;
                return (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span>
                      <strong>{row ? nomeCurto(row.franchise_name) : payment.franchise_id}</strong>{" "}
                      <span className="text-ink-3">{formatBRL(Number(payment.amount) || 0)}</span>
                      {pendente && <span className="text-warn-ink"> · pagamento a confirmar</span>}
                    </span>
                    {pendente ? (
                      <span className="inline-flex min-h-10 shrink-0 items-center text-sm text-ink-3">Em "A confirmar"</span>
                    ) : phone ? (
                      <a
                        href={safeHref(getWhatsAppLink(phone, montarMensagemComprovante(payment.reference_month, row)))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
                      >
                        <MaterialIcon icon="chat" size={16} aria-hidden="true" />
                        Pedir comprovante →
                      </a>
                    ) : (
                      <span className="text-xs text-ink-3">Lançado sem foto do comprovante</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {!filtroValido && (
        <div className="text-sm text-ink-3">
          <button
            type="button"
            onClick={() => setMaisAcoes((v) => !v)}
            className="inline-flex min-h-10 items-center font-semibold text-brand-dark hover:underline"
          >
            Histórico, retorno de anúncio e cancelar pagamento: Mais ações {maisAcoes ? "▴" : "▾"}
          </button>
        </div>
      )}

      {!filtroValido && maisAcoes && (
        <div className="rounded-2xl border border-surface-line bg-surface p-1">
          <MarketingPaymentsAdmin franchises={franchises} onChanged={recarregarTudo} modoHistorico />
        </div>
      )}

      <MetaDepositDialog
        open={showDepositDialog}
        onOpenChange={setShowDepositDialog}
        referenceMonth={mesAtual}
        onSaved={recarregarTudo}
      />

      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar pagamento</DialogTitle>
            <DialogDescription>Informe o motivo da recusa (opcional)</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm">Motivo</Label>
            <Textarea
              placeholder="Ex: Comprovante ilegível"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              className="resize-none border-surface-line"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleReject}
              disabled={!!actionLoading}
              className="bg-err text-white hover:bg-brand"
            >
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
