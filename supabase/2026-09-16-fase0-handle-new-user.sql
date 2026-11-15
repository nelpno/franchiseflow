-- Fase 0 de seguranca (16/09/2026): handle_new_user deixa de ler o papel do metadado.
-- Versao anterior: docs/db-backups/handle_new_user.antes-2026-09-16.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Fase 0 (16/09/2026): o papel NUNCA vem do metadado. Qualquer pessoa com a chave
  -- publica conseguia mandar data.role = 'admin' no cadastro e virar admin. Todo usuario
  -- nasce franqueado; gerente e promovido pelo workflow staff-invite (chave service),
  -- que grava profiles.role depois do convite.
  user_role := 'franchisee';

  -- Use franchise owner_name, then user metadata, then email as fallback
  IF user_name = '' THEN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, managed_franchise_ids)
  VALUES (NEW.id, NEW.email, user_name, user_role, franchise_ids);

  -- Auto-create onboarding checklist for each franchise (new franchisees only)
  IF user_role = 'franchisee' THEN
    FOREACH evo IN ARRAY evo_ids LOOP
      INSERT INTO public.onboarding_checklists (franchise_id, status, items, completed_count, completion_percentage)
      VALUES (evo, 'in_progress', '{"1-1": true, "1-2": true}'::jsonb, 2, 7)
      ON CONFLICT (franchise_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;
