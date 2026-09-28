// Seção 3 — "Entregues": resumo do mês SEMPRE visível (entregas, unidades, R$, peso, frete,
// tempo médio do pedido até a entrega e comparação com o mesmo trecho do mês anterior) +
// histórico por mês recolhido por padrão (chega aberto só via ?secao=entregues). Toggle para
// "Cancelados" é onde "excluir" mora — ação rara, fora do fluxo principal, sem sumir
// (princípio do plano: nada de funcionalidade some).
//
// Achado 26/09: a linha resumida antiga ("setembro: N pedidos") mostrava 2 na prévia com
// mocks porque o mock só tinha 2 pedidos entregues em setembro — a query real já filtrava
// certo por delivered_at. Esta versão troca o resumo fixo do mês atual por um seletor de mês
// (MonthStepper) + as métricas que o Nelson pediu (quantas entregas, tempo médio) pra ter
// ideia do ritmo, sem precisar abrir a lista.
//
// Busca própria (achado carga.md): a seção não recebe a lista inteira de pedidos do pai —
// pede só o mês/status abertos na tela. Isso tira o histórico do teto de 1000 linhas do
// PostgREST e do peso da carga inicial.
import { forwardRef, useEffect, useMemo, useState } from "react";
import { PurchaseOrder } from "@/entities/all";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { nomeMes, somarMeses } from "@/lib/adminFormat";
import MonthStepper from "@/components/shared/MonthStepper";
import { CARTAO, ROTULO, NUMERO_GRANDE, COMPARACAO, H2, LINK_ACAO } from "@/components/shared/adminUi";
import {
  formatKg,
  filtrarPorTermo,
  freteSalvo,
  resumoLote,
  pedidosLabel,
  COLUNAS_PEDIDO,
  mesAtualBRT,
  limitesMesBRT,
  ateDiaBRT,
  resumoEntregas,
  COLUNAS_CONFERENCIA,
  colunaAusente,
} from "./pedidosHelpers";
import { rotuloConferencia } from "@/lib/conferenciaEntrega";

