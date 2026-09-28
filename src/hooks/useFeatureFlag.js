import { useQuery } from '@tanstack/react-query';
import { getFeatureFlags } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { isFeatureOn } from '@/lib/featureFlags';

/**
 * Estado bruto da query da chave (S9 P3, 28/09/2026): separa "carregando" de
 * "desligada/erro" — quem só quer o booleano usa `useFeatureFlag` abaixo; quem
 * precisa não piscar menu (reservar espaço enquanto carrega, em vez de mostrar o
 * antigo e trocar) usa este. `isLoading` aqui é o do React Query PARA A QUERY KEY
 * ATUAL (`['feature-flags', franchiseId]`): como a key muda com a franquia, trocar
 * de unidade sempre entra num estado de carregamento novo — nunca reaproveita o
 * `data` da franquia anterior (React Query não usa `keepPreviousData` aqui).
 *
 *   const { value, isLoading } = useFeatureFlagState(FEATURE_KEYS.UI_V2);
 */
export function useFeatureFlagState(key) {
  const { selectedFranchise } = useAuth();
  const franchiseId = selectedFranchise?.evolution_instance_id;

  const { data, isError, isLoading } = useQuery({
    queryKey: ['feature-flags', franchiseId],
    queryFn: ({ signal }) => getFeatureFlags(franchiseId, { signal }),
    enabled: !!franchiseId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // aba aberta o dia todo também obedece ao desligar
    refetchOnWindowFocus: 'always',
    retry: 1,
  });

  if (!franchiseId) return { value: false, isLoading: false };
  // Com erro o React Query mantém o dado ANTERIOR (poderia seguir ligada): erro = desligada,
  // e não é "carregando" (já temos uma resposta, ainda que ruim) — trava o flicker de
  // ficar reservando espaço pra sempre se a rede cair.
  if (isError) return { value: false, isLoading: false };
  return { value: isFeatureOn(data, key), isLoading };
}

/**
 * Chave liga/desliga da unidade selecionada (S1.2). Enquanto carrega, com erro ou sem
 * unidade = DESLIGADA (comportamento atual). Cache de 5 min: desligar em emergência vale
 * no próximo carregamento/foco da janela.
 *
 *   const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
 */
export function useFeatureFlag(key) {
  return useFeatureFlagState(key).value;
}
