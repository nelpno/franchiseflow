// Faixa fina (36 px) de barrinhas, 1 por dia do mês, para dentro do cartão de faturamento
// (Hoje e Ficha). Sem eixo, sem número, sem legenda: o detalhe (FaturamentoDiaSheet) explica.
//   <FaixaDias dias={montarDias(dados)} mes={dados.mes} />
// Tom: dia igual ou acima do mesmo dia da semana 4 semanas antes (dia − 28) = marca;
// abaixo = neutro claro; dia futuro = traço vazio.
// Quem clica é o cartão em volta (K2); a faixa é só imagem com aria-label descritivo.
import { ariaFaixa, escalaMax } from "@/lib/faturamentoDia";

const COR = {
  acima: "bg-brand",
  abaixo: "bg-ink-4",
  futuro: "bg-surface-line",
};

export default function FaixaDias({ dias, mes, className = "" }) {
  if (!dias?.length) return null;
  const max = escalaMax(dias.filter((d) => !d.futuro).map((d) => ({ rev: d.rev, ant: null })));
  return (
    <div role="img" aria-label={ariaFaixa(dias, mes)} className={`flex h-9 items-end gap-[2px] ${className}`}>
      {dias.map((d) => {
        const alt = d.futuro || !d.rev ? 0 : Math.max(8, Math.round((d.rev / max) * 100));
        return (
          <span
            key={d.dia}
            aria-hidden="true"
            className={`min-w-0 flex-1 rounded-[2px] ${d.futuro ? COR.futuro : !d.rev ? COR.abaixo : COR[d.tom] || COR.acima}`}
            style={{ height: alt ? `${alt}%` : "2px" }}
          />
        );
      })}
    </div>
  );
}
