import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { nomeMes } from "@/lib/adminFormat";

// "Postagens do mês" — reorganiza o que já existia (upload de materiais compartilhados,
// categoria posts/stories) num único cartão de primeiro plano: publicou ou não o mês
// CONFERIDO? Nos últimos 5 dias do mês (janela) o mês conferido passa a ser o mês-alvo — é o
// que a fila de verba já cobra, e não avisar sobre ele fazia a tarefa da semana sumir
// (achado "alto" 26/09: em 26/09 o cartão ficava verde por causa de setembro publicado,
// enquanto outubro não tinha nenhum material). `mesAtual`/`mesAlvo`/`janela` vêm do banco
// (mesesVerba(overview), passado pelo MarketingAdminHome) — nunca do relógio do aparelho.
// a lista de arquivos é a mesma lista que a aba de materiais usa (Marketing.jsx já carrega).
// `loading`/`error` vêm do carregamento de a lista de arquivos no Marketing.jsx: sem eles o cartão lia
// `files=[]` (estado inicial OU falha de rede) como "ninguém publicou nada ainda" e mandava
// o admin republicar o mês por engano.
export default function PostagensDoMesCard({
  files = [],
  onPublicar,
  loading = false,
  error = false,
  onRetry,
  mesAtual,
  mesAlvo,
  janela = false,
}) {
  const hoje = format(new Date(), "yyyy-MM");
  const mesCalendario = mesAtual || hoje;
  // Mês CONFERIDO: o mês-alvo só nos últimos 5 dias do mês (é o que resta publicar).
  const mesConferir = janela && mesAlvo ? mesAlvo : mesCalendario;

  const info = useMemo(() => {
    // Compartilhado = franchise_id null: é o que toda unidade vê (o protótipo fala das
    // "postagens do mês" no plural, não do material de uma unidade só). Só conta categoria de
    // POST/STORY — catálogo e material impresso não são "postagem" (achado Codex 26/09: o
    // cartão dava "publicado" quando só o catálogo tinha sido trocado no mês).
    const compartilhados = files.filter(
      (f) => !f.franchise_id && (f.category === "posts" || f.category === "stories")
    );
    const doMes = compartilhados.filter((f) => f.month === mesConferir);
    if (doMes.length > 0) return { publicado: true };

    // Mês mais recente com material publicado, antes do mês conferido — é o que a rede está vendo.
    const anteriores = compartilhados
      .filter((f) => f.month && f.month < mesConferir)
      .sort((a, b) => b.month.localeCompare(a.month));
    const ultimoMes = anteriores[0]?.month || null;
    const doUltimoMes = ultimoMes ? compartilhados.filter((f) => f.month === ultimoMes) : [];
    const publicadoEm = doUltimoMes.reduce((max, f) => {
      const d = f.created_at ? new Date(f.created_at) : null;
      return d && (!max || d > max) ? d : max;
    }, null);

    return { publicado: false, ultimoMes, publicadoEm };
  }, [files, mesConferir]);

  if (loading) {
    return <Skeleton aria-label="Carregando postagens do mês" className="h-24 rounded-2xl" />;
  }

  if (error) {
    return (
      <section
        aria-label="Postagens do mês"
        className="flex flex-col gap-3 rounded-2xl border border-surface-line bg-white p-5 sm:flex-row sm:items-center"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-3/10 text-ink-3">
          <MaterialIcon icon="cloud_off" size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">Não foi possível conferir as postagens</p>
          <p className="mt-0.5 text-sm text-ink-3">Tente de novo em alguns segundos.</p>
        </div>
        <Button variant="outline" className="min-h-10 shrink-0" onClick={onRetry}>
          <MaterialIcon icon="refresh" size={16} className="mr-1.5" />
          Tentar novamente
        </Button>
      </section>
    );
  }

  if (info.publicado) {
    return (
      <section
        aria-label="Postagens do mês"
        className="flex flex-col gap-3 rounded-2xl border border-surface-line bg-white p-5 sm:flex-row sm:items-center"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ok/10 text-ok-ink">
          <MaterialIcon icon="check_circle" size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">
            Postagens de {nomeMes(mesConferir)} já estão publicadas
          </p>
          <p className="mt-0.5 text-sm text-ink-3">
            O link do Drive com as artes de {nomeMes(mesConferir)} já está no ar; as unidades já estão vendo.
          </p>
        </div>
        <Button variant="outline" className="min-h-10 shrink-0" onClick={() => onPublicar?.(mesConferir)}>
          <MaterialIcon icon="add" size={16} className="mr-1.5" />
          Publicar mais
        </Button>
      </section>
    );
  }

  const publicadoEmTexto = info.publicadoEm
    ? format(info.publicadoEm, "dd/MM", { locale: ptBR })
    : null;

  return (
    <section
      aria-label="Postagens do mês"
      className="flex flex-col gap-4 rounded-2xl border border-warn/40 bg-warn-soft p-5 sm:flex-row sm:items-center"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-warn-ink">
        <MaterialIcon icon="image" size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">
          Postagens de {nomeMes(mesConferir)}: o link do Drive com as artes do mês ainda não foi publicado
        </p>
        <p className="mt-0.5 text-sm text-ink-2">
          {info.ultimoMes
            ? `As unidades estão vendo o link de ${nomeMes(info.ultimoMes)}${
                publicadoEmTexto ? ` (publicado em ${publicadoEmTexto})` : ""
              }. Publique até o dia 1º para elas postarem desde o começo do mês.`
            : "Nenhum link de Drive compartilhado foi publicado ainda."}
        </p>
      </div>
      <Button
        onClick={() => onPublicar?.(mesConferir)}
        className="min-h-11 shrink-0 bg-warn-ink text-white hover:bg-warn-ink/90"
      >
        <MaterialIcon icon="upload" size={16} className="mr-1.5" />
        Publicar link de {nomeMes(mesConferir)}
      </Button>
    </section>
  );
}
