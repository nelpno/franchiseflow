-- =============================================================================
-- Audit: detecta duplicatas latentes de telefone em contacts
-- =============================================================================
-- Pos-entrega (2026-04-16): esperado 0 linhas.
-- Rodar quando quiser checar se algum caller novo esta gerando inconsistencia.
-- Depende de public.normalize_phone_br(text).
-- =============================================================================

SELECT
  franchise_id,
  public.normalize_phone_br(telefone) AS telefone_normalizado,
  COUNT(*) AS quantidade,
  array_agg(id ORDER BY created_at) AS ids,
  array_agg(nome ORDER BY created_at) AS nomes,
  array_agg(source ORDER BY created_at) AS sources
FROM contacts
WHERE telefone IS NOT NULL AND telefone <> ''
GROUP BY franchise_id, public.normalize_phone_br(telefone)
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, franchise_id;

-- -----------------------------------------------------------------------------
-- Audit complementar: registros com formato nao-canonico
-- -----------------------------------------------------------------------------
-- Se o trigger esta ativo, isso tambem deve retornar 0 linhas.

SELECT COUNT(*) AS com_formato_nao_canonico
FROM contacts
WHERE telefone IS NOT NULL AND telefone <> ''
  AND telefone <> public.normalize_phone_br(telefone);
