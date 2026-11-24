// Aba aberta antes de um deploy pede um pedaço do app (chunk) que não existe mais no servidor:
// "Failed to fetch dynamically imported module" / "Importing a module script failed".
// Remédio = recarregar a página uma vez (o index.html não tem cache e traz a versão nova).
// 23/11/2026: ~20 telas quebradas em 21-22/11 porque o PageErrorBoundary pegava o erro antes do
// ErrorBoundary de fora, o único que recarregava.

const CHAVE = 'versao_velha_recarga_em';
const INTERVALO_MS = 60_000; // no máximo 1 recarga por minuto: se a versão nova também falhar, não entra em laço
let recarregando = false;

/** true depois que a recarga foi pedida: a tela mostra "Atualizando o app" em vez do erro.
 * 24/11/2026: o aviso do Vite (vite:preloadError) já pede a recarga e o import volta vazio; o React
 * quebrava em "reading 'default'" e a tela de erro piscava antes de recarregar (14× em 2 dias). */
export function estaRecarregando() {
  return recarregando;
}

/** O erro é desta recarga? (o chunk sumido em si, ou o import que voltou vazio depois do aviso do Vite) */
export function ehErroDaRecarga(error) {
  if (ehErroDeVersaoVelha(error)) return true;
  return recarregando && /'default'|\.default/.test(String(error?.message || ''));
}

export function ehErroDeVersaoVelha(error) {
  const msg = String(error?.message || error || '');
  return error?.name === 'ChunkLoadError'
    || msg.includes('dynamically imported module')
    || msg.includes('Importing a module script failed')
    || msg.includes('Loading chunk')
    || msg.includes('Unable to preload CSS');
}

/** Recarrega se for erro de versão velha e não recarregou há pouco. Devolve true se recarregou. */
export function recarregarSeVersaoVelha(error) {
  if (!ehErroDeVersaoVelha(error)) return false;
  let ultima = 0;
  try { ultima = Number(sessionStorage.getItem(CHAVE) || 0); } catch { /* storage bloqueado */ }
  if (Date.now() - ultima < INTERVALO_MS) return false;
  try { sessionStorage.setItem(CHAVE, String(Date.now())); } catch { /* storage bloqueado */ }
  recarregando = true;
  // Se a recarga não acontecer (navegador segurou), a tela volta a mostrar o erro com "Tentar novamente".
  setTimeout(() => { recarregando = false; }, 8000);
  window.location.reload();
  return true;
}
