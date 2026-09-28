import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { SystemSubscription } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { safeErrorMessage } from '@/lib/safeErrorMessage';
import {
  classifySubscription,
  isBlockingOverdue,
  msAteProximaMeiaNoiteBRT,
  SITUACAO,
} from '@/lib/subscriptionStatus';

const POLL_MS = 10 * 60 * 1000; // ~10min (P3 28/09/2026, achado 4)

/**
 * Checks if the current franchisee has an overdue system subscription.
 *
 * Smart caching:
 * - PAID + before next due date → staleTime 24h (no unnecessary checks)
 * - OVERDUE → staleTime 5min (check more often)
 * - "Ja paguei" button → triggers real-time ASAAS check via n8n
 *
 * Admin/manager roles are never blocked.
 * Missing subscription rows are treated as "ok" (not blocked).
 *
 * `isOverdue` x `isBlocked` (S5.3, carencia de 2 dias — subscriptionStatus.js):
 * - `isOverdue` = a mensalidade esta vencida (dia 1 de atraso em diante). Serve pro aviso
 *   em faixa vermelha (cartoes da Inicio), que NUNCA bloqueia.
 * - `isBlocked` = passou da carencia (3o dia de atraso). So esse trava o app (paywall
 *   de tela cheia). Usa `classifySubscription`, entao tambem enxerga PENDING com
 *   vencimento no passado (o ASAAS demora a virar o status pra OVERDUE).
 *
 * Atualizacao sem acao do usuario (P3 28/09/2026, achado 4): staleTime/refetchOnWindowFocus
 * do react-query so refazem a busca se o dado ja estiver "velho" pelo relogio deles — uma
 * franqueada que deixa a aba aberta minutos a fio (ou justo na virada do dia 2 pro dia 3 de
 * atraso) podia ficar olhando um estado desatualizado sem nenhum gatilho. Dois reforcos:
 * (1) useVisibilityPolling refaz a consulta a cada ~10min enquanto a aba esta visivel, e na
 * hora que ela volta a ficar visivel (com throttle de 60s, ja embutido no hook); (2) um timer
 * ate a proxima meia-noite em America/Sao_Paulo forca um re-render bem na virada do dia, pra
 * diasAtraso/isBlocked nao ficarem 1 dia atrasados esperando o proximo poll.
 */
