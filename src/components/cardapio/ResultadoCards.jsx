// Bloco 3: resultado do cardápio (ESPEC § 4.4) — visitas → pedidos enviados → chegaram no WhatsApp → viraram venda.
// Fonte: RPC cardapio_resultado (medidor_sessoes sem teste, cardapio_eventos, conversation_messages, sales em 72 h).
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/shared/ErrorState";
import { CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, COMPARACAO, H2, LINK_ACAO, NUMERO_GRANDE, ROTULO } from "@/components/shared/adminUi";
import { formatBRLInteger } from "@/lib/formatters";
import { nomeCurtoProduto } from "@/lib/cardapioDigital";

export const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
];

function Indicador({ rotulo, valor, linha, acao, className = "" }) {
  return (
    <div className={`${CARTAO} ${className}`}>
      <p className={`${ROTULO} whitespace-nowrap`}>{rotulo}</p>
      <p className={NUMERO_GRANDE}>{valor}</p>
      {linha && <p className={COMPARACAO}>{linha}</p>}
      {acao}
    </div>
  );
}

export default function ResultadoCards({ dias, onDias, resultado, carregando, erro, onTentar }) {
  const r = resultado;
  return (
    <section className="space-y-3" aria-labelledby="cardapio-resultado">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cardapio-resultado" className={H2}>Resultado</h2>
        <div className="flex gap-2" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.dias} type="button" aria-pressed={dias === p.dias} onClick={() => onDias(p.dias)}
              className={`${CHIP} ${dias === p.dias ? CHIP_ATIVO : CHIP_INATIVO}`}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl motion-reduce:animate-none" />)}
        </div>
      ) : erro ? (
        <ErrorState cartao texto="Confira a internet e tente de novo." onTentarNovamente={onTentar} />
      ) : !r || !r.visitas ? (
        <div className={CARTAO}>
          <p className="text-sm text-ink-2">Ainda sem visitas. Copie o link e coloque na bio.</p>
        </div>
      ) : (
        <>
          {/* Viraram venda em cima; "Chegaram no seu WhatsApp" é o número principal do caminho; quem abriu o WhatsApp e não
              mandou vira uma linha (dois números de pedido lado a lado confundiam, revisão de 10/11/2026) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Indicador rotulo="Viraram venda"
              valor={r.vendas ? `${r.vendas} · ${formatBRLInteger(r.valor)}` : "0"}
              linha={r.vendas ? "em até 3 dias do pedido" : "Nenhuma venda ainda"}
              acao={r.vendas ? <Link to="/Vendas" className={LINK_ACAO}>Ver vendas →</Link> : null} />
            <Indicador rotulo="Chegaram no seu WhatsApp" valor={r.chegaram}
              linha={r.enviados ? `${r.enviados} ${r.enviados === 1 ? "abriu" : "abriram"} o WhatsApp com o pedido; ${r.chegaram} ${r.chegaram === 1 ? "mandou" : "mandaram"}` : null} />
            <Indicador rotulo="Visitas" valor={r.visitas}
              linha={r.instagram ? `${r.instagram} ${r.instagram === 1 ? "veio" : "vieram"} do Instagram` : "nenhuma do Instagram"} />
          </div>
          <div className={`${CARTAO} space-y-2 text-sm text-ink-2`}>
            {r.mais_adicionados?.length > 0 && (
              <p><span className="font-semibold text-ink">Mais escolhidos no cardápio:</span>{" "}
                {r.mais_adicionados.map((x) => `${nomeCurtoProduto(x.produto)} (${x.n})`).join(", ")}</p>
            )}
            {r.sugeriu > 0 && (
              <p><span className="font-semibold text-ink">Sugestões aceitas:</span> {r.aceitou} de {r.sugeriu} mostradas</p>
            )}
            {r.vendas > 0 && (
              <p>Quem comprou pelo cardápio já tinha conversado com o robô e nunca comprado:{" "}
                <span className="font-semibold text-ink">{r.compradores_novos} de {r.vendas}</span></p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
