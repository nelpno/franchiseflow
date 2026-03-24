-- handle_new_user: auto-link franchise + auto-create onboarding checklist
-- Updated 2026-03-24: added auto-creation of onboarding_checklists for new franchisees
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  invite RECORD;
  franchise_ids TEXT[] := '{}';
  evo_ids TEXT[] := '{}';
  user_role TEXT := '';
  user_name TEXT := '';
  evo TEXT;
BEGIN
  -- Auto-link: check franchise_invites for pending invites
  FOR invite IN
    SELECT fi.id as invite_id, fi.franchise_id as evo_id, f.id as franchise_uuid, f.owner_name
    FROM public.franchise_invites fi
    JOIN public.franchises f ON f.evolution_instance_id = fi.franchise_id
    WHERE fi.email = NEW.email AND fi.status = 'pending'
  LOOP
    franchise_ids := array_append(franchise_ids, invite.franchise_uuid::TEXT);
    franchise_ids := array_append(franchise_ids, invite.evo_id);
    evo_ids := array_append(evo_ids, invite.evo_id);
    IF user_name = '' AND invite.owner_name IS NOT NULL AND invite.owner_name != '' THEN
      user_name := invite.owner_name;
    END IF;
    UPDATE public.franchise_invites SET status = 'accepted', accepted_at = now() WHERE id = invite.invite_id;
  END LOOP;

  IF array_length(franchise_ids, 1) > 0 THEN
    user_role := 'franchisee';
  END IF;

  -- Use franchise owner_name, then user metadata, then email as fallback
  IF user_name = '' THEN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, managed_franchise_ids)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    franchise_ids
  );

  -- Auto-create onboarding checklist for each franchise (new franchisees only)
  -- Items 1-1 (contrato) and 1-2 (kick-off) are auto-marked as complete
  IF user_role = 'franchisee' THEN
    FOREACH evo IN ARRAY evo_ids LOOP
      INSERT INTO public.onboarding_checklists (franchise_id, status, items, completed_count, completion_percentage)
      VALUES (evo, 'in_progress', '{"1-1": true, "1-2": true}'::jsonb, 2, 7)
      ON CONFLICT (franchise_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$func$;
