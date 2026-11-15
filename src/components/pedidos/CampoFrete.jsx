// Campo de frete editável direto na lista (sem abrir o pedido). Salva sozinho ao sair do
// campo; Enter pula para o frete do próximo pedido, Esc desfaz o que foi digitado.
// A sugestão da regra (min 250, max 350, 10%) aparece pré-preenchida só em "Para
// confirmar" e nunca troca um valor já salvo. Frete zero é legítimo (acréscimo de outro
// pedido ou retirada): "Sem frete" resolve com 1 toque, e "Usar R$ X" traz a regra de volta.
// `acrescimo` (26/09): quando a unidade já tem outro pedido pendente/confirmado mais
// antigo, a sugestão vira 0 (não a regra) e a dica avisa que é acréscimo. `ultimoFrete`
// mostra o que a unidade pagou da última vez, com um botão para reusar o valor.
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatters";
import { estadoFrete, freteSugerido, parseFrete, FRETE_MIN, FRETE_MAX } from "./pedidosHelpers";

function focarProximo(atual) {
  const campos = Array.from(document.querySelectorAll("[data-frete-input]"));
  const i = campos.indexOf(atual);
  const prox = campos[i + 1];
  if (prox) {
    prox.focus();
    prox.select?.();
  } else {
    atual.blur();
  }
}

export default function CampoFrete({ order, rascunho, sugerir, status, onRascunho, onSalvar, nomeUnidade, acrescimo, dataPedidoBase, ultimoFrete }) {
  const { texto, origem } = estadoFrete(order, rascunho, { sugerir, acrescimo });
  const valorAtual = parseFrete(texto);
  const sugestao = freteSugerido(order.total_amount);
  const semFrete = origem !== "sugerido" && origem !== "acrescimo" && Number.isFinite(valorAtual) && valorAtual === 0;
  const invalido = !Number.isFinite(valorAtual);

  const salvarSeMudou = () => {
    if (rascunho !== undefined) onSalvar(order, rascunho);
  };

  // Botão rápido: troca o RASCUNHO antes de salvar, para a tela, o resumo e o "Confirmar"
  // verem o valor novo na hora (e não um rascunho velho/inválido ou a sugestão).
  const usarValor = (textoNovo) => {
    onRascunho(order.id, textoNovo);
    onSalvar(order, textoNovo);
  };
  // mousedown sem tirar o foco do campo: evita o blur salvar o rascunho antigo (ou avisar
  // "não entendido" de um texto que o botão vai substituir).
  const manterFoco = (e) => e.preventDefault();

  let dica = null;
  if (status === "salvando") {
    dica = (
      <span className="inline-flex items-center gap-1 text-ink-3">
        <MaterialIcon icon="progress_activity" size={14} className="animate-spin" aria-hidden="true" />
        salvando
      </span>
    );
  } else if (status === "salvo") {
    dica = (
      <span className="inline-flex items-center gap-1 font-semibold text-ok-ink">
        <MaterialIcon icon="check" size={14} aria-hidden="true" />
        salvo
      </span>
    );
  } else if (status === "erro" || invalido) {
    dica = <span className="font-semibold text-err">{invalido ? "valor inválido" : "não salvou"}</span>;
  } else if (origem === "acrescimo") {
    dica = <span className="text-ink-3">sem frete: acréscimo do pedido de {dataPedidoBase || "outra data"}</span>;
  } else if (origem === "sugerido") {
    // Regra + último frete pago pela unidade (achado 26/09: a sugestão de R$ 250 era
    // aceita às cegas mesmo quando a unidade sempre pagou menos).
    dica = (
      <span className="flex flex-col gap-0.5 text-ink-3">
        <span>
          regra: {formatBRL(FRETE_MIN)} (mín. {formatBRL(FRETE_MIN)}, máx. {formatBRL(FRETE_MAX)})
        </span>
        {ultimoFrete && (
          <span>
            último desta unidade: {formatBRL(ultimoFrete.valor)} em {new Date(ultimoFrete.data).toLocaleDateString("pt-BR")}{" "}
            <button
              type="button"
              onMouseDown={manterFoco}
              onClick={() => usarValor(String(ultimoFrete.valor))}
              className="font-semibold text-brand-dark hover:underline"
            >
              Usar {formatBRL(ultimoFrete.valor)}
            </button>
          </span>
        )}
      </span>
    );
  } else if (semFrete || origem === "vazio") {
    dica = <span className="text-ink-3">sem frete</span>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1 sm:w-28 sm:flex-none">
          <span className="sr-only">Frete de {nomeUnidade}</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
            R$
          </span>
          <input
            data-frete-input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={texto}
            placeholder="0"
            onChange={(e) => onRascunho(order.id, e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={salvarSeMudou}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focarProximo(e.currentTarget);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onRascunho(order.id, undefined);
              }
            }}
            aria-invalid={invalido || undefined}
            className={`h-11 w-full rounded-xl border bg-white pl-9 pr-2 text-right text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/20 sm:h-10 sm:text-sm ${
              invalido || status === "erro"
                ? "border-err text-err"
                : origem === "sugerido" || origem === "acrescimo"
                ? "border-dashed border-ink-4 text-ink-2"
                : "border-surface-line text-ink focus:border-brand"
            }`}
          />
        </label>
        {semFrete || origem === "vazio" ? (
          <button
            type="button"
            onMouseDown={manterFoco}
            onClick={() => usarValor(String(sugestao))}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-xl px-2 text-xs font-semibold text-brand-dark hover:bg-brand-soft sm:min-h-10"
          >
            Usar R$ {sugestao}
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={manterFoco}
            onClick={() => usarValor("0")}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-xl px-2 text-xs font-semibold text-ink-2 hover:bg-surface sm:min-h-10"
            title="Acréscimo de outro pedido ou retirada na fábrica"
          >
            Sem frete
          </button>
        )}
      </div>
      <div className="min-h-4 text-xs leading-4" aria-live="polite">{dica}</div>
    </div>
  );
}
