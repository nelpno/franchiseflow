import { useQuery } from '@tanstack/react-query';
import { getFeatureFlags } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { isFeatureOn } from '@/lib/featureFlags';

/**
 * Chave liga/desliga da unidade selecionada (S1.2). Enquanto carrega, com erro ou sem
 * unidade = DESLIGADA (comportamento atual). Cache de 5 min: desligar em emergência vale
 * no próximo carregamento/foco da janela.
 *
 *   const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
 */
export function useFeatureFlag(key) {
  const { selectedFranchise } = useAuth();
  const franchiseId = selectedFranchise?.evolution_instance_id;

  const { data, isError } = useQuery({
    queryKey: ['feature-flags', franchiseId],
    queryFn: ({ signal }) => getFeatureFlags(franchiseId, { signal }),
    enabled: !!franchiseId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // aba aberta o dia todo também obedece ao desligar
    refetchOnWindowFocus: 'always',
    retry: 1,
  });

  // Com erro o React Query mantém o dado ANTERIOR (poderia seguir ligada): erro = desligada.
  if (!franchiseId || isError) return false;
  return isFeatureOn(data, key);
}
