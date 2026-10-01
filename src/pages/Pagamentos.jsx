import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FinancialObligationsCard from "@/components/dashboard/FinancialObligationsCard";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureFlagState } from "@/hooks/useFeatureFlag";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { MarketingPayment } from "@/entities/all";
import { classifySubscription, SITUACAO } from "@/lib/subscriptionStatus";
import { createPageUrl } from "@/utils";
import { escolherMarketing, mesAlvoMarketing, INTERVALO_REVALIDAR_MS } from "@/lib/inicioMes";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

// Mesmo Pix da verba do cartão de Marketing (S5.1, decisão 27/09).
const PIX_VERBA_CNPJ = "00.494.317/0001-21";
const MARKETING_VAZIO = { evo: null, alvo: null, ok: false, lista: [] };

// S11.1 (28/09/2026) — Mais › Pagamentos. Só existe com a chave ui_v2 ligada; com ela
// desligada (ou sem unidade) volta para a Início, que continua mostrando o cartão de sempre.
export default function Pagamentos() {
  const { user, selectedFranchise } = useAuth();
  const { value: uiV2, resolved: flagResolvida } = useFeatureFlagState(FEATURE_KEYS.UI_V2);
  const { subscription } = useSubscriptionStatus();
  const evoId = selectedFranchise?.evolution_instance_id;
  const isFranqueado = user?.role === "franchisee";

  // Onda 7b: os 3 últimos pagamentos, com a unidade e o mês-alvo da leitura. O cartão usa o do
  // MÊS-ALVO (Brasília), como a Início nova: verba do mês seguinte já registrada não esconde a
  // do mês-alvo; carga de outra unidade/mês ou leitura falha esconde a linha (nunca "pendente"
  // falso). Revalida ao voltar para a aba e a cada 5 min (registro feito em outra aba, admin
  // confirmando); na revalidação, falha mantém o último dado bom.
  // O resumo do mês ("O que sua Equipe Digital fez") morava aqui; em 01/10/2026 foi para
  // Marketing (ResumoMesCard), onde as franqueadas procuravam. Aqui fica só o link.
  const [marketing, setMarketing] = useState(MARKETING_VAZIO);
  const [recarga, setRecarga] = useState(0);
  const mountedRef = useRef(true);
  const chaveRef = useRef(null);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const mesAlvo = mesAlvoMarketing();
  const alvoChave = format(mesAlvo, "yyyy-MM");

  const ativo = !!evoId && !!uiV2 && isFranqueado;
  useVisibilityPolling(() => setRecarga((n) => n + 1), INTERVALO_REVALIDAR_MS * 5, ativo);

  useEffect(() => {
    if (!ativo) {
      chaveRef.current = null;
      return undefined;
    }
    const controller = new AbortController();
    const chave = `${evoId}|${alvoChave}`;
    if (chaveRef.current !== chave) setMarketing(MARKETING_VAZIO);
    chaveRef.current = chave;
    MarketingPayment.filter({ franchise_id: evoId }, "-reference_month", 3, { signal: controller.signal })
      .then((lista) => ({ ok: true, lista: lista || [] }), () => ({ ok: false, lista: [] }))
      .then(({ ok, lista }) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        if (ok) setMarketing({ evo: evoId, alvo: alvoChave, ok: true, lista });
        else setMarketing((m) => (m.ok && m.evo === evoId && m.alvo === alvoChave ? m : { evo: evoId, alvo: alvoChave, ok: false, lista: [] }));
      });
    return () => controller.abort();
  }, [ativo, evoId, alvoChave, recarga]);

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
  const marketingPronto = marketing.ok && marketing.evo === evoId && marketing.alvo === alvoChave;
  const marketingPayment = marketingPronto ? escolherMarketing(marketing.lista, mesAlvo) : null;

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

      <FinancialObligationsCard
        marketingPayment={marketingPayment}
        ocultarMarketing={!marketingPronto}
        mesAlvo={mesAlvo}
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-1">
          <h2 className="font-plus-jakarta text-base font-bold text-ink">Verba do anúncio</h2>
          <p className="text-sm text-ink-2">
            Mínimo de R$ 200 por mês, no Pix CNPJ {PIX_VERBA_CNPJ}. Depois é só anexar o comprovante em Marketing.
          </p>
          <Link
            to={createPageUrl("Marketing")}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
          >
            Ver o resumo do mês (anúncio e robô) em Marketing
            <MaterialIcon icon="chevron_right" size={18} aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
