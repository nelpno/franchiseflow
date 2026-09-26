// Título de seção fora de cartão (regras S1..S3 do padrão): h2 + ajuda na mesma linha,
// link de ação opcional à direita no desktop (B6).
//
//   <SectionTitle titulo="1. Para confirmar" ajuda="Pedidos que a unidade mandou e ninguém viu." />
//   <SectionTitle titulo="Mensalidades" ajuda="Situação de hoje" acao={<Link className={LINK_ACAO} …>Ver todas →</Link>} />
//
// `id` vai no h2 (para aria-labelledby da <section> de quem usa). Nunca caixa alta, nunca text-lg.
import { H2 } from "./adminUi";

export default function SectionTitle({ titulo, ajuda, acao, id, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className={H2}>
          {titulo}
        </h2>
        {ajuda && <p className="text-sm text-ink-3">{ajuda}</p>}
      </div>
      {acao && <div className="shrink-0 md:ml-auto">{acao}</div>}
    </div>
  );
}
