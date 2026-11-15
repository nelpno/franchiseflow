// Um indicador do padrão K6 (número grande), usado na grade K9 do Bloco 1. Não é
// exclusivo do Progresso do CS, mas nasceu aqui — se outra tela precisar, promover
// para components/shared.
//
//   <IndicadorCard rotulo="Conversas registradas" valor={32} comparacao="contra 23 na semana anterior" />
import { NUMERO_GRANDE, ROTULO, COMPARACAO } from "@/components/shared/adminUi";

export default function IndicadorCard({ rotulo, valor, comparacao, destaque = false, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-surface-line bg-white p-4 sm:p-5 ${destaque ? "col-span-2 md:col-span-1" : ""} ${className}`}
    >
      <p className={ROTULO}>{rotulo}</p>
      <p className={NUMERO_GRANDE}>{valor}</p>
      {comparacao && <p className={COMPARACAO}>{comparacao}</p>}
    </div>
  );
}
