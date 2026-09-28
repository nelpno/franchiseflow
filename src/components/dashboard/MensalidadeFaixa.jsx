import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { faixaMensalidade } from "@/lib/pagamentos";

// S11.1 (28/09/2026): faixa na Início de 3 dias antes até o dia do vencimento, levando a
// Mais › Pagamentos. Só com a chave ui_v2; sem ela a Início fica como sempre.
export default function MensalidadeFaixa({ subscription }) {
  const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
  if (!uiV2) return null;
  const faixa = faixaMensalidade(subscription);
  if (!faixa) return null;
  return (
    <Link
      to="/Pagamentos"
      className="mb-4 flex min-h-[44px] items-center gap-3 rounded-xl bg-warn-soft px-4 py-3 touch-manipulation active:scale-[0.99]"
    >
      <MaterialIcon icon="schedule" size={20} className="shrink-0 text-warn" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm text-ink">{faixa.texto}</span>
      <span className="shrink-0 text-sm font-semibold text-brand">Pagar</span>
    </Link>
  );
}
