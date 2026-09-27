// Detalhe do faturamento por dia do mês corrente (admin). Abre ao tocar no cartão de
// faturamento do Hoje (rede) ou da Ficha (uma unidade).
//   <FaturamentoDiaSheet open={a} onOpenChange={setA} dados={rpc} mostrarUnidades />
//   <FaturamentoDiaSheet open={a} onOpenChange={setA} dados={rpc} titulo="Itápolis" />
// dados = get_faturamento_por_dia (src/entities/faturamentoDia.js). Barras = cada dia; linha =
// o mesmo dia da semana 4 semanas antes (dia − 28; SVG próprio). Lista: dia, valor e a diferença (só o número
// colorido, K7). Com `mostrarUnidades`, tocar num dia abre as unidades que venderam nele.
// Sheet de baixo no celular e centrado como diálogo no desktop (padrão do CLAUDE.md).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRLInteger } from "@/lib/formatters";
import { nomeMes } from "@/lib/adminFormat";
import { linkFicha, nomeCurto } from "@/lib/networkOverview";
import {
  LEGENDA_LINHA, escalaMax, montarDias, rotuloDia, subtituloDetalhe, textoDiferenca, tituloDetalhe, unidadesDoDia,
} from "@/lib/faturamentoDia";
import { LINK_ACAO } from "./adminUi";

const FILL = { acima: "fill-brand", abaixo: "fill-ink-4" };

