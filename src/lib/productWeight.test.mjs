// Teste do parser de peso. Roda com: node src/lib/productWeight.test.mjs
import { parseWeightKg, formatWeightKg, getItemWeightKg } from "./productWeight.js";

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = actual === expected || (typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) < 1e-9);
  if (ok) { pass++; }
  else { fail++; console.error(`FAIL ${label}: esperado ${expected}, veio ${actual}`); }
}

// parseWeightKg
eq(parseWeightKg("Canelone 4 Queijos - 700g"), 0.7, "700g com numero antes");
eq(parseWeightKg("Massa de Lasanha - 500g"), 0.5, "500g");
eq(parseWeightKg("Molho de Tomate Sugo - 250g"), 0.25, "250g");
eq(parseWeightKg("Massa de Pastel - 1kg"), 1.0, "1kg");
eq(parseWeightKg("Rondelli frango X Requeijão 700 gramas"), 0.7, "700 gramas");
eq(parseWeightKg("Produto sem peso"), null, "sem peso -> null");
eq(parseWeightKg(""), null, "vazio -> null");
eq(parseWeightKg(null), null, "null -> null");
eq(parseWeightKg("Coisa 1,5 kg"), 1.5, "1,5 kg virgula");

// formatWeightKg
eq(formatWeightKg(0.7), "0,7 kg", "format 0,7");
eq(formatWeightKg(58.8), "58,8 kg", "format 58,8");
eq(formatWeightKg(null), "—", "format null -> traco");
eq(formatWeightKg(0), "—", "format 0 -> traco");

// getItemWeightKg (override > parser > null)
eq(getItemWeightKg({ product_name: "Massa de Pastel - 1kg" }, { "Massa de Pastel - 1kg": 1.2 }), 1.2, "override vence");
eq(getItemWeightKg({ product_name: "Canelone 4 Queijos - 700g" }, {}), 0.7, "fallback parser");
eq(getItemWeightKg({ product_name: "Sem peso" }, {}), null, "sem nada -> null");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
