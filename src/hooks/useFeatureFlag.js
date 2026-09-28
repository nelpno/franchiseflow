import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeatureFlags } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import { isFeatureOn } from '@/lib/featureFlags';

/**
 * Estado bruto da query da chave (S9 P3, 28/09/2026, 2ª passada). Quem só quer o
 * booleano usa `useFeatureFlag` abaixo.
 *
 * `isLoading` aqui NUNCA significa "chave desconhecida" (carregando pela 1ª vez,
 * erro, ou unidade ainda sem resposta) — nesse caso o chamador deve tratar como
 * DESLIGADA na hora, sem esperar nada (é o que `value` já faz, default false). Só
 * vale `true` quando o CACHE do React Query já tinha essa queryKey confirmada
 * LIGADA antes (`queryClient.getQueryData`) e agora um refetch está em andamento —
 * o único caso em que "esperar um instante em vez de mostrar o velho" faz sentido,
 * porque já se sabe que o velho está errado. Unidade nunca consultada, resposta
 * anterior OFF, ou erro: `isLoading` fica sempre false, e quem usa isso (Layout)
 * mostra o menu de sempre na mesma hora — a 1ª passada da P3 tinha isso invertido
 * (qualquer "carregando" virava esqueleto, inclusive pra quem nunca vai ligar,
 * atrasando o menu de quem está OFF, que é a esmagadora maioria da rede).
 *
 *   const { value, isLoading } = useFeatureFlagState(FEATURE_KEYS.UI_V2);
 */
export function useFeatureFlagState(key) {
  const { selectedFranchise } = useAuth();
  const franchiseId = selectedFranchise?.evolution_instance_id;
  const queryClient = useQueryClient();
  const queryKey = ['feature-flags', franchiseId];

  const { data, isError, isFetching } = useQuery({
    queryKey,
    queryFn: ({ signal }) => getFeatureFlags(franchiseId, { signal }),
    enabled: !!franchiseId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // aba aberta o dia todo também obedece ao desligar
    refetchOnWindowFocus: 'always',
    retry: 1,
  });

  // `resolved` (S11.1): a resposta já chegou (ou não vai chegar). Tela que REDIRECIONA com a
  // chave desligada precisa esperar isto — `isLoading` acima só cobre o refetch de quem já
  // estava ligado (o menu não pode esperar), e no primeiro load a chave vale false.
  if (!franchiseId || isError) return { value: false, isLoading: false, resolved: true };

  const value = isFeatureOn(data, key);
  // Lido do cache, não do `data` deste render: cobre exatamente o refetch em cima
  // de uma resposta anterior já ON — quando isso é verdade, `value` acima já é
  // true (React Query mantém o dado anterior visível durante o refetch), então
  // `isLoading` aqui não é o que faz a tela trocar de ON pra esqueleto; é só o
  // sinalizador pra quem quiser evitar reafirmar/reconstruir a UI à toa.
  const eraLigadaAntes = isFeatureOn(queryClient.getQueryData(queryKey), key);
  const isLoading = isFetching && eraLigadaAntes && !value;

  return { value, isLoading, resolved: data !== undefined };
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
