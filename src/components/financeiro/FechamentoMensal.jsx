import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getFechamentoMensal } from "@/entities/all";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { parseDateOnly } from "@/lib/dateOnly";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";

/**
 * Fechamento do mês: uma linha por unidade, com tudo que a conversa de fechamento precisa.
 *
 * Antes eram três telas que não se cruzavam — Financeiro (faturamento), Marketing >
 * Investimento (quem pagou a verba) e Financeiro > Mensalidades (quem pagou o ASAAS).
 * Nenhuma respondia "esta unidade faturou X, não pagou a verba e está com a mensalidade
 * vencida", que é exatamente a pergunta do dia 1º.
 *
 * O lucro vem da MESMA conta do franqueado (get_fechamento_mensal copia calculatePnL,
 * inclusive a regra de a taxa repassada não ser custo). Se o admin visse outro número, a
 * conversa começaria discutindo qual dos dois está certo.
 */

const ORDENS = [
  { valor: "faturamento", rotulo: "Maior faturamento", icone: "payments" },
  { valor: "queda", rotulo: "Maior queda", icone: "trending_down" },
  { valor: "pendencia", rotulo: "Com pendência", icone: "priority_high" },
  { valor: "naoconfirmadas", rotulo: "Vendas a conferir", icone: "rule" },
];

const MKT = {
  confirmed: { rotulo: "Pago", cor: "text-ok-ink bg-ok/10" },
  pending: { rotulo: "Pendente", cor: "text-brand-gold-ink bg-brand-gold/15" },
  rejected: { rotulo: "Recusado", cor: "text-err bg-err/10" },
  sem_registro: { rotulo: "Não pagou", cor: "text-err bg-err/10" },
};

const SUB = {
  PAID: { rotulo: "Pago", cor: "text-ok-ink bg-ok/10" },
  RECEIVED: { rotulo: "Pago", cor: "text-ok-ink bg-ok/10" },
  CONFIRMED: { rotulo: "Pago", cor: "text-ok-ink bg-ok/10" },
  PENDING: { rotulo: "Pendente", cor: "text-brand-gold-ink bg-brand-gold/15" },
  OVERDUE: { rotulo: "Vencido", cor: "text-err bg-err/10" },
  CANCELLED: { rotulo: "Cancelada", cor: "text-ink-3 bg-surface-2" },
  sem_cobranca: { rotulo: "Sem cobrança", cor: "text-err bg-err/10" },
};

