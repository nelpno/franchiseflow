import assert from "node:assert/strict";
import { caminhoDoComprovante } from "./comprovantes.js";

const base = "https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object";
assert.equal(caminhoDoComprovante(`${base}/public/marketing-comprovantes/franquiaassissp/2026-04.jpeg`), "franquiaassissp/2026-04.jpeg");
assert.equal(caminhoDoComprovante(`${base}/public/marketing-comprovantes/franquiaassissp/2026-04_1775.pdf?t=1`), "franquiaassissp/2026-04_1775.pdf");
assert.equal(caminhoDoComprovante(`${base}/sign/marketing-comprovantes/a/b%20c.pdf?token=x`), "a/b c.pdf");
assert.equal(caminhoDoComprovante(`${base}/public/outro-bucket/a/b.pdf`), null);
assert.equal(caminhoDoComprovante("https://evil.example/storage/v1/object/public/catalog-images/x.jpg"), null);
assert.equal(caminhoDoComprovante(`${base}/public/marketing-comprovantes/`), null);
assert.equal(caminhoDoComprovante(null), null);
assert.equal(caminhoDoComprovante(""), null);
console.log("comprovantes: ok");
