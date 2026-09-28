import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FinancialObligationsCard from "@/components/dashboard/FinancialObligationsCard";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureFlagState } from "@/hooks/useFeatureFlag";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { MarketingPayment, getMarketingAttribution, getFranchiseFunnelStats } from "@/entities/all";
import { classifySubscription, SITUACAO } from "@/lib/subscriptionStatus";
import { resumoEquipeDigital, mesAtualBRT } from "@/lib/pagamentos";

// Mesmo Pix da verba do cartão de Marketing (S5.1, decisão 27/09).
const PIX_VERBA_CNPJ = "00.494.317/0001-21";

// S11.1 (28/09/2026) — Mais › Pagamentos. Só existe com a chave ui_v2 ligada; com ela
// desligada (ou sem unidade) volta para a Início, que continua mostrando o cartão de sempre.
export default function Pagamentos() {
  const { user, selectedFranchise } = useAuth();
  const { value: uiV2, resolved: flagResolvida } = useFeatureFlagState(FEATURE_KEYS.UI_V2);
  const { subscription } = useSubscriptionStatus();
  const evoId = selectedFranchise?.evolution_instance_id;
  const isFranqueado = user?.role === "franchisee";

  const [marketingPayment, setMarketingPayment] = useState(null);
  const [resumo, setResumo] = useState(null); // null = carregando; [] = sem números
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const mes = mesAtualBRT();
  const mesNome = format(new Date(`${mes.inicio}T12:00:00`), "MMMM", { locale: ptBR });

  useEffect(() => {
    if (!evoId || !uiV2) return undefined;
    const controller = new AbortController();
    setResumo(null);
    Promise.allSettled([
      MarketingPayment.filter({ franchise_id: evoId }, "-reference_month", 1, { signal: controller.signal }),
      getMarketingAttribution(mes.chave, evoId, { signal: controller.signal }),
      getFranchiseFunnelStats(evoId, mes.inicio, mes.ate, { signal: controller.signal }),
    ]).then(([mp, attr, funil]) => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setMarketingPayment(mp.status === "fulfilled" ? mp.value?.[0] || null : null);
      setResumo(resumoEquipeDigital({
        atribuicao: attr.status === "fulfilled" ? attr.value?.[0] || null : null,
        funil: funil.status === "fulfilled" ? funil.value : null,
      }));
    });
    return () => controller.abort();
  }, [evoId, uiV2, mes.chave, mes.inicio, mes.ate]);

  // Só decide com a unidade já carregada: abrindo o endereço direto, a unidade chega um instante
  // depois e, sem ela, a chave vale "resolvida e desligada" — redirecionava todo mundo (Onda 5).
  if (!isFranqueado || (evoId && flagResolvida && !uiV2)) return <Navigate to="/Dashboard" replace />;
  if (!uiV2) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!evoId) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <p className="text-sm text-ink-2">Escolha a unidade no topo da tela para ver os pagamentos.</p>
      </div>
    );
  }

  const situacao = classifySubscription(subscription).situacao;
  const mensalidadePaga = situacao === SITUACAO.PAGO;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4 bg-surface">
      <div>
        <h1 className="font-plus-jakarta text-2xl font-bold text-ink">Pagamentos</h1>
        <p className="text-sm text-ink-2 mt-1">A mensalidade da Equipe Digital Maxi e a verba do anúncio.</p>
      </div>

      {mensalidadePaga && (
        <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3">
          <MaterialIcon icon="check_circle" size={20} className="text-ok" aria-hidden="true" />
          <p className="text-sm text-ok-ink font-medium">Mensalidade em dia.</p>
        </div>
      )}

      <FinancialObligationsCard marketingPayment={marketingPayment} />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-plus-jakarta text-base font-bold text-ink">
            O que sua Equipe Digital fez em {mesNome}
          </h2>
          {resumo === null ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : resumo.length === 0 ? (
            <p className="text-sm text-ink-2">Os números do mês aparecem aqui assim que o anúncio e o robô começarem a trabalhar.</p>
          ) : (
            <ul className="space-y-2">
              {resumo.map((l) => (
                <li key={l.chave} className="flex items-start gap-2 text-sm text-ink">
                  <MaterialIcon icon={l.icone} size={20} className="text-brand shrink-0" aria-hidden="true" />
                  <span>{l.texto}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-3">Também fazem parte da mensalidade as artes do mês, o robô vendedor e este app.</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-1">
          <h2 className="font-plus-jakarta text-base font-bold text-ink">Verba do anúncio</h2>
          <p className="text-sm text-ink-2">
            Mínimo de R$ 200 por mês, no Pix CNPJ {PIX_VERBA_CNPJ}. Depois é só anexar o comprovante em Marketing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
