-- Security Phase 1: Fix vulnerabilities M5 + M6
-- Run via Supabase SQL Editor or Management API
-- Rollback: see comments inline

-- M5: Revoke anon access to vw_dadosunidade
-- The view is SECURITY INVOKER and accessed by bot (service_role) and frontend (authenticated)
-- anon should never need access
-- Rollback: GRANT SELECT ON vw_dadosunidade TO anon;
REVOKE SELECT ON vw_dadosunidade FROM anon;

-- M6: Restrict activity_log INSERT to authenticated users only
-- Previously: WITH CHECK (true) — anyone could insert for any franchise
-- Now: requires auth.uid() to be non-null (any authenticated user)
-- Rollback: DROP POLICY activity_insert_authenticated ON activity_log; CREATE POLICY activity_insert ON activity_log FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS activity_insert ON activity_log;
CREATE POLICY activity_insert_authenticated ON activity_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
