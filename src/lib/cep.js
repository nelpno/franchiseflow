/**
 * CEP -> rua, bairro e cidade pelo ViaCEP (o mesmo que o cadastro de franquias usa).
 * Só ENDEREÇO. Para coordenada e frete, não: CEP que a base não conhece vira centro de cidade
 * (ver o CLAUDE.md raiz, "CEP -> lat/lng").
 */
export function normalizarCep(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 8);
}

export function formatarCep(valor) {
  const d = normalizarCep(valor);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** @returns {Promise<{rua: string, bairro: string, cidade: string, uf: string} | null>} */
export async function buscarCep(valor) {
  const d = normalizarCep(valor);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.erro) return null;
    return { rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
  } catch {
    return null;
  }
}

// "Rua Nove, 94" já contém "Rua Nove"? (sem acento e sem caixa) — decide se o CEP troca a rua.
export function ruaJaContem(ruaDigitada, ruaDoCep) {
  const n = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return !!n(ruaDoCep) && n(ruaDigitada).includes(n(ruaDoCep));
}
