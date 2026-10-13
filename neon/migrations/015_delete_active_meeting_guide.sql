-- Authorized users can permanently delete the active meeting guide.
-- Draft programs generated from the guide are preserved; they reload when a new guide is uploaded.
CREATE OR REPLACE FUNCTION public.delete_active_meeting_guide()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor UUID;
  v_role TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere una sesión autenticada.';
  END IF;

  SELECT au.role::text INTO v_role
  FROM public.app_users AS au
  WHERE au.user_id = v_actor AND au.is_active IS TRUE;

  IF v_role IS NULL OR v_role NOT IN ('administrator', 'user') THEN
    RAISE EXCEPTION 'Acceso denegado: tu rol no permite eliminar la guía.';
  END IF;

  DELETE FROM public.active_meeting_guide WHERE singleton = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_active_meeting_guide() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.delete_active_meeting_guide() TO authenticated;

NOTIFY pgrst, 'reload schema';
