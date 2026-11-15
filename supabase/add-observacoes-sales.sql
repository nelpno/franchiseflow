-- Add observacoes (notes) field to sales table
-- Allows franchisees to add delivery instructions, special notes, etc.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS observacoes TEXT;
