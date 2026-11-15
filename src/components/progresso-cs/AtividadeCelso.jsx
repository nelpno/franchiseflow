// Bloco 1 — "O que o Celso fez" (get_cs_progresso().atividade + .por_semana).
import SectionTitle from "@/components/shared/SectionTitle";
import { CARTAO } from "@/components/shared/adminUi";
import IndicadorCard from "./IndicadorCard";
import MiniSerieSemana from "./MiniSerieSemana";
import { serieSemanal, textoMedianaContato } from "@/lib/csProgresso";

export default function AtividadeCelso({ atividade, porSemana }) {
  const a = atividade || {};
  const combinadosVencidos = Number(a.combinados_vencidos) || 0;

  return (
    <section aria-labelledby="bloco-atividade" className="space-y-3">
      <SectionTitle id="bloco-atividade" titulo="O que o Celso fez" ajuda="No período escolhido" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <IndicadorCard rotulo="Conversas registradas" valor={a.conversas ?? 0} destaque />
        <IndicadorCard rotulo="Unidades faladas" valor={a.unidades_faladas ?? 0} />
        <IndicadorCard rotulo="Reuniões gravadas" valor={a.reunioes_feitas ?? 0} />
        <IndicadorCard rotulo="Dias com registro" valor={a.dias_com_registro ?? 0} />
      </div>

      <div className={CARTAO}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <p className="text-ink-2">
            <span className="font-semibold text-ink">{a.combinados_criados ?? 0}</span> combinados criados
          </p>
          <p className={combinadosVencidos > 0 ? "text-err" : "text-ink-2"}>
            <span className="font-semibold">{combinadosVencidos}</span> combinados vencidos
          </p>
          <p className="text-ink-2">{textoMedianaContato(a.mediana_dias_ate_1o_contato)}</p>
        </div>
      </div>

      <div className={`${CARTAO} grid gap-4 sm:grid-cols-3`}>
        <MiniSerieSemana titulo="Conversas por semana" pontos={serieSemanal(porSemana, "conversas")} />
        <MiniSerieSemana titulo="Unidades tocadas por semana" pontos={serieSemanal(porSemana, "unidades")} />
        <MiniSerieSemana titulo="Reuniões por semana" pontos={serieSemanal(porSemana, "reunioes")} />
      </div>
    </section>
  );
}
