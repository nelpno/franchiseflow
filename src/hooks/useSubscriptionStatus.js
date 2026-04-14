import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import { SystemSubscription } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';

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

  // Real-time ASAAS check via n8n webhook (triggered by "Ja paguei" button)
  const checkPaymentNow = useCallback(async () => {
    if (!franchiseId || isChecking) return;
    setIsChecking(true);
    try {
      await supabase.functions.invoke('asaas-billing', {
        body: { action: 'check-payment', franchise_id: franchiseId },
      });
      // Wait a moment for n8n to update Supabase, then refetch
      await new Promise(r => setTimeout(r, 3000));
      if (mountedRef.current) {
        await queryClient.invalidateQueries({ queryKey: ['subscription-status', franchiseId] });
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [franchiseId, isChecking, queryClient]);

  // Admin/manager: never blocked
  if (isAdminOrManager) {
    return { isOverdue: false, isLoading: false, subscription: null, checkPaymentNow, isChecking };
  }

  // No subscription row = not blocked
  if (!subscription) {
    return { isOverdue: false, isLoading, subscription: null, checkPaymentNow, isChecking };
  }

  const isOverdue = subscription.current_payment_status === 'OVERDUE';

  return {
    isOverdue,
    isLoading,
    subscription,
    checkPaymentNow,
    isChecking,
  };
}

/** PAID + before next due date = cache 24h. OVERDUE = cache 5min. */
function getStaleTime(subscription) {
  if (!subscription) return 5 * 60 * 1000;
  if (subscription.current_payment_status === 'OVERDUE') return 5 * 60 * 1000;

  const dueDate = subscription.current_payment_due_date;
  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (due > now) return 24 * 60 * 60 * 1000; // 24h cache
  }
  return 5 * 60 * 1000;
}
