// WhatsApp de atendimento da Maxi para quem não consegue entrar no app (tela de Login).
// TODO(Nelson): preencher com o número de atendimento às franquias (só dígitos, com 55 e DDD).
// Não havia número claro no código em 26/09/2026; enquanto vazio, o Login mostra só o texto
// "Fale com a equipe Maxi Massas", sem o botão do WhatsApp.
export const WHATSAPP_MAXI = "";

export const MENSAGEM_LOGIN = "Olá! Preciso de ajuda para entrar no app da Maxi Massas.";

export function linkWhatsAppMaxi(mensagem = MENSAGEM_LOGIN) {
  const numero = String(WHATSAPP_MAXI || "").replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
