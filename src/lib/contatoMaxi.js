// WhatsApp de atendimento da Maxi para quem não consegue entrar no app (tela de Login)
// ou está bloqueada pela mensalidade (paywall). É o WhatsApp do Celso (Customer Success
// da rede) — decisão do Nelson 28/09/2026 (Mesa de Aprovações). Preenchido na S5 do
// roteiro do franqueado (memória reference_celso_cs_contato).
export const WHATSAPP_MAXI = "5516997737029";

export const MENSAGEM_LOGIN = "Olá! Preciso de ajuda para entrar no app da Maxi Massas.";

export const MENSAGEM_MENSALIDADE = "Olá! Minha mensalidade da Equipe Digital Maxi está em atraso e preciso de ajuda.";

// Mensagem genérica da tela Ajuda (S10.1, 28/09/2026), quando a pessoa toca em
// "Falar com a Maxi" sem ter um guia aberto (ex.: na busca, sem achar o guia certo).
export const MENSAGEM_AJUDA = "Olá! Preciso de ajuda com o app da Maxi Massas.";

export function linkWhatsAppMaxi(mensagem = MENSAGEM_LOGIN) {
  const numero = String(WHATSAPP_MAXI || "").replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// Mensagem com o nome do guia (S10.1): usada no botão "Falar com a Maxi" de dentro de
// um guia aberto, para a equipe já saber qual tela a pessoa estava seguindo.
export function mensagemAjudaGuia(tituloGuia) {
  if (!tituloGuia) return MENSAGEM_AJUDA;
  return `Olá! Segui o guia "${tituloGuia}" no app e não consegui resolver. Pode me ajudar?`;
}

// Link pronto do "Falar com a Maxi" a partir de um guia (S10.1): agrupa o número fixo
// (nunca imprimir cru em log/print — usar só este link) com a mensagem do guia.
export function linkFalarComMaxiDoGuia(guia) {
  return linkWhatsAppMaxi(mensagemAjudaGuia(guia?.titulo));
}
