// Adesão da rede ao Cardápio digital (10f, 10/11/2026): admin e gerente (a RPC também aceita CS, mas a página manda o CS à Início). É como o Nelson acompanha quem ligou.
// Dados: RPC cardapio_adesao (estado + o que falta, pela mesma regra do checklist da franqueada). Datas em Brasília.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/shared/ErrorState";
import { CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, H3_CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { getCardapioAdesao } from "@/entities/all";

export const ESTADOS_ADESAO = [
  { id: "ligado", rotulo: "Ligado", cor: "bg-ok-soft text-ok-ink" },
  { id: "pronto", rotulo: "Pronto para ligar", cor: "bg-brand-gold-soft text-ink" },
  { id: "falta", rotulo: "Falta configurar", cor: "bg-warn-soft text-warn-ink" },
  { id: "nao_abriu", rotulo: "Não abriu", cor: "bg-surface-2 text-ink-2" },
  { id: "pausado", rotulo: "Pausado", cor: "bg-surface-2 text-ink" },
  { id: "pausado_maxi", rotulo: "Pausado pela Maxi", cor: "bg-err-soft text-err" },
];
const POR_ID = Object.fromEntries(ESTADOS_ADESAO.map((e) => [e.id, e]));

const dataBR = (ts) => (ts ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(ts)) : "");
const nomeCurto = (n) => String(n || "").replace(/^Maxi\s+Massas\s+/i, "");
const lista = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} e ${a.at(-1)}`);

/** Linha de detalhe de uma unidade (texto simples, sem número de telefone). */
export function detalheAdesao(u) {
  const falta = Array.isArray(u.faltando) ? u.faltando : [];
  // 10i: sem WhatsApp e o número do robô é o celular do responsável (ex.: Santos): a tela não oferece; a Maxi decide
  if (u.robo_e_responsavel && falta.includes("WhatsApp da unidade")) {
    const resto = falta.filter((t) => t !== "WhatsApp da unidade");
    return `Falta o WhatsApp da unidade: o número do robô é o celular do responsável (a Maxi decide qual número usar)${resto.length ? ` · falta também: ${lista(resto)}` : ""}`;
  }
  const avisos = Array.isArray(u.avisos) ? u.avisos : [];
  switch (u.estado) {
    case "ligado":
      return `Desde ${dataBR(u.desde)} · ${u.pedidos_7d || 0} ${Number(u.pedidos_7d) === 1 ? "pedido enviado" : "pedidos enviados"} em 7 dias${avisos.length ? ` · atenção: ${lista(avisos)}` : ""}`;
    case "pausado":
      return `Desligou em ${dataBR(u.desde)} (ligou a 1ª vez em ${dataBR(u.primeira_vez_em)})${falta.length ? ` · falta: ${lista(falta)}` : ""}`;
    case "pausado_maxi":
      return "Chave da unidade desligada (freio de emergência).";
    case "pronto":
      return `Abriu a página: ${u.abriu_em ? dataBR(u.abriu_em) : "ainda não"}${avisos.length ? ` · atenção: ${lista(avisos)}` : ""}`;
    default:
      return falta.length ? `Falta: ${lista(falta)}` : "";
  }
}

export default function AdesaoRede({ franquias, onAbrir }) {
  const [filtro, setFiltro] = useState(null);
  const q = useQuery({ queryKey: ["cardapio-adesao"], queryFn: ({ signal }) => getCardapioAdesao({ signal }), staleTime: 60 * 1000 });
  const linhas = q.data || [];
  const contagem = useMemo(() => Object.fromEntries(ESTADOS_ADESAO.map((e) => [e.id, linhas.filter((u) => u.estado === e.id).length])), [linhas]);
  const visiveis = filtro ? linhas.filter((u) => u.estado === filtro) : linhas;
  const ordem = Object.fromEntries(ESTADOS_ADESAO.map((e, i) => [e.id, i]));
  const ordenadas = [...visiveis].sort((a, b) => (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9) || nomeCurto(a.nome).localeCompare(nomeCurto(b.nome), "pt-BR"));

  return (
    <section className={`${CARTAO} space-y-4`} aria-labelledby="cardapio-adesao">
      <div className="space-y-1">
        <h2 id="cardapio-adesao" className={H3_CARTAO}>Adesão da rede</h2>
        <p className="text-sm text-ink-2">Cada unidade liga sozinha quando a configuração estiver certa. O que falta segue a mesma lista que a franqueada vê.</p>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl motion-reduce:animate-none" />)}</div>
      ) : q.isError ? (
        <ErrorState cartao texto="Não deu para carregar a lista." onTentarNovamente={() => q.refetch()} />
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por situação">
            <button type="button" className={`${CHIP} ${filtro === null ? CHIP_ATIVO : CHIP_INATIVO}`} aria-pressed={filtro === null} onClick={() => setFiltro(null)}>
              Todas · {linhas.length}
            </button>
            {ESTADOS_ADESAO.filter((e) => contagem[e.id] > 0).map((e) => (
              <button key={e.id} type="button" className={`${CHIP} ${filtro === e.id ? CHIP_ATIVO : CHIP_INATIVO}`} aria-pressed={filtro === e.id}
                onClick={() => setFiltro(filtro === e.id ? null : e.id)}>
                {e.rotulo} · {contagem[e.id]}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-surface-line" data-adesao-lista>
            {ordenadas.map((u) => {
              const est = POR_ID[u.estado] || POR_ID.nao_abriu;
              const f = (franquias || []).find((x) => x.evolution_instance_id === u.evo);
              const det = detalheAdesao(u);
              return (
                <li key={u.evo} className="flex items-start gap-3 py-3 sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-ink">{nomeCurto(u.nome)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${est.cor}`}>{est.rotulo}</span>
                    </p>
                    {det && <p className="mt-0.5 text-sm text-ink-2">{det}</p>}
                  </div>
                  {f && (
                    <button type="button" className={`${LINK_ACAO} -my-2 min-h-11 shrink-0`} onClick={() => onAbrir?.(f)}>
                      Abrir →
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
