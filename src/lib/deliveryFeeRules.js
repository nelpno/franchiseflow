/**
 * Le a regra de frete que a franquia ja cadastrou em
 * `franchise_configurations.delivery_fee_rules` e devolve opcoes prontas para virar
 * botao no SaleForm.
 *
 * Por que existe: 61 das 67 unidades tem regra de frete cadastrada, mas ela era lida
 * SO pelo robo. Na venda manual o campo nascia vazio e a pessoa digitava (ou esquecia):
 * 622 entregas em 90 dias sairam com frete R$ 0, e frete e RECEITA no DRE
 * (`getSaleNetValue` soma delivery_fee). Auditoria de 07/09/2026.
 *
 * IMPORTANTE — este modulo NAO adivinha valor. A venda manual nao sabe a distancia
 * ate o cliente, entao escolher sozinho uma faixa de km seria inventar numero de
 * dinheiro. Ele devolve as opcoes; quem escolhe e a franqueada, em UM toque. A unica
 * excecao e quando existe uma unica opcao valida — ai nao ha o que escolher.
 *
 * Dois formatos convivem no banco (medido 07/09/2026):
 *   por distancia : [{ fee: "7.00", max_km: "3" }, ...]
 *   por modalidade: { mode: "modality", rules: [{ fee: "15.00", label: "Ibitinga" }] }
 * Ha lixo em producao nos dois: fee "" e label "" (faixa em branco que o wizard
 * gravou). Esses saem.
 */

function parseFee(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  // aceita "7,50" e "7.50"
  const value = Number.parseFloat(text.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseKm(raw) {
  const value = parseFee(raw);
  return value === null || value <= 0 ? null : value;
}

/**
 * @param {unknown} rules valor cru de `delivery_fee_rules`
 * @returns {{label: string, fee: number}[]} opcoes validas, prontas para exibir
 */
export function parseDeliveryFeeOptions(rules) {
  if (!rules) return [];

  // ---- por modalidade: { mode: "modality", rules: [{ fee, label }] } ----
  if (!Array.isArray(rules) && typeof rules === "object") {
    if (!Array.isArray(rules.rules)) return [];
    return rules.rules
      .map((entry) => {
        const fee = parseFee(entry?.fee);
        const label = String(entry?.label ?? "").trim();
        if (fee === null || label === "") return null;
        return { label, fee };
      })
      .filter(Boolean);
  }

  // ---- por distancia: [{ fee, max_km }] ----
  if (Array.isArray(rules)) {
    return rules
      .map((entry) => {
        const fee = parseFee(entry?.fee);
        const km = parseKm(entry?.max_km);
        if (fee === null || km === null) return null;
        return { label: `até ${formatKm(km)} km`, fee, km };
      })
      .filter(Boolean)
      // o banco tem faixas fora de ordem (uma unidade tem "3 km" gravado por ultimo);
      // por km crescente e a ordem que a pessoa espera ler.
      .sort((a, b) => a.km - b.km)
      .map(({ label, fee }) => ({ label, fee }));
  }

  return [];
}

function formatKm(km) {
  return Number.isInteger(km) ? String(km) : String(km).replace(".", ",");
}

/**
 * Preenche sozinho SOMENTE quando nao ha escolha a fazer (uma unica opcao).
 * Com duas ou mais, devolve null: quem decide e a franqueada.
 * @returns {number|null}
 */
export function autoDeliveryFee(rules) {
  const options = parseDeliveryFeeOptions(rules);
  return options.length === 1 ? options[0].fee : null;
}
