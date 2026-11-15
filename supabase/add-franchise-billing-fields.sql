-- ============================================================
-- Add billing-related fields to franchises for ASAAS integration
-- ============================================================

-- CPF or CNPJ (11 or 14 digits, stored without formatting)
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

-- State (UF) - 2 chars, e.g. "SP", "RJ"
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS state_uf VARCHAR(2);

-- Address number (separated from street for ASAAS)
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS address_number TEXT;

-- Neighborhood/bairro
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS neighborhood TEXT;
