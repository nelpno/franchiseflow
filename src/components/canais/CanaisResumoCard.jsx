// Bloco "Canais de venda" do Hoje (admin/gerente/CS, 10/11/2026): últimos 7 dias da rede por canal,
// os dois funis (robô e cardápio) e a adesão ao cardápio. O detalhe por unidade fica em /CanaisVenda.
// Carga própria (useCanaisVenda), fora do polling de 5 min do Hoje; não trava a tela.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/shared/ErrorState";
import SectionTitle from "@/components/shared/SectionTitle";
import { CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { formatPct } from "@/lib/formatters";
import { useCanaisVenda } from "@/entities/canaisVenda";
import { conversaoRobo, participacao, resumoAdesao, sinaisUnidade, textoFatia } from "@/lib/canaisVenda";
import { brl, n, trecho, Comparacao } from "./canaisUi";

const CANAIS = [
  { id: "robo", rotulo: "Robô", rs: "rs_robo", vendas: "vendas_robo" },
  { id: "cardapio", rotulo: "Cardápio", rs: "rs_cardapio", vendas: "vendas_cardapio" },
  { id: "manual", rotulo: "Lançada à mão", rs: "rs_manual", vendas: "vendas_manual" },
];

export default function CanaisResumoCard() {
  const q = useCanaisVenda("7d");
  const d = q.data;
  const a = d?.rede?.atual;
  const p = d?.rede?.anterior;
  const fatia = useMemo(() => participacao(a), [a]);
  const ades = resumoAdesao(d?.adesao);
  const comSinal = useMemo(
    () => (d?.unidades || []).filter((u) => sinaisUnidade(u).length > 0).length,
    [d],
  );

  const titulo = (
    <SectionTitle
      id="canais-hoje"
      titulo="Canais de venda"
      ajuda={d ? `Últimos 7 dias, ${trecho(d.inicio, d.fim)}` : "Últimos 7 dias"}
      acao={<Link to="/CanaisVenda" state={{ from: "hoje" }} className={LINK_ACAO}>Ver por unidade →</Link>}
    />
  );

  if (q.isLoading && !d) {
    return (
      <section className="space-y-3" aria-labelledby="canais-hoje">
        {titulo}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className={`h-28 rounded-2xl motion-reduce:animate-none ${i === 0 ? "col-span-2 md:col-span-1" : ""}`} />)}
        </div>
        <Skeleton className="h-24 rounded-2xl motion-reduce:animate-none" />
      </section>
    );
  }
  if (q.isError || !a) {
    return (
      <section className="space-y-3" aria-labelledby="canais-hoje">
        {titulo}
        <ErrorState cartao texto="Os números dos canais de venda não vieram agora." onTentarNovamente={() => q.refetch()} />
      </section>
    );
  }

  const convA = conversaoRobo(a);
  const convP = conversaoRobo(p);

  return (
    <section className="space-y-3" aria-labelledby="canais-hoje" data-canais-hoje>
      {titulo}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CANAIS.map((c, i) => (
          <div key={c.id} className={`${CARTAO} min-w-0 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-ink-3">{c.rotulo}</p>
            <p className="mt-2 font-plus-jakarta text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{brl(a[c.rs])}</p>
            <p className="mt-1 text-sm text-ink-2 tabular-nums">
              {n(a[c.vendas])} {Number(a[c.vendas]) === 1 ? "venda" : "vendas"}
              {fatia ? ` · ${textoFatia(fatia[c.id])} do total` : ""}
            </p>
            <Comparacao atual={a[c.rs]} anterior={p?.[c.rs]} dados={d} />
          </div>
        ))}
      </div>
      <div className={`${CARTAO} space-y-2 text-sm text-ink-2`}>
        <p>
          <span className="font-semibold text-ink">Robô:</span> {n(a.robo_contatos)} pessoas escreveram, {n(a.robo_compraram)} compraram
          {convA !== null && <> (<span className="font-semibold text-ink tabular-nums">{formatPct(convA)}</span>{convP !== null ? `; antes ${formatPct(convP)}` : ""})</>}.
        </p>
        <p>
          <span className="font-semibold text-ink">Cardápio:</span> {n(a.visitas)} visitas → {n(a.pedidos_enviados)} pedidos montados →{" "}
          {n(a.pedidos_chegaram)} chegaram no WhatsApp → {n(a.pedidos_viraram_venda)} viraram venda.
        </p>
        <p>
          Cardápio ligado em <span className="font-semibold text-ink">{n(ades.ligado)}</span> de {n(ades.total)} unidades
          {ades.pronto > 0 && <> · {n(ades.pronto)} prontas para ligar</>}
          {ades.falta > 0 && <> · {n(ades.falta)} falta configurar</>}.
        </p>
        {comSinal > 0 && (
          <Link to="/CanaisVenda?filtro=sinal" state={{ from: "hoje" }} className={LINK_ACAO}>
            {comSinal === 1 ? "Ver a unidade com sinal →" : `Ver as ${comSinal} unidades com sinal →`}
          </Link>
        )}
      </div>
    </section>
  );
}
