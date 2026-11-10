// Aviso discreto "Novo: Cardápio digital" na Início da franqueada (10/11/2026, rede aberta). Só para quem ainda não ligou
// nenhuma vez (cardapio_estado.ja_ligou) e com a chave da unidade ligada. Some ao ligar ou ao dispensar (o "x" fica guardado
// neste aparelho). Só para quem tem papel franchisee. Nada de pop-up: é uma linha no alto, com o link para a página.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { LINK_ACAO } from "@/components/shared/adminUi";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureFlagState } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { getCardapioEstado } from "@/entities/all";
import { registrarEvento } from "@/lib/telemetria";

const chaveDispensa = (evo) => `maxi.cardapio_novidade_dispensada.${evo}`;
function lerDispensa(evo) {
  try { return !!evo && localStorage.getItem(chaveDispensa(evo)) === "1"; } catch { return false; }
}

export default function InicioNovidadeCardapio({ evoId }) {
  // só a franqueada: admin/gerente/CS vendo a Início de uma unidade não contam na telemetria nem gravam o "x" (code review 10/11)
  const { user } = useAuth();
  const franqueada = user?.role === "franchisee";
  const { value: chave } = useFeatureFlagState(FEATURE_KEYS.CARDAPIO_DIGITAL, evoId || undefined);
  const [dispensado, setDispensado] = useState(() => lerDispensa(evoId));
  useEffect(() => { setDispensado(lerDispensa(evoId)); }, [evoId]);
  const q = useQuery({
    queryKey: ["cardapio-estado", evoId],
    queryFn: ({ signal }) => getCardapioEstado(evoId, { signal }),
    enabled: franqueada && !!evoId && chave && !dispensado,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const mostra = franqueada && !!evoId && chave && !dispensado && !!q.data && !q.data.ja_ligou && !q.data.ativo && q.data.chave_ligada !== false;
  const visto = useRef(null);
  useEffect(() => {
    if (mostra && visto.current !== evoId) {
      visto.current = evoId;
      registrarEvento("cardapio_novidade_vista", { semClarity: true });
    }
  }, [mostra, evoId]);
  if (!mostra) return null;

  const dispensar = () => {
    try { localStorage.setItem(chaveDispensa(evoId), "1"); } catch { /* sem armazenamento: some só nesta visita */ }
    setDispensado(true);
    registrarEvento("cardapio_novidade_dispensada", { semClarity: true });
  };
  return (
    <aside className="mb-4 flex items-center gap-3 rounded-2xl border border-surface-line bg-white py-2 pl-4 pr-2" aria-label="Novidade">
      <MaterialIcon icon="restaurant_menu" size={20} className="shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-ink">
        <strong className="font-semibold">Novo: Cardápio digital.</strong>{" "}
        <span className="text-ink-2">Seu cliente monta o pedido sozinho e ele chega pronto no seu WhatsApp.</span>{" "}
        <Link to="/CardapioDigital" className={LINK_ACAO} onClick={() => registrarEvento("cardapio_novidade_aberta", { semClarity: true })}>
          Conhecer →
        </Link>
      </p>
      <button type="button" onClick={dispensar} aria-label="Dispensar o aviso do Cardápio digital"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-3 hover:bg-surface">
        <MaterialIcon icon="close" size={20} aria-hidden="true" />
      </button>
    </aside>
  );
}
