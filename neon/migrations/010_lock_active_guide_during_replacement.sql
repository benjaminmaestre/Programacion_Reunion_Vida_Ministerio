-- Lock participant/program access between starting a new cycle and applying the replacement EPUB.
ALTER TABLE public.active_meeting_guide
  ADD COLUMN IF NOT EXISTS replacement_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_active_meeting_guide_ready()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((SELECT NOT replacement_required FROM public.active_meeting_guide WHERE singleton = 1), FALSE);
$function$;

CREATE OR REPLACE FUNCTION public.get_active_meeting_guide()
RETURNS TABLE (file_name TEXT, period_label TEXT, period_start DATE, period_end DATE, weeks JSONB, uploaded_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor UUID;
BEGIN
  v_actor := public.current_app_user_id();
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_users WHERE user_id = v_actor AND is_active IS TRUE
      AND role IN ('administrator'::public.app_user_role, 'user'::public.app_user_role)
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere una cuenta activa.';
  END IF;
  RETURN QUERY SELECT g.file_name, g.period_label, g.period_start, g.period_end, g.weeks, g.uploaded_at
    FROM public.active_meeting_guide AS g
    WHERE g.singleton = 1 AND g.replacement_required IS FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_meeting_guide_replacement()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor UUID; v_role TEXT;
BEGIN
  v_actor := public.current_app_user_id();
  SELECT role::TEXT INTO v_role FROM public.app_users WHERE user_id = v_actor AND is_active IS TRUE;
  IF v_actor IS NULL OR v_role NOT IN ('administrator', 'user') OR v_role IS NULL THEN
    RAISE EXCEPTION 'Se requiere una cuenta activa autorizada para iniciar el nuevo ciclo.';
  END IF;
  UPDATE public.active_meeting_guide SET replacement_required = TRUE WHERE singleton = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay una guía activa que reemplazar.'; END IF;
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.replace_active_meeting_guide_locked(
  p_file_name TEXT, p_period_label TEXT, p_period_start DATE, p_period_end DATE, p_weeks JSONB
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_uploaded_at TIMESTAMPTZ;
BEGIN
  v_uploaded_at := public.replace_active_meeting_guide(p_file_name, p_period_label, p_period_start, p_period_end, p_weeks);
  UPDATE public.active_meeting_guide SET replacement_required = TRUE WHERE singleton = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo dejar el nuevo ciclo bloqueado para su preparación.'; END IF;
  RETURN v_uploaded_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_active_meeting_guide()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor UUID; v_role TEXT;
BEGIN
  v_actor := public.current_app_user_id();
  SELECT role::TEXT INTO v_role FROM public.app_users WHERE user_id = v_actor AND is_active IS TRUE;
  IF v_actor IS NULL OR v_role NOT IN ('administrator', 'user') OR v_role IS NULL THEN
    RAISE EXCEPTION 'Se requiere una cuenta activa autorizada para activar la guía.';
  END IF;
  UPDATE public.active_meeting_guide SET replacement_required = FALSE
    WHERE singleton = 1 AND replacement_required IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay una guía pendiente de activación.'; END IF;
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.is_active_meeting_guide_ready() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.is_active_meeting_guide_ready() TO authenticated;
REVOKE ALL ON FUNCTION public.begin_meeting_guide_replacement() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.begin_meeting_guide_replacement() TO authenticated;
REVOKE ALL ON FUNCTION public.replace_active_meeting_guide_locked(TEXT, TEXT, DATE, DATE, JSONB) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.replace_active_meeting_guide_locked(TEXT, TEXT, DATE, DATE, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_active_meeting_guide() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.activate_active_meeting_guide() TO authenticated;
NOTIFY pgrst, 'reload schema';