function Grafico({ dias, selecionado, onSelecionar }) {
  const n = dias.length;
  const max = escalaMax(dias);
  const y = (v) => 100 - (v / max) * 96;
  // A linha (4 semanas antes) para no último dia até hoje.
  const trechos = [];
  let atual = [];
  dias.forEach((d, i) => {
    if (d.futuro || d.ant === null) {
      if (atual.length) trechos.push(atual);
      atual = [];
    } else {
      atual.push(`${i * 10 + 5},${y(d.ant).toFixed(2)}`);
    }
  });
  if (atual.length) trechos.push(atual);
  const marcas = [1, 8, 15, 22, n].filter((v, i, a) => v <= n && a.indexOf(v) === i);

  return (
    <div aria-hidden="true">
      <svg viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" className="block h-36 w-full sm:h-44">
        <line x1="0" x2={n * 10} y1="100" y2="100" className="stroke-surface-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {dias.map((d, i) => {
          if (d.futuro) return null;
          const h = d.rev ? Math.max(1.5, (d.rev / max) * 96) : 1;
          const sel = selecionado === d.dia;
          return (
            <g key={d.dia} onClick={() => onSelecionar(d.dia)} className="cursor-pointer">
              <rect x={i * 10} y="0" width="10" height="100" className="fill-transparent" />
              <rect
                x={i * 10 + 1.5}
                y={100 - h}
                width="7"
                height={h}
                rx="1"
                className={`${d.rev ? FILL[d.tom] || "fill-brand" : "fill-ink-4"} ${selecionado && !sel ? "opacity-40" : ""}`}
              />
            </g>
          );
        })}
        {trechos.map((pts, k) =>
          pts.length === 1 ? (
            <circle key={k} cx={pts[0].split(",")[0]} cy={pts[0].split(",")[1]} r="1.2" className="fill-ink" />
          ) : (
            <polyline
              key={k}
              points={pts.join(" ")}
              fill="none"
              className="stroke-ink"
              strokeWidth="1.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
      </svg>
      <div className="relative mt-1 h-4 text-xs tabular-nums text-ink-3">
        {marcas.map((m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2"
            style={{ left: `${((m - 0.5) / n) * 100}%` }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" aria-hidden="true" />
        igual ou acima
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px] bg-ink-4" aria-hidden="true" />
        abaixo
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-ink" aria-hidden="true" />
        {LEGENDA_LINHA}
      </span>
    </div>
  );
}

function Unidades({ lista, location }) {
  if (!lista.length) return <p className="px-2 pb-3 text-sm text-ink-3">Nenhuma unidade vendeu neste dia.</p>;
  return (
    <ul className="mb-2 rounded-xl bg-surface-2 px-3 py-1">
      {lista.map((u) => {
        const { to, state } = linkFicha(u.franchise_id, { from: location.pathname + location.search, label: "Hoje" });
        return (
          <li key={u.franchise_id} className="flex items-center gap-3 border-t border-surface-line py-1 first:border-t-0">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{nomeCurto(u.franchise_name)}</span>
            <span className="shrink-0 text-sm tabular-nums text-ink-2">{formatBRLInteger(u.rev)}</span>
            <Link to={to} state={state} className={`${LINK_ACAO} shrink-0`}>
              Abrir ficha →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function FaturamentoDiaSheet({ open, onOpenChange, dados, mostrarUnidades = false, titulo }) {
  const location = useLocation();
  const dias = useMemo(() => montarDias(dados), [dados]);
  const passados = useMemo(() => dias.filter((d) => !d.futuro).reverse(), [dias]);
  const [selecionado, setSelecionado] = useState(null);
  const listaRef = useRef(null);
  const mes = dados?.mes || "";

  useEffect(() => {
    if (!open) setSelecionado(null);
  }, [open]);

  const selecionar = (dia) => {
    setSelecionado((atual) => (atual === dia ? null : dia));
    const el = listaRef.current?.querySelector(`[data-dia="${dia}"]`);
    if (el?.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl p-5 sm:bottom-8 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-2xl sm:p-6"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-plus-jakarta text-lg font-bold text-ink">
            {titulo ? `${titulo} · faturamento por dia em ${nomeMes(mes)}` : tituloDetalhe(mes)}
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-2">
            {subtituloDetalhe(dias)}.
          </SheetDescription>
        </SheetHeader>

        {dias.length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">Ainda sem venda neste mês.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <Grafico dias={dias} selecionado={selecionado} onSelecionar={selecionar} />
            <Legenda />

            <div ref={listaRef}>
              <div className="flex items-center gap-3 whitespace-nowrap border-b border-surface-line px-2 pb-2 text-xs font-bold uppercase tracking-wide text-ink-3">
                <span className="flex-1">Dia</span>
                <span className="w-24 text-right">Faturou</span>
                <span className="w-24 text-right">Contra 4 sem.</span>
                {mostrarUnidades && <span className="w-5" aria-hidden="true" />}
              </div>
              <ul>
                {passados.map((d) => {
                  const aberto = selecionado === d.dia;
                  const dif = textoDiferenca(d.diff);
                  const corDif = d.diff > 0.5 ? "text-ok-ink" : d.diff < -0.5 ? "text-err" : "text-ink-2";
                  const conteudo = (
                    <>
                      <span className="min-w-0 flex-1 whitespace-nowrap text-sm font-semibold text-ink">
                        {rotuloDia(d.dia)}
                        {d.hoje && <span className="block text-xs font-normal text-ink-3 sm:ml-1.5 sm:inline">hoje, até agora</span>}
                      </span>
                      <span className="w-24 text-right text-sm tabular-nums text-ink">{formatBRLInteger(d.rev)}</span>
                      <span className={`w-24 text-right text-sm font-semibold tabular-nums ${dif ? corDif : "font-normal text-ink-3"}`}>
                        {dif || "—"}
                      </span>
                    </>
                  );
                  return (
                    <li key={d.dia} data-dia={d.dia} className="border-b border-surface-line last:border-b-0">
                      {mostrarUnidades ? (
                        <>
                          <button
                            type="button"
                            onClick={() => selecionar(d.dia)}
                            aria-expanded={aberto}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-surface ${aberto ? "bg-surface" : ""}`}
                          >
                            {conteudo}
                            <MaterialIcon icon={aberto ? "expand_less" : "expand_more"} size={20} className="w-5 shrink-0 text-ink-3" />
                          </button>
                          {aberto && <Unidades lista={unidadesDoDia(dados, d.dia)} location={location} />}
                        </>
                      ) : (
                        <div className={`flex min-h-11 items-center gap-3 rounded-lg px-2 ${aberto ? "bg-surface" : ""}`}>{conteudo}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
