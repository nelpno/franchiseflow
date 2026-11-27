// Comprovantes de pagamento (bucket "marketing-comprovantes", privado desde 27/11/2026).
// O banco guarda a URL pública antiga em marketing_payments.proof_url; o app tira o caminho
// dela e gera uma URL assinada de vida curta na hora de abrir.
export const BUCKET_COMPROVANTES = "marketing-comprovantes";
export const VALIDADE_COMPROVANTE_SEG = 60 * 60; // 1 h

const MARCADORES = [
  `/storage/v1/object/public/${BUCKET_COMPROVANTES}/`,
  `/storage/v1/object/sign/${BUCKET_COMPROVANTES}/`,
  `/storage/v1/object/authenticated/${BUCKET_COMPROVANTES}/`,
];

// "https://.../object/public/marketing-comprovantes/<evo>/2026-04.pdf?x=1" -> "<evo>/2026-04.pdf"
// Devolve null se não for deste bucket (nunca assina URL de fora).
export function caminhoDoComprovante(url) {
  if (!url || typeof url !== "string") return null;
  for (const m of MARCADORES) {
    const idx = url.indexOf(m);
    if (idx === -1) continue;
    const resto = url.slice(idx + m.length).split("?")[0].split("#")[0];
    if (!resto) return null;
    try {
      return decodeURIComponent(resto);
    } catch {
      return null;
    }
  }
  return null;
}
