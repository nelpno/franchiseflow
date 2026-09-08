import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMarketingAttribution } from "@/entities/all";
import { MARKETING_TAX_PCT, marketingLiquid } from "@/lib/franchiseUtils";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Retorno da verba de marketing, por unidade.
 *
 * O robô grava ctwa_clid/meta_ad_id no contato desde o primeiro "oi", e a venda guarda
 * contact_id — ou seja, dá para dizer quanto de faturamento veio de quem chegou por anúncio.
 * Isso estava no banco desde sempre e nenhuma tela lia: o admin decidia verba no escuro.
 *
 * Duas honestidades que a tela precisa manter à vista:
 *  - a atribuição é por CONTATO (last-touch): recompra de cliente que um dia veio de anúncio
 *    também conta. Por isso a coluna "clientes novos" existe ao lado — é o recorte estreito.
 *  - não dá para dizer de QUAL campanha: campaign_name está vazio em 100% dos contatos.
 */

const ORDENACOES = [
  { valor: "retorno", rotulo: "Maior retorno", icone: "trending_up" },
  { valor: "pior", rotulo: "Pior retorno", icone: "trending_down" },
  { valor: "receita", rotulo: "Mais receita de anúncio", icone: "payments" },
  { valor: "verba", rotulo: "Maior verba", icone: "sell" },
];

function corDoRetorno(roas) {
  if (roas == null) return { texto: "text-ink-3", fundo: "bg-surface-2" };
  if (roas < 1) return { texto: "text-brand", fundo: "bg-brand/10" };
  if (roas < 3) return { texto: "text-brand-gold-ink", fundo: "bg-brand-gold/15" };
  return { texto: "text-ok-ink", fundo: "bg-ok/10" };
}

const vezes = (n) => `${n.toFixed(1).replace(".", ",")}×`;

export default function MarketingRetornoPanel({ month }) {
  const mountedRef = useRef(true);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await getMarketingAttribution(month);
      if (mountedRef.current) setLinhas(dados);
    } catch (e) {
      if (mountedRef.current) {
        setErro(safeErrorMessage(e, "Não foi possível carregar o retorno da verba."));
      }
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [month]);

  useEffect(() => {
    mountedRef.current = true;
    carregar();
    return () => {
      mountedRef.current = false;
    };
  }, [carregar]);

  if (carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (erro) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <MaterialIcon icon="cloud_off" size={32} className="text-ink-3" />
          <p className="text-sm text-ink-2">{erro}</p>
          <Button variant="outline" size="sm" className="min-h-[40px]" onClick={carregar}>
            <MaterialIcon icon="refresh" size={16} className="mr-1" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <RetornoDaVerba linhas={linhas} month={month} />;
}

/**
 * Parte pura: recebe as linhas da RPC e desenha. Separada do container de proposito —
 * e o que permite o smoke test renderizar a tabela com os dados REAIS do banco em Node,
 * sem browser e sem login (as duas telas de franqueado da onda 4 nao puderam ser testadas
 * assim justamente por dependerem de sessao).
 */
