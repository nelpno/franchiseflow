// WhatsApp de atendimento da Maxi para quem não consegue entrar no app (tela de Login)
// ou está bloqueada pela mensalidade (paywall). É o WhatsApp do Celso (Customer Success
// da rede) — decisão do Nelson 28/09/2026 (Mesa de Aprovações). Preenchido na S5 do
// roteiro do franqueado (memória reference_celso_cs_contato).
export const WHATSAPP_MAXI = "5516997737029";

export const MENSAGEM_LOGIN = "Olá! Preciso de ajuda para entrar no app da Maxi Massas.";

export const MENSAGEM_MENSALIDADE = "Olá! Minha mensalidade da Equipe Digital Maxi está em atraso e preciso de ajuda.";

export function linkWhatsAppMaxi(mensagem = MENSAGEM_LOGIN) {
  const numero = String(WHATSAPP_MAXI || "").replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
