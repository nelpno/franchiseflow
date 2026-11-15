import PostagensDoMesCard from "./PostagensDoMesCard";
import VerbaAlvoPanel from "./VerbaAlvoPanel";
import { FILTRO_LABELS } from "./verbaHelpers";
import { useAdminNetworkOverview } from "@/hooks/useAdminNetworkOverview";
import { mesesVerba } from "@/lib/networkOverview";

// Página "Painel" do admin em Marketing — duas tarefas em primeiro plano (postagens do mês
// e verba do mês-alvo). Composição fina: cada peça carrega os próprios dados.
export default function MarketingAdminHome({
  files,
  filesLoading,
  filesError,
  onRetryFiles,
  franchises,
  onPublicar,
  filtro,
  onClearFiltro,
}) {
  const filtroValido = filtro && FILTRO_LABELS[filtro] ? filtro : null;
  // O mesmo hook que a VerbaAlvoPanel usa (react-query cacheia por chave: não duplica a
  // consulta) — o mês vem do banco, nunca do relógio do aparelho (achado "alto" 26/09:
  // "Postagens do mês" ficava verde por causa de setembro com outubro sem nada publicado).
  const { overview } = useAdminNetworkOverview();
  const meses = mesesVerba(overview);

  return (
    <div className="space-y-6">
      {!filtroValido && (
        <PostagensDoMesCard
          files={files}
          onPublicar={onPublicar}
          loading={filesLoading}
          error={filesError}
          onRetry={onRetryFiles}
          mesAtual={meses?.mes}
          mesAlvo={meses?.alvo}
          janela={!!meses?.janela}
        />
      )}
      <VerbaAlvoPanel franchises={franchises} filtro={filtroValido} onClearFiltro={onClearFiltro} />
    </div>
  );
}
