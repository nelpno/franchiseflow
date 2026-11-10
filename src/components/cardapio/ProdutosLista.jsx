// Bloco 5: produtos no cardápio (ESPEC § 4.7). Ajuste raro: esconder o que não quer vender online.
// Preço e estoque vêm do Estoque (nada digitado duas vezes). Celular: cartão de até 3 linhas (T9); desktop: grade (T2).
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BTN_SECUNDARIO, CABECALHO_LISTA, CHIP, CHIP_ATIVO, CHIP_INATIVO, H2, LINK_ACAO, LISTA } from "@/components/shared/adminUi";
import { formatBRL } from "@/lib/formatters";
import { FILTROS_PRODUTOS, ROTULO_SITUACAO, diasDesde, resumoZerados, situacaoProduto } from "@/lib/cardapioDigital";
import Interruptor from "./Interruptor";

const TOM_SITUACAO = {
  no_cardapio: "bg-ok-soft text-ok-ink",
  acabou: "bg-warn-soft text-warn-ink",
  escondido: "bg-surface-2 text-ink-3",
  fora: "bg-surface-2 text-ink-3",
};
const GRADE = "md:grid md:grid-cols-[minmax(0,3fr)_7rem_minmax(0,2fr)_8rem] md:items-center md:gap-4";

function Situacao({ p, s }) {
  const dias = s === "fora" ? diasDesde(p.zerado_desde) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOM_SITUACAO[s]}`}>{ROTULO_SITUACAO[s]}</span>
      {dias != null && <span className="whitespace-nowrap text-xs text-ink-3">zerado há {dias} dias</span>}
    </span>
  );
}

export default function ProdutosLista({ produtos, salvandoIds, onMostrar }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [busca, setBusca] = useState("");
  const [abrirTodos, setAbrirTodos] = useState(false);
  const lista = useMemo(() => (produtos || []).map((p) => ({ p, s: situacaoProduto(p) })), [produtos]);
  const contagem = useMemo(() => Object.fromEntries(FILTROS_PRODUTOS.map((f) => [f.id, lista.filter((x) => f.teste(x.s)).length])), [lista]);
  // abre no trabalho dela: "Em falta" quando houver; senão "Todos" (a URL manda, se tiver ?produtos=)
  const daUrl = searchParams.get("produtos");
  const filtroId = FILTROS_PRODUTOS.some((f) => f.id === daUrl) ? daUrl : contagem["em-falta"] > 0 ? "em-falta" : "todos";
  const filtro = FILTROS_PRODUTOS.find((f) => f.id === filtroId);
  const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const doFiltro = lista.filter((x) => filtro.teste(x.s) && (!q || x.p.produto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(q)));
  // "Todos" (40+ linhas no celular) fica recolhido: busca ou "Ver a lista inteira"
  const recolhido = filtroId === "todos" && !q && !abrirTodos;
  const visiveis = recolhido ? [] : doFiltro;
  const fora = resumoZerados(produtos).foraHaMais30;

  const escolherFiltro = (id) => {
    const u = new URLSearchParams(searchParams);
    u.set("produtos", id);
    setSearchParams(u, { replace: true });
  };

  return (
    <section className="space-y-3" aria-labelledby="cardapio-produtos">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="cardapio-produtos" className={H2}>Produtos no cardápio</h2>
        <p className="text-sm text-ink-3">Preço e estoque vêm do Estoque. Esconder tira só do cardápio: o robô continua vendendo o que tiver estoque.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filtrar produtos">
          {FILTROS_PRODUTOS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtroId === f.id} onClick={() => escolherFiltro(f.id)}
              className={`${CHIP} ${filtroId === f.id ? CHIP_ATIVO : CHIP_INATIVO}`}>
              {f.rotulo} · {contagem[f.id]}
            </button>
          ))}
        </div>
        {fora.length > 0 && (
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11 md:ml-auto`} onClick={() => setConfirmarLimpeza(true)}>
            Esconder os zerados há mais de 30 dias
          </button>
        )}
      </div>

      {filtroId === "todos" && (
        <div>
          <label className="sr-only" htmlFor="busca-produto-cardapio">Buscar produto</label>
          <input id="busca-produto-cardapio" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto"
            className="h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 sm:w-72" />
        </div>
      )}

      {recolhido ? (
        <button type="button" className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`} onClick={() => setAbrirTodos(true)}>
          Ver a lista inteira ({contagem.todos})
        </button>
      ) : (
      <div className={LISTA}>
        <div className={`hidden ${GRADE} ${CABECALHO_LISTA}`} aria-hidden="true">
          <span>Produto</span><span className="text-right">Preço</span><span>Situação</span><span className="text-right">Mostrar</span>
        </div>
        <ul>
          {visiveis.map(({ p, s }) => (
            <li key={p.id} className={`flex items-center gap-3 border-t border-surface-line px-4 py-3 first:border-t-0 md:first:border-t md:px-5 ${GRADE}`}>
              <div className="min-w-0 flex-1 md:contents">
                <p className="font-semibold text-ink md:min-w-0">{p.produto}</p>
                <p className="text-sm tabular-nums text-ink-2 md:text-right">{formatBRL(p.preco)}</p>
                <div className="mt-1 md:mt-0"><Situacao p={p} s={s} /></div>
              </div>
              <div className="shrink-0 md:flex md:justify-end">
                <Interruptor checked={p.visivel !== false} disabled={salvandoIds.has(p.id)}
                  onCheckedChange={(v) => onMostrar([p.id], v)} rotulo={<span className="sr-only md:not-sr-only">{p.visivel !== false ? "Sim" : "Não"}</span>}
                  ariaLabel={`Mostrar ${p.produto} no cardápio`} />
              </div>
            </li>
          ))}
          {!visiveis.length && <li className="px-5 py-6 text-sm text-ink-3">{q ? "Nenhum produto com esse nome." : "Nenhum produto neste filtro."}</li>}
        </ul>
      </div>
      )}

      <p className="text-sm text-ink-3">
        Fotos de massas e molhos vêm da rede; os outros produtos aparecem sem foto.{" "}
        <Link to="/Gestao?tab=estoque" className={LINK_ACAO}>Nome e preço se editam no Estoque →</Link>
      </p>

      <AlertDialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esconder {fora.length} {fora.length === 1 ? "produto" : "produtos"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Zerados há mais de 30 dias: {fora.map((x) => x.produto).join(", ")}. Eles já não aparecem para o cliente; escondidos, não voltam
              sozinhos quando você repor. Para mostrar de novo, é só ligar o “Mostrar”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => onMostrar(fora.map((x) => x.id), false)}>Esconder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
