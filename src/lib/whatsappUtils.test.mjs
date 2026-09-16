// Testes puros (node:assert, sem framework) — telefone BR x estrangeiro.
// Rodar: node src/lib/whatsappUtils.test.mjs
// Casos tirados da base real (contacts, 16/09/2026).
import assert from "node:assert";
import { normalizePhone, formatPhone, getWhatsAppLink, isInternationalPhone } from "./whatsappUtils.js";

// ── Caso Tatuapé (Izaias): EUA gravado pelo robô aparecia como "(13) 21438-4841" ──
assert.equal(formatPhone("13214384841"), "+13214384841");
assert.equal(getWhatsAppLink("13214384841"), "https://wa.me/13214384841");

// ── Digitar com + guarda o DDI; digitar +55 continua tirando o 55 ──
assert.equal(normalizePhone("+1 (321) 438-4841"), "13214384841");
assert.equal(normalizePhone("+55 (11) 98650-9681"), "11986509681");
assert.equal(normalizePhone("+351 912 345 678"), "351912345678");

// ── Estrangeiros reais da base ──
assert.equal(formatPhone("34686363625"), "+34686363625"); // Espanha
assert.equal(formatPhone("61411223423"), "+61411223423"); // Austrália
assert.equal(formatPhone("447710173736"), "+447710173736"); // Reino Unido
assert.equal(formatPhone("2349068787852"), "+2349068787852"); // Nigéria
assert.equal(getWhatsAppLink("447710173736"), "https://wa.me/447710173736");

// ── Brasileiros não mudam ──
assert.equal(formatPhone("11986509681"), "(11) 98650-9681");
assert.equal(formatPhone("1433221100"), "(14) 3322-1100");
assert.equal(formatPhone("5511986509681"), "(11) 98650-9681");
assert.equal(getWhatsAppLink("11986509681"), "https://wa.me/5511986509681");
assert.equal(getWhatsAppLink("5511986509681"), "https://wa.me/5511986509681");
assert.equal(isInternationalPhone("11986509681"), false);
assert.equal(isInternationalPhone("1433221100"), false);

// ── DDD 55 (RS) é número local: antes o link saía sem o 55 do país ──
assert.equal(getWhatsAppLink("55991234567"), "https://wa.me/5555991234567");
assert.equal(formatPhone("55991234567"), "(55) 99123-4567");

// ── Zero da operadora é BR sujo, não estrangeiro (continua como estava) ──
assert.equal(isInternationalPhone("017981684908"), false);
assert.equal(formatPhone("017981684908"), "017981684908");
assert.equal(isInternationalPhone("00000000000"), false);

// ── Vazio ──
assert.equal(formatPhone(""), "");
assert.equal(getWhatsAppLink(null), "#");
assert.equal(isInternationalPhone(null), false);

console.log("whatsappUtils: ok");
