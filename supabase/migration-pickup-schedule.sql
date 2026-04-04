-- Migration: Pickup schedule (separate from delivery hours)
-- Allows franchises with both delivery AND pickup to define different pickup hours

ALTER TABLE franchise_configurations
  ADD COLUMN IF NOT EXISTS pickup_schedule JSONB,
  ADD COLUMN IF NOT EXISTS has_custom_pickup_hours BOOLEAN DEFAULT false;

-- Format: [{ "days": ["seg","ter","qua","qui","sex"], "open": "09:00", "close": "18:00" }]
-- Same structure as OperatingHoursEditor output