export function useSubscriptionStatus() {
  const { user, selectedFranchise } = useAuth();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [, forceTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const role = user?.role;
  const franchiseId = selectedFranchise?.evolution_instance_id;
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const podeVerificar = !!franchiseId && !isAdminOrManager;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription-status', franchiseId],
    queryFn: async () => {
      if (!franchiseId) return null;
      const rows = await SystemSubscription.filter(
        { franchise_id: franchiseId },
        null,
        1
      );
      return rows[0] || null;
    },
    enabled: podeVerificar,
    staleTime: (query) => getStaleTime(query.state.data),
    refetchOnWindowFocus: true,
  });

  // Poll de fundo (~10min) enquanto a aba esta visivel + refetch ao voltar pra ela —
  // useVisibilityPolling ja pausa quando a aba fica escondida e trata visibilitychange.
  useVisibilityPolling(
    () => queryClient.invalidateQueries({ queryKey: ['subscription-status', franchiseId] }),
    POLL_MS,
    podeVerificar
  );

  // Timer ate a proxima meia-noite BRT: forca um re-render (que recalcula
  // classifySubscription com a hora atual) exatamente na virada do dia.
  useEffect(() => {
    if (!podeVerificar) return undefined;
    let timer;
    const agendar = () => {
      const ms = msAteProximaMeiaNoiteBRT();
      timer = setTimeout(() => {
        forceTick((t) => t + 1);
        agendar();
      }, ms + 1000); // +1s de folga pro instante virar de fato
    };
    agendar();
    return () => clearTimeout(timer);
  }, [podeVerificar]);

  // Refs pra checkPaymentNow ler o estado MAIS RECENTE sem precisar recriar o callback a
  // cada mudanca de subscription (evita recriar a funcao a toda atualizacao do react-query).
  const subscriptionRef = useRef(subscription);
  subscriptionRef.current = subscription;
  const franchiseIdRef = useRef(franchiseId);
  franchiseIdRef.current = franchiseId;

  // Real-time ASAAS check via n8n webhook (triggered by "Ja paguei" button).
  // S5.4: da feedback por toast em vez de ficar mudo.
  const checkPaymentNow = useCallback(async () => {
    if (!franchiseId || isChecking) return;

    // P3 28/09/2026, achado 7: captura a UNIDADE e a FATURA especifica no momento do
    // clique (antes de qualquer await) — se a franqueada trocar de unidade enquanto isso
    // roda (3s de espera + reconsulta), o toast final nao pode falar da unidade errada.
    const franchiseIdNoClique = franchiseId;
    const faturaIdNoClique = subscriptionRef.current?.current_payment_id ?? null;

    setIsChecking(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke('asaas-billing', {
        body: { action: 'check-payment', franchise_id: franchiseIdNoClique },
      });

      // P3 achado 8: o { error } do invoke era ignorado — uma falha de rede/edge virava
      // "ainda nao identificamos seu pagamento" (fala do PAGAMENTO quando o problema era
      // a checagem em si). Trata o erro e sai, sem afirmar nada sobre o pagamento.
      if (invokeError) {
        if (mountedRef.current && franchiseIdRef.current === franchiseIdNoClique) {
          toast.error(safeErrorMessage(invokeError, 'Não consegui verificar agora. Tente de novo em instantes.'));
        }
        return;
      }

      // Espera o n8n atualizar o Supabase, depois reconsulta.
      await new Promise((r) => setTimeout(r, 3000));
      if (!mountedRef.current) return;
      await queryClient.invalidateQueries({ queryKey: ['subscription-status', franchiseIdNoClique] });
      if (!mountedRef.current) return;

      // O invalidate so agenda o refetch (async, nao espera aqui) — reler direto do
      // banco pra decidir o toast agora, sem depender de quando o react-query atualiza.
      const rows = await SystemSubscription.filter({ franchise_id: franchiseIdNoClique }, null, 1);
      const fresh = rows[0] || null;
      const freshClass = classifySubscription(fresh);

      // A unidade selecionada mudou enquanto isso rodava: descarta o toast (seria sobre a
      // unidade errada) em vez de arriscar afirmar algo sobre o pagamento de outra unidade.
      if (!mountedRef.current || franchiseIdRef.current !== franchiseIdNoClique) return;

      const pagou = freshClass.situacao === SITUACAO.PAGO;
      // A fatura que ela tentou pagar nao e mais a "current" da linha (o ASAAS rolou pro
      // proximo ciclo) mas a nova cobranca continua em aberto — distingue de "nada aconteceu".
      const faturaRolou = faturaIdNoClique != null && fresh?.current_payment_id !== faturaIdNoClique;

      if (pagou) {
        toast.success('Pagamento confirmado!');
      } else if (faturaRolou) {
        // Troca de fatura nao prova que a anterior foi paga: so informa, sem afirmar pagamento.
        toast('Sua cobrança foi atualizada. Confira abaixo o que está em aberto.');
      } else {
        toast.error(
          'Ainda não identificamos seu pagamento. Se você já pagou, aguarde alguns minutos ou fale com a Equipe Digital Maxi.'
        );
      }
    } catch (err) {
      if (mountedRef.current && franchiseIdRef.current === franchiseIdNoClique) {
        toast.error(safeErrorMessage(err, 'Não foi possível verificar agora. Tente de novo em instantes.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [franchiseId, isChecking, queryClient]);

  // Admin/manager: never blocked
  if (isAdminOrManager) {
    return { isOverdue: false, isBlocked: false, diasAtraso: null, isLoading: false, subscription: null, checkPaymentNow, isChecking };
  }

  // No subscription row = not blocked
  if (!subscription) {
    return { isOverdue: false, isBlocked: false, diasAtraso: null, isLoading, subscription: null, checkPaymentNow, isChecking };
  }

  const classification = classifySubscription(subscription);
  const isOverdue = classification.situacao === SITUACAO.VENCIDO;
  const isBlocked = isBlockingOverdue(classification);

  return {
    isOverdue,
    isBlocked,
    diasAtraso: classification.diasAtraso,
    isLoading,
    subscription,
    checkPaymentNow,
    isChecking,
  };
}

/**
 * Cobrança QUITADA e ainda dentro do ciclo = cache 24h (não há o que checar).
 * Qualquer coisa em aberto (PENDING/OVERDUE) = 5min.
 *
 * 🔴 Antes o ramo de 24h valia para QUALQUER status desde que o vencimento fosse
 * futuro — então uma cobrança PENDENTE ficava até 24h em cache e uma aba aberta
 * continuava exibindo o QR antigo depois que a edge já tinha gerado outro. É a
 * mesma familia do incidente de 01/09/2026 (QR de fatura paga): QR velho na tela
 * faz o app do banco recusar o pagamento.
 */
const PAID_STATUSES = new Set(['PAID', 'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

function getStaleTime(subscription) {
  const CURTO = 5 * 60 * 1000;
  if (!subscription) return CURTO;
  if (!PAID_STATUSES.has(subscription.current_payment_status)) return CURTO;

  const dueDate = subscription.current_payment_due_date;
  if (dueDate) {
    const due = new Date(dueDate);
    if (due > new Date()) return 24 * 60 * 60 * 1000; // 24h cache
  }
  return CURTO;
}
