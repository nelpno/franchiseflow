import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { SystemSubscription } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { classifySubscription, isBlockingOverdue, SITUACAO } from '@/lib/subscriptionStatus';

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
 */
export function useSubscriptionStatus() {
  const { user, selectedFranchise } = useAuth();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const role = user?.role;
  const franchiseId = selectedFranchise?.evolution_instance_id;
  const isAdminOrManager = role === 'admin' || role === 'manager';

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
    enabled: !!franchiseId && !isAdminOrManager,
    staleTime: (query) => getStaleTime(query.state.data),
    refetchOnWindowFocus: true,
  });

  // Real-time ASAAS check via n8n webhook (triggered by "Ja paguei" button).
  // S5.4: da feedback por toast em vez de ficar mudo — antes o botao so reinvalidava o
  // cache e sumia, e quem clicava "Ja paguei" sem o pagamento ter entrado ainda achava
  // que o app travou ou que o clique nao fez nada.
  const checkPaymentNow = useCallback(async () => {
    if (!franchiseId || isChecking) return;
    setIsChecking(true);
    try {
      await supabase.functions.invoke('asaas-billing', {
        body: { action: 'check-payment', franchise_id: franchiseId },
      });
      // Wait a moment for n8n to update Supabase, then refetch
      await new Promise(r => setTimeout(r, 3000));
      if (!mountedRef.current) return;
      await queryClient.invalidateQueries({ queryKey: ['subscription-status', franchiseId] });
      if (!mountedRef.current) return;

      // O invalidate so agenda o refetch (async, nao espera aqui) — reler direto do
      // banco pra decidir o toast agora, sem depender de quando o react-query atualiza.
      const rows = await SystemSubscription.filter({ franchise_id: franchiseId }, null, 1);
      const fresh = rows[0] || null;
      const freshClass = classifySubscription(fresh);
      if (!mountedRef.current) return;
      if (freshClass.situacao === SITUACAO.PAGO) {
        toast.success('Pagamento confirmado!');
      } else {
        toast.error(
          'Ainda não identificamos seu pagamento. Se você já pagou, aguarde alguns minutos ou fale com a Equipe Digital Maxi.'
        );
      }
    } catch {
      if (mountedRef.current) {
        toast.error('Não foi possível verificar agora. Tente de novo em instantes.');
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
