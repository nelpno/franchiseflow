// Rodar: node src/lib/featureFlags.test.mjs
// A chave só liga com `true` literal; tudo o mais é o comportamento atual.
import assert from "node:assert";
import { isFeatureOn, FEATURE_KEYS } from "./featureFlags.js";

const K = FEATURE_KEYS.UI_V2;

assert.strictEqual(isFeatureOn({ ui_v2: true }, K), true, "ligada");
assert.strictEqual(isFeatureOn({ ui_v2: false }, K), false, "desligada");
assert.strictEqual(isFeatureOn({}, K), false, "sem a chave");
assert.strictEqual(isFeatureOn(null, K), false, "RPC devolveu null (sem acesso)");
assert.strictEqual(isFeatureOn(undefined, K), false, "ainda carregando / erro");
assert.strictEqual(isFeatureOn({ ui_v2: "true" }, K), false, "string não liga");
assert.strictEqual(isFeatureOn({ ui_v2: 1 }, K), false, "número não liga");
assert.strictEqual(isFeatureOn([true], K), false, "array não liga");
assert.strictEqual(isFeatureOn({ outra: true }, K), false, "outra chave não vaza");

console.log("featureFlags: 9 casos ok");