function Chip({ mapa, chave, valor }) {
  const cfg = mapa[chave] || { rotulo: chave, cor: "text-ink-3 bg-surface-2" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.cor}`}>
      {cfg.rotulo}
      {valor > 0 ? ` · ${formatBRLInteger(valor)}` : ""}
    </span>
  );
}

function mesesDisponiveis() {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(hoje, i);
    const rotulo = format(d, "MMM/yyyy", { locale: ptBR }).replace(".", "");
    return { valor: format(d, "yyyy-MM"), rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1) };
  });
}

export default function FechamentoMensal() {
  const mountedRef = useRef(true);
  const meses = useMemo(mesesDisponiveis, []);
  const [mes, setMes] = useState(meses[0].valor);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [ordem, setOrdem] = useState("faturamento");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await getFechamentoMensal(mes);
      if (mountedRef.current) setLinhas(dados);
    } catch (e) {
      if (mountedRef.current) setErro(safeErrorMessage(e, "Não foi possível carregar o fechamento."));
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    mountedRef.current = true;
    carregar();
    return () => { mountedRef.current = false; };
  }, [carregar]);

  const calculadas = useMemo(
    () =>
      linhas.map((l) => {
        const fat = parseFloat(l.faturamento) || 0;
        const ant = parseFloat(l.faturamento_anterior) || 0;
        const pendencias =
          (l.marketing_status === "confirmed" ? 0 : 1) +
          (["PAID", "RECEIVED", "CONFIRMED"].includes(l.mensalidade_status) ? 0 : 1);
        return {
          ...l,
          fat,
          ant,
          lucro: parseFloat(l.lucro_caixa) || 0,
          valorNaoConfirmado: parseFloat(l.valor_nao_confirmado) || 0,
          delta: ant > 0 ? ((fat - ant) / ant) * 100 : null,
          pendencias,
        };
      }),
    [linhas]
  );

  const ordenadas = useMemo(() => {
    const arr = [...calculadas];
    if (ordem === "queda") arr.sort((a, b) => (a.delta ?? 999) - (b.delta ?? 999));
    else if (ordem === "pendencia") arr.sort((a, b) => b.pendencias - a.pendencias || b.fat - a.fat);
    else if (ordem === "naoconfirmadas") arr.sort((a, b) => b.vendas_nao_confirmadas - a.vendas_nao_confirmadas);
    else arr.sort((a, b) => b.fat - a.fat);
    return arr;
  }, [calculadas, ordem]);

  const totais = useMemo(
    () =>
      calculadas.reduce(
        (acc, l) => ({
          faturamento: acc.faturamento + l.fat,
          anterior: acc.anterior + l.ant,
          lucro: acc.lucro + l.lucro,
          naoConfirmadas: acc.naoConfirmadas + (l.vendas_nao_confirmadas || 0),
          valorNaoConfirmado: acc.valorNaoConfirmado + l.valorNaoConfirmado,
          mktAberto: acc.mktAberto + (l.marketing_status === "confirmed" ? 0 : 1),
          subAberto: acc.subAberto + (["PAID", "RECEIVED", "CONFIRMED"].includes(l.mensalidade_status) ? 0 : 1),
        }),
        { faturamento: 0, anterior: 0, lucro: 0, naoConfirmadas: 0, valorNaoConfirmado: 0, mktAberto: 0, subAberto: 0 }
      ),
    [calculadas]
  );

  const mesCorrente = mes === format(new Date(), "yyyy-MM");

  if (carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (erro) return <ErrorState titulo="Não deu para carregar o fechamento" texto={erro} onTentarNovamente={carregar} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="h-10 rounded-xl border border-surface-line bg-white px-3 text-sm font-semibold text-ink outline-none"
        >
          {meses.map((m) => (
            <option key={m.valor} value={m.valor}>{m.rotulo}</option>
          ))}
        </select>
        {ORDENS.map((o) => (
          <button
            key={o.valor}
            onClick={() => setOrdem(o.valor)}
            className={`flex items-center gap-1 h-10 px-3 rounded-xl text-sm font-medium transition-colors ${
              ordem === o.valor ? "bg-brand text-white" : "bg-white border border-surface-line text-ink-2"
            }`}
          >
            <MaterialIcon icon={o.icone} size={16} />
            {o.rotulo}
          </button>
        ))}
        {mesCorrente && (
          <span className="text-xs text-ink-3">
            mês em andamento — o comparativo corta o mês anterior no mesmo dia
          </span>
        )}
      </div>

      {calculadas.length === 0 ? (
        <EmptyState icone="event_busy" titulo="Nada para fechar neste mês" texto="Nenhuma unidade com venda, verba ou cobrança no período." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-ink-3 mb-1">Faturamento da rede</p>
                <p className="text-lg font-bold text-ink">{formatBRLInteger(totais.faturamento)}</p>
                <p className="text-xs text-ink-3 mt-1">
                  {totais.anterior > 0
                    ? `${(((totais.faturamento - totais.anterior) / totais.anterior) * 100).toFixed(1).replace(".", ",")}% vs mês anterior`
                    : "sem base de comparação"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-ink-3 mb-1">Lucro em caixa</p>
                <p className={`text-lg font-bold ${totais.lucro >= 0 ? "text-ok-ink" : "text-err"}`}>
                  {formatBRLInteger(totais.lucro)}
                </p>
                <p className="text-xs text-ink-3 mt-1">soma das unidades</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-ink-3 mb-1">Em aberto</p>
                <p className="text-lg font-bold text-ink">
                  {totais.mktAberto} <span className="text-xs font-medium text-ink-3">verba</span>
                  {"  "}
                  {totais.subAberto} <span className="text-xs font-medium text-ink-3">mensalidade</span>
                </p>
                <p className="text-xs text-ink-3 mt-1">unidades a cobrar</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-ink-3 mb-1">Vendas a conferir</p>
                <p className="text-lg font-bold text-ink">{totais.naoConfirmadas}</p>
                <p className="text-xs text-ink-3 mt-1">{formatBRLInteger(totais.valorNaoConfirmado)} sem baixa</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-ink-2">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Unidade</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Faturamento</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">vs mês ant.</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Lucro caixa</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">A conferir</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Marketing</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Mensalidade</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((l) => (
                    <tr key={l.franchise_id} className="border-t border-surface-line">
                      <td className="px-3 py-2 text-ink">
                        <a
                          className="hover:underline hover:text-brand"
                          href={`/Financeiro?tab=porunidade&franchise=${l.franchise_id}`}
                        >
                          {l.franchise_name}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-ink">{formatBRL(l.fat)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {l.delta == null ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <span className={l.delta >= 0 ? "text-ok-ink font-semibold" : "text-err font-semibold"}>
                            {l.delta >= 0 ? "+" : ""}
                            {l.delta.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${l.lucro >= 0 ? "text-ink" : "text-err"}`}>
                        {formatBRL(l.lucro)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {l.vendas_nao_confirmadas > 0 ? (
                          <span className="text-brand-gold-ink font-semibold">
                            {l.vendas_nao_confirmadas} · {formatBRLInteger(l.valorNaoConfirmado)}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Chip mapa={MKT} chave={l.marketing_status} valor={parseFloat(l.marketing_valor) || 0} />
                      </td>
                      <td className="px-3 py-2">
                        <Chip mapa={SUB} chave={l.mensalidade_status} valor={parseFloat(l.mensalidade_valor) || 0} />
                        {l.mensalidade_vencimento && !["PAID", "RECEIVED", "CONFIRMED"].includes(l.mensalidade_status) && (
                          <span className="block text-[11px] text-ink-3 mt-0.5">
                            vence {format(parseDateOnly(l.mensalidade_vencimento), "dd/MM")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-ink-3 leading-relaxed">
            O lucro em caixa é a mesma conta que a franqueada vê na tela dela: faturamento
            (com frete, menos desconto) − taxa de cartão que a franquia absorveu − despesas
            do mês. Taxa repassada ao cliente não entra como custo.
          </p>
        </>
      )}
    </div>
  );
}