// "5,3 dias" / "5 dias" (sem decimal quando é número inteiro) / "1 dia".
function diasLabel(n) {
  if (n === null || n === undefined) return null;
  const texto = Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${texto} ${n === 1 ? "dia" : "dias"}`;
}

const unidadesLabel = (n) => `${n} ${n === 1 ? "unidade" : "unidades"}`;

// Linha de resumo acima da lista (aberta): quantidade, R$ em produtos e frete do que está
// visível ali (o mês/status escolhidos na aba).
function RotuloResumoMes({ orders }) {
  const r = resumoLote(orders, (o) => freteSalvo(o) || 0);
  return (
    <span>
      <span className="font-semibold text-ink">{pedidosLabel(r.qtd)}</span>
      {" · "}
      {formatBRLInteger(r.total)} em produtos
      {" · "}
      frete {formatBRLInteger(r.frete)}
    </span>
  );
}

// Cartão sempre visível com o resumo do mês (26/09, pedido do Nelson: "quantas entregas
// fizemos no mês e o tempo médio, pra ter ideia"). Busca própria (colunas enxutas), 1
// consulta pro mês escolhido + 1 pro mesmo trecho do mês anterior — nunca a lista inteira.
function ResumoMesCard({ mes, unidadeParam, testFranchiseIds, versao, aberto, onAbrirChange }) {
  const [resumoAtual, setResumoAtual] = useState(null);
  const [resumoAnterior, setResumoAnterior] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const ehMesAtual = mes === mesAtualBRT();
  const ateDia = ateDiaBRT(mes);
  const mesAnterior = somarMeses(mes, -1);
  const mesAnteriorNome = nomeMes(mesAnterior);

  useEffect(() => {
    let alive = true;
    setCarregando(true);
    setErro(false);
    const colunas = "franchise_id, ordered_at, delivered_at, total_amount, total_weight_kg, freight_cost";
    const buscar = (lim) => {
      const criteria = { status: "entregue" };
      if (unidadeParam) criteria.franchise_id = unidadeParam;
      return PurchaseOrder.filter(criteria, null, null, {
        columns: colunas,
        gte: { delivered_at: lim.inicio },
        lte: { delivered_at: lim.fim },
      });
    };
    const semTeste = (lista) => (lista || []).filter((o) => !testFranchiseIds?.has(o.franchise_id));
    Promise.all([buscar(limitesMesBRT(mes, ateDia)), buscar(limitesMesBRT(mesAnterior, ateDia))])
      .then(([atual, anterior]) => {
        if (!alive) return;
        setResumoAtual(resumoEntregas(semTeste(atual)));
        setResumoAnterior(resumoEntregas(semTeste(anterior)));
      })
      .catch((error) => {
        if (!alive) return;
        console.error("Erro ao carregar resumo de entregas:", error);
        setResumoAtual(null);
        setResumoAnterior(null);
        setErro(true);
      })
      .finally(() => {
        if (alive) setCarregando(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, unidadeParam, testFranchiseIds, versao, tentativa]);

  if (carregando) {
    return <Skeleton className="h-32 rounded-2xl motion-reduce:animate-none" />;
  }

  if (erro || !resumoAtual) {
    return (
      <div className={CARTAO}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-err">Não foi possível carregar o resumo de entregas.</p>
          <button
            type="button"
            onClick={() => setTentativa((t) => t + 1)}
            className="min-h-10 rounded-xl border border-surface-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const semComparacao = !resumoAnterior || resumoAnterior.entregas === 0;

  return (
    <div className={CARTAO}>
      <p className={ROTULO}>
        ENTREGAS · {nomeMes(mes, { maiuscula: true })}
        {ehMesAtual ? ` (ATÉ DIA ${ateDia})` : ""}
      </p>
      <p className={NUMERO_GRANDE}>
        {resumoAtual.entregas}{" "}
        <span className="text-lg font-semibold text-ink-3 sm:text-xl">{resumoAtual.entregas === 1 ? "entrega" : "entregas"}</span>
      </p>
      <p className={COMPARACAO}>
        {unidadesLabel(resumoAtual.unidades)} · {formatBRLInteger(resumoAtual.valor)} em produtos ·{" "}
        {resumoAtual.peso !== null ? formatKg(resumoAtual.peso) : "peso não registrado"} · frete {formatBRLInteger(resumoAtual.frete)}
      </p>
      <p className={COMPARACAO}>
        {resumoAtual.diasMedio !== null ? (
          <>
            Do pedido à entrega: <strong className="font-semibold text-ink">{diasLabel(resumoAtual.diasMedio)}</strong> em média
            {resumoAtual.diasMediana !== null ? ` (mediana ${diasLabel(resumoAtual.diasMediana)})` : ""}
          </>
        ) : (
          "Ainda sem prazo de entrega calculado neste mês."
        )}
      </p>
      <p className={COMPARACAO}>
        {semComparacao ? (
          `Sem entregas no mesmo trecho de ${mesAnteriorNome} para comparar.`
        ) : (
          <>
            Mesmo trecho de {mesAnteriorNome}: {resumoAnterior.entregas} {resumoAnterior.entregas === 1 ? "entrega" : "entregas"}
            {resumoAnterior.diasMedio !== null ? ` · ${diasLabel(resumoAnterior.diasMedio)} em média` : ""}
          </>
        )}
      </p>
      <button type="button" onClick={() => onAbrirChange(!aberto)} className={`${LINK_ACAO} mt-2`}>
        {aberto ? "Recolher" : "Ver entregues →"}
      </button>
    </div>
  );
}

const EntreguesSection = forwardRef(function EntreguesSection(
  {
    getFranchiseName,
    onVerItens,
    onExcluirLote,
    excluindo,
    aberto,
    onAbrirChange,
    statusAba,
    onStatusAbaChange,
    unidadeParam,
    searchTerm,
    testFranchiseIds,
    versao,
  },
  ref
) {
  const [mes, setMes] = useState(() => mesAtualBRT());
  const [selecionados, setSelecionados] = useState(new Set());
  // "Excluir selecionados" apaga de vez — pede confirmação antes de chamar onExcluirLote.
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [doMes, setDoMes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  // Falha na busca não pode virar "nenhum pedido neste mês" calado.
  const [erroBusca, setErroBusca] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const limitesDoMes = useMemo(() => limitesMesBRT(mes), [mes]);

  useEffect(() => {
    if (!aberto) return;
    let alive = true;
    setCarregando(true);
    setErroBusca(false);
    // "entregue" usa delivered_at como referência de mês; "cancelado" não tem data própria
    // de cancelamento no schema, então usa ordered_at — igual ao comportamento anterior.
    const colunaRef = statusAba === "entregue" ? "delivered_at" : "ordered_at";
    const criteria = { status: statusAba };
    if (unidadeParam) criteria.franchise_id = unidadeParam;
    const buscar = (columns) =>
      PurchaseOrder.filter(criteria, `-${colunaRef}`, null, {
        columns,
        gte: { [colunaRef]: limitesDoMes.inicio },
        lte: { [colunaRef]: limitesDoMes.fim },
      });
    // S15: tenta com as colunas da conferência; banco sem elas -> busca de sempre.
    buscar(`${COLUNAS_PEDIDO}, ${COLUNAS_CONFERENCIA}`)
      .catch((error) => (colunaAusente(error) ? buscar(COLUNAS_PEDIDO) : Promise.reject(error)))
      .then((data) => {
        if (!alive) return;
        const semTeste = (data || []).filter((o) => !testFranchiseIds?.has(o.franchise_id));
        setDoMes(filtrarPorTermo(semTeste, searchTerm, getFranchiseName));
      })
      .catch((error) => {
        if (!alive) return;
        console.error("Erro ao carregar histórico de pedidos:", error);
        setDoMes([]);
        setErroBusca(true);
      })
      .finally(() => {
        if (alive) setCarregando(false);
      });
    return () => {
      alive = false;
    };
  }, [aberto, limitesDoMes, statusAba, unidadeParam, searchTerm, testFranchiseIds, getFranchiseName, versao, refetchToken]);

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Só limpa a seleção quando a exclusão deu certo — `onExcluirLote` (excluirCancelados na
  // página) agora devolve true/false em vez de engolir o erro numa promise sempre resolvida.
  const confirmarExcluirSelecionados = async () => {
    const ok = await onExcluirLote(Array.from(selecionados));
    if (ok) { setSelecionados(new Set()); setRefetchToken((t) => t + 1); }
    setConfirmarExclusao(false);
  };

  return (
    <>
    <section ref={ref} aria-label="Entregues" className="space-y-3 scroll-mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={H2}>3. Entregues</h2>
        <MonthStepper
          mes={mes}
          max={mesAtualBRT()}
          onChange={(novo) => { setMes(novo); setSelecionados(new Set()); }}
        />
      </div>

      <ResumoMesCard
        mes={mes}
        unidadeParam={unidadeParam}
        testFranchiseIds={testFranchiseIds}
        versao={versao}
        aberto={aberto}
        onAbrirChange={onAbrirChange}
      />

      {aberto && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Status" className="flex gap-1.5">
              {[
                { k: "entregue", label: "Entregues" },
                { k: "cancelado", label: "Cancelados" },
              ].map((t) => (
                <button
                  key={t.k}
                  type="button"
                  aria-pressed={statusAba === t.k}
                  onClick={() => { onStatusAbaChange(t.k); setSelecionados(new Set()); }}
                  className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${
                    statusAba === t.k ? "border-brand-dark bg-brand-dark text-white" : "border-surface-line bg-white text-ink-2 hover:bg-surface"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {statusAba === "cancelado" && selecionados.size > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-err/30 bg-err/5 px-4 py-2.5">
              <span className="text-sm font-medium text-ink">{selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}</span>
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                disabled={excluindo}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-err px-3 text-sm font-bold text-white disabled:opacity-60"
              >
                <MaterialIcon icon="delete" size={14} aria-hidden="true" />
                Excluir selecionados
              </button>
            </div>
          )}

          {carregando ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl motion-reduce:animate-none" />)}
            </div>
          ) : erroBusca ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-err/30 bg-white p-5 text-sm text-err">
              Não foi possível carregar o histórico deste mês.
              <button type="button" onClick={() => setRefetchToken((t) => t + 1)} className="min-h-10 rounded-xl border border-surface-line px-4 font-semibold text-ink hover:bg-surface">
                Tentar de novo
              </button>
            </div>
          ) : doMes.length === 0 ? (
            <div className="rounded-2xl border border-surface-line bg-white p-5 text-sm text-ink-3">
              Nenhum pedido {statusAba === "entregue" ? "entregue" : "cancelado"} neste mês.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-surface-line bg-white">
              <div className="border-b border-surface-line bg-surface/60 px-4 py-2.5 text-sm text-ink-2 sm:px-5">
                <RotuloResumoMes orders={doMes} />
              </div>
              <div className="divide-y divide-surface-line">
                {doMes.map((order) => {
                  const frete = freteSalvo(order) || 0;
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-4 sm:px-5 sm:py-3">
                      {statusAba === "cancelado" && (
                        <label className="-m-2 flex shrink-0 cursor-pointer items-center p-2">
                          <input
                            type="checkbox"
                            checked={selecionados.has(order.id)}
                            onChange={() => toggleSelecionado(order.id)}
                            className="h-5 w-5 rounded border-ink-4 accent-brand"
                            aria-label={`Selecionar pedido de ${getFranchiseName(order.franchise_id)}`}
                          />
                        </label>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                          {getFranchiseName(order.franchise_id)}
                          {(order.received_mode === "divergente" || order.received_mode === "automatico") && (
                            <span
                              className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-bold ${
                                order.received_mode === "divergente" ? "bg-err-soft text-err" : "bg-surface-2 text-ink-2"
                              }`}
                            >
                              <MaterialIcon icon={order.received_mode === "divergente" ? "error" : "schedule"} size={12} aria-hidden="true" />
                              {rotuloConferencia(order.received_mode)}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-ink-3">
                          {order.status === "entregue" && order.delivered_at
                            ? `entregue em ${new Date(order.delivered_at).toLocaleDateString("pt-BR")}`
                            : `pedido em ${order.ordered_at ? new Date(order.ordered_at).toLocaleDateString("pt-BR") : "—"}`}
                        </p>
                      </div>
                      <span className="hidden text-sm text-ink-2 sm:inline">
                        {formatBRL(order.total_amount)}
                        {order.received_mode === "divergente" && order.ordered_total_amount != null ? ` (pedido ${formatBRL(order.ordered_total_amount)})` : ""}
                        {" · "}{frete > 0 ? `frete ${formatBRL(frete)}` : "sem frete"} · {formatKg(order.total_weight_kg)}
                      </span>
                      <button type="button" onClick={() => onVerItens(order)} className="min-h-10 shrink-0 text-sm font-semibold text-brand-dark hover:underline">
                        Ver itens →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>

    <Dialog open={!!confirmarExclusao} onOpenChange={(open) => { if (!open) setConfirmarExclusao(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-plus-jakarta">
            <MaterialIcon icon="delete" size={20} className="text-err" />
            Excluir pedidos cancelados
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ink-2">
          Excluir {selecionados.size} pedido{selecionados.size > 1 ? "s" : ""} permanentemente? Essa ação não pode ser desfeita.
        </p>
        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setConfirmarExclusao(false)} disabled={excluindo} className="min-h-10 border-ink-4 text-ink-2 rounded-xl">
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={confirmarExcluirSelecionados}
            disabled={excluindo}
            className="min-h-10 bg-err hover:bg-brand text-white font-bold rounded-xl gap-1"
          >
            {excluindo ? (
              <MaterialIcon icon="progress_activity" size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <MaterialIcon icon="delete" size={16} aria-hidden="true" />
            )}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
});

export default EntreguesSection;
