-- franchise_notes: admin/manager annotations per franchise
CREATE TABLE IF NOT EXISTS franchise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_franchise_notes_franchise_created
  ON franchise_notes(franchise_id, created_at DESC);

ALTER TABLE franchise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can read notes"
  ON franchise_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and manager can insert notes"
  ON franchise_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Author can delete own notes"
  ON franchise_notes FOR DELETE
  USING (auth.uid() = user_id);
