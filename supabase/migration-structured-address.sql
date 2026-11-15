-- Migration: Structured address fields
-- Replaces ambiguous unit_address with structured sub-fields
-- unit_address continues to exist as computed concatenation for Distance Service
--
-- NO backfill: existing unit_address data is inconsistent (phone numbers, just CEPs, etc.)
-- Franchisees will fill structured fields when they next open the wizard

ALTER TABLE franchise_configurations
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT;
