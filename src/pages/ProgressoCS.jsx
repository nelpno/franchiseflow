// "Progresso do CS" (admin) — Onda 2, seção 5c do estudo do Mural. Substitui o relatório
// manual: o que o Celso fez, estado da fila, cartões por desfecho, decisões do Nelson e o
// placar de impacto (episódio × controle), sempre com semana ou mês.
//
// A rota (/ProgressoCS) é registrada pelo orquestrador em pages.config.js/App.jsx — este
// arquivo só assume que chegou lá.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import PageHeader from "@/components/shared/PageHeader";
import ErrorState from "@/components/shared/ErrorState";
import { PAGINA, CHIP, CHIP_ATIVO, CHIP_INATIVO } from "@/components/shared/adminUi";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { getCsProgresso, getCsImpacto } from "@/entities/csProgresso";
import {
  hojeSP, periodoRange, periodoAnterior, periodoProximo, podeAvancar,
  rotuloPeriodo, periodoValido, refValida,
} from "@/lib/csProgresso";
import AtividadeCelso from "@/components/progresso-cs/AtividadeCelso";
import EstadoFila from "@/components/progresso-cs/EstadoFila";
import CartoesDesfecho from "@/components/progresso-cs/CartoesDesfecho";
import DecisoesNelson from "@/components/progresso-cs/DecisoesNelson";
import PlacarImpacto from "@/components/progresso-cs/PlacarImpacto";

const SETA =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";

function PeriodoStepper({ periodo, refAtual, onChange }) {
  const hoje = hojeSP();
  const podeAvancarAgora = podeAvancar(periodo, refAtual, hoje);
  return (
    <div className="inline-flex h-11 items-center gap-1 self-start rounded-xl border border-surface-line bg-white px-0.5 sm:self-auto">
      <button
        type="button"
        onClick={() => onChange(periodoAnterior(periodo, refAtual))}
        aria-label={periodo === "semana" ? "Semana anterior" : "Mês anterior"}
        title={periodo === "semana" ? "Semana anterior" : "Mês anterior"}
        className={SETA}
      >
        <MaterialIcon icon="chevron_left" size={20} aria-hidden="true" />
      </button>
      <span className="min-w-[160px] text-center text-sm font-semibold text-ink" aria-live="polite">
        {rotuloPeriodo(periodo, refAtual, hoje)}
      </span>
      <button
        type="button"
        onClick={() => onChange(periodoProximo(periodo, refAtual))}
        disabled={!podeAvancarAgora}
        aria-label={periodo === "semana" ? "Próxima semana" : "Próximo mês"}
        title={periodo === "semana" ? "Próxima semana" : "Próximo mês"}
        className={SETA}
      >
        <MaterialIcon icon="chevron_right" size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-10 max-w-md rounded-full motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-32 rounded-2xl motion-reduce:animate-none" />
        <Skeleton className="h-32 rounded-2xl motion-reduce:animate-none" />
        <Skeleton className="h-32 rounded-2xl motion-reduce:animate-none" />
        <Skeleton className="h-32 rounded-2xl motion-reduce:animate-none" />
      </div>
      <Skeleton className="h-48 rounded-2xl motion-reduce:animate-none" />
      <Skeleton className="h-48 rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}

export default function ProgressoCS() {
  const [searchParams, setSearchParams] = useSearchParams();

  const hoje = hojeSP();
  const periodoUrl = searchParams.get("periodo");
  const periodo = periodoValido(periodoUrl) ? periodoUrl : "semana";
  const refUrl = searchParams.get("ref");
  const ref = refValida(refUrl) ? refUrl : hoje;

  const [estado, setEstado] = useState({ carregando: true, erro: null, progresso: null, impacto: null });
  const [tentativa, setTentativa] = useState(0);

  const { ini, fim } = useMemo(() => periodoRange(periodo, ref, hoje), [periodo, ref, hoje]);

  const atualizar = (mudancas) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(mudancas)) {
          if (v === null || v === undefined || v === "") p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true }
    );
  };

  const trocarPeriodo = (novoPeriodo) => atualizar({ periodo: novoPeriodo === "semana" ? null : novoPeriodo, ref: null });
  const trocarRef = (novoRef) => atualizar({ ref: novoRef === hoje ? null : novoRef });

  useEffect(() => {
    let vivo = true;
    const controller = new AbortController();
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    Promise.all([
      getCsProgresso(ini, fim, { signal: controller.signal }),
      getCsImpacto(ini, fim, { signal: controller.signal }),
    ])
      .then(([progresso, impacto]) => {
        if (!vivo) return;
        setEstado({ carregando: false, erro: null, progresso, impacto });
      })
      .catch((error) => {
        if (!vivo || error?.name === "AbortError") return;
        setEstado({ carregando: false, erro: safeErrorMessage(error, "Não deu para carregar o progresso do CS."), progresso: null, impacto: null });
      });
    return () => {
      vivo = false;
      controller.abort();
    };
  }, [ini, fim, tentativa]);

  const recarregar = () => setTentativa((t) => t + 1);

  return (
    <div className={PAGINA}>
      <PageHeader
        voltar={{ to: "/CustomerSuccess", label: "Mural do CS" }}
        titulo="Progresso do CS"
        subtitulo="O que o Celso fez, o estado da fila e o que dá para dizer sobre o efeito em venda."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Período" className="flex gap-2">
          <button
            type="button"
            aria-pressed={periodo === "semana"}
            onClick={() => trocarPeriodo("semana")}
            className={`${CHIP} ${periodo === "semana" ? CHIP_ATIVO : CHIP_INATIVO}`}
          >
            Semana
          </button>
          <button
            type="button"
            aria-pressed={periodo === "mes"}
            onClick={() => trocarPeriodo("mes")}
            className={`${CHIP} ${periodo === "mes" ? CHIP_ATIVO : CHIP_INATIVO}`}
          >
            Mês
          </button>
        </div>
        <PeriodoStepper periodo={periodo} refAtual={ref} onChange={trocarRef} />
      </div>

      {estado.carregando && <Carregando />}

      {!estado.carregando && estado.erro && (
        <ErrorState texto={estado.erro} onTentarNovamente={recarregar} cartao />
      )}

      {!estado.carregando && !estado.erro && (
        <>
          <AtividadeCelso atividade={estado.progresso?.atividade} porSemana={estado.progresso?.por_semana} />
          <EstadoFila fila={estado.progresso?.fila} />
          <CartoesDesfecho desfechos={estado.progresso?.desfechos} />
          <DecisoesNelson comNelson={estado.progresso?.com_nelson} />
          <PlacarImpacto impacto={estado.impacto} />
        </>
      )}
    </div>
  );
}