export function RetornoDaVerba({ linhas, month }) {
  const [ordem, setOrdem] = useState("retorno");

  const comCalculo = useMemo(
    () =>
      linhas.map((l) => {
        const bruto = parseFloat(l.verba_bruta) || 0;
        const liquido = marketingLiquid(bruto);
        const receitaAnuncio = parseFloat(l.receita_anuncio) || 0;
        return {
          ...l,
          bruto,
          liquido,
          receitaAnuncio,
          receitaTotal: parseFloat(l.receita_total) || 0,
          roas: liquido > 0 ? receitaAnuncio / liquido : null,
        };
      }),
    [linhas]
  );

  const ordenadas = useMemo(() => {
    const arr = [...comCalculo];
    // quem nao pagou verba no mes nao tem retorno: vai para o fim, em qualquer ordenacao
    const semVerbaPorUltimo = (a, b, cmp) => {
      if (a.roas == null && b.roas == null) return b.receitaAnuncio - a.receitaAnuncio;
      if (a.roas == null) return 1;
      if (b.roas == null) return -1;
      return cmp(a, b);
    };
    if (ordem === "retorno") arr.sort((a, b) => semVerbaPorUltimo(a, b, (x, y) => y.roas - x.roas));
    else if (ordem === "pior") arr.sort((a, b) => semVerbaPorUltimo(a, b, (x, y) => x.roas - y.roas));
    else if (ordem === "receita") arr.sort((a, b) => b.receitaAnuncio - a.receitaAnuncio);
    else arr.sort((a, b) => b.bruto - a.bruto);
    return arr;
  }, [comCalculo, ordem]);

  const total = useMemo(() => {
    const t = comCalculo.reduce(
      (acc, l) => ({
        liquido: acc.liquido + l.liquido,
        receitaAnuncio: acc.receitaAnuncio + l.receitaAnuncio,
        receitaTotal: acc.receitaTotal + l.receitaTotal,
        clientesNovos: acc.clientesNovos + (l.clientes_novos_anuncio || 0),
      }),
      { liquido: 0, receitaAnuncio: 0, receitaTotal: 0, clientesNovos: 0 }
    );
    return {
      ...t,
      roas: t.liquido > 0 ? t.receitaAnuncio / t.liquido : null,
      pctReceita: t.receitaTotal > 0 ? (100 * t.receitaAnuncio) / t.receitaTotal : 0,
    };
  }, [comCalculo]);

  // Mes corrente: o numero esta parcial. Omitir isso faz todo dia 2 a rede parecer em queda.
  const mesCorrente = month === new Date().toISOString().slice(0, 7);
  const diaDeHoje = new Date().getDate();

  if (comCalculo.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 text-center">
          <MaterialIcon icon="query_stats" size={32} className="text-ink-4 mb-2" />
          <p className="text-sm text-ink-2">Nenhuma venda nem verba registrada neste mês.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink font-plus-jakarta">Retorno da verba</h3>
          <p className="text-sm text-ink-2">
            Quanto voltou em venda de quem chegou por anúncio
            {mesCorrente ? ` — mês em andamento, até o dia ${diaDeHoje}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {ORDENACOES.map((o) => (
            <Button
              key={o.valor}
              variant={ordem === o.valor ? "default" : "outline"}
              size="sm"
              className="min-h-[40px]"
              onClick={() => setOrdem(o.valor)}
            >
              <MaterialIcon icon={o.icone} size={14} className="mr-1" />
              {o.rotulo}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-ink-3 mb-1">Receita de anúncio</p>
            <p className="text-lg font-bold text-ink">{formatBRLInteger(total.receitaAnuncio)}</p>
            <p className="text-xs text-ink-3 mt-1">
              {total.pctReceita.toFixed(1).replace(".", ",")}% de tudo que a rede vendeu
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-ink-3 mb-1">Verba líquida</p>
            <p className="text-lg font-bold text-ink">{formatBRLInteger(total.liquido)}</p>
            <p className="text-xs text-ink-3 mt-1">já sem os {MARKETING_TAX_PCT}% do Meta</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-ink-3 mb-1">Retorno da rede</p>
            <p className={`text-lg font-bold ${corDoRetorno(total.roas).texto}`}>
              {total.roas == null ? "—" : vezes(total.roas)}
            </p>
            <p className="text-xs text-ink-3 mt-1">
              {total.roas == null ? "sem verba no mês" : "para cada R$ 1 em anúncio"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-ink-3 mb-1">Clientes novos</p>
            <p className="text-lg font-bold text-ink">
              {total.clientesNovos.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-ink-3 mt-1">chegaram por anúncio neste mês</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Unidade</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Verba líquida</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                  Receita de anúncio
                </th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Retorno</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Vendas</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                  Clientes novos
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => {
                const cor = corDoRetorno(l.roas);
                return (
                  <tr key={l.franchise_id} className="border-t border-surface-line">
                    <td className="px-3 py-2 text-ink">{l.franchise_name}</td>
                    <td className="px-3 py-2 text-right text-ink-2 whitespace-nowrap">
                      {l.bruto > 0 ? formatBRL(l.liquido) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-ink whitespace-nowrap">
                      {formatBRL(l.receitaAnuncio)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 rounded-md font-bold ${cor.fundo} ${cor.texto}`}
                      >
                        {l.roas == null ? "sem verba" : vezes(l.roas)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-2">{l.vendas_anuncio}</td>
                    <td className="px-3 py-2 text-right text-ink-2">
                      {l.clientes_novos_anuncio}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-ink-3 leading-relaxed">
        Conta como venda de anúncio toda venda ligada a um contato que chegou pelo clique do
        anúncio — inclusive a recompra de quem já era cliente. Por isso a coluna &quot;clientes
        novos&quot; ao lado: ela conta só quem apareceu neste mês. Não dá para dizer de qual
        campanha veio — o nome da campanha não chega no contato.
      </p>
    </div>
  );
}
