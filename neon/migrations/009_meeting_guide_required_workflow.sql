-- Single active bimonthly guide. A successful replacement deletes the previous active guide row.
ALTER TABLE public.meeting_programs
  ADD COLUMN IF NOT EXISTS weekly_bible_reading TEXT,
  ADD COLUMN IF NOT EXISTS opening_song_number INTEGER,
  ADD COLUMN IF NOT EXISTS living_song_number INTEGER,
  ADD COLUMN IF NOT EXISTS closing_song_number INTEGER;

CREATE TABLE IF NOT EXISTS public.active_meeting_guide (
  singleton SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  file_name TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  weeks JSONB NOT NULL CHECK (jsonb_typeof(weeks) = 'array' AND jsonb_array_length(weeks) > 0),
  uploaded_by UUID NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);
ALTER TABLE public.active_meeting_guide ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.active_meeting_guide FROM PUBLIC, anonymous, authenticated;

-- Only an active, authorized user can read the single active guide.
CREATE OR REPLACE FUNCTION public.get_active_meeting_guide()
RETURNS TABLE (
  file_name TEXT,
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  weeks JSONB,
  uploaded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor UUID;
BEGIN
  v_actor := public.current_app_user_id();
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = v_actor AND is_active IS TRUE
      AND role IN ('administrator'::public.app_user_role, 'user'::public.app_user_role)
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere una cuenta activa.';
  END IF;

  RETURN QUERY
  SELECT g.file_name, g.period_label, g.period_start, g.period_end, g.weeks, g.uploaded_at
  FROM public.active_meeting_guide AS g
  WHERE g.singleton = 1;
END;
$function$;

-- Atomically replaces the active guide. Invalid uploads leave the previous guide intact.
CREATE OR REPLACE FUNCTION public.replace_active_meeting_guide(
  p_file_name TEXT,
  p_period_label TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_weeks JSONB
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor UUID;
  v_role TEXT;
  v_uploaded_at TIMESTAMPTZ := NOW();
BEGIN
  v_actor := public.current_app_user_id();
  SELECT role::TEXT INTO v_role
  FROM public.app_users
  WHERE user_id = v_actor AND is_active IS TRUE;

  IF v_actor IS NULL OR v_role NOT IN ('administrator', 'user') THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere una cuenta activa y autorizada.';
  END IF;
  IF p_file_name IS NULL OR LOWER(BTRIM(p_file_name)) NOT LIKE '%.epub' THEN
    RAISE EXCEPTION 'Debes cargar la guía original en formato EPUB.';
  END IF;
  IF NULLIF(BTRIM(p_period_label), '') IS NULL
     OR p_period_start IS NULL OR p_period_end IS NULL
     OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'La guía no tiene un período bimestral válido.';
  END IF;
  IF p_weeks IS NULL OR jsonb_typeof(p_weeks) <> 'array' OR jsonb_array_length(p_weeks) = 0 THEN
    RAISE EXCEPTION 'La guía no contiene semanas reconocibles.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_weeks) AS item(week)
    WHERE jsonb_typeof(item.week) <> 'object'
       OR COALESCE(item.week->>'startDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       OR COALESCE(item.week->>'endDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       OR COALESCE(item.week->>'weeklyBibleReading', '') = ''
       OR jsonb_typeof(item.week->'assignments') <> 'array'
       OR jsonb_array_length(item.week->'assignments') = 0
  ) THEN
    RAISE EXCEPTION 'La guía contiene una semana incompleta o una estructura no válida.';
  END IF;

  DELETE FROM public.active_meeting_guide WHERE singleton = 1;
  INSERT INTO public.active_meeting_guide (
    singleton, file_name, period_label, period_start, period_end, weeks, uploaded_by, uploaded_at
  ) VALUES (
    1, BTRIM(p_file_name), BTRIM(p_period_label), p_period_start, p_period_end, p_weeks, v_actor, v_uploaded_at
  );

  RETURN v_uploaded_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_active_meeting_guide() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.get_active_meeting_guide() TO authenticated;
REVOKE ALL ON FUNCTION public.replace_active_meeting_guide(TEXT, TEXT, DATE, DATE, JSONB) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.replace_active_meeting_guide(TEXT, TEXT, DATE, DATE, JSONB) TO authenticated;

-- Replace the previous save wrapper so new guide metadata persists with the program.
DROP FUNCTION IF EXISTS public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT
);
CREATE OR REPLACE FUNCTION public.save_meeting_program_with_guide(
  p_program_id UUID,
  p_meeting_date DATE,
  p_week_type public.week_type_enum,
  p_chairman_id UUID DEFAULT NULL,
  p_auxiliary_counselor_id UUID DEFAULT NULL,
  p_leadership_review_confirmed BOOLEAN DEFAULT FALSE,
  p_leadership_review_confirmed_by UUID DEFAULT NULL,
  p_leadership_review_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  p_circuit_overseer_talk_title VARCHAR DEFAULT NULL,
  p_is_draft BOOLEAN DEFAULT TRUE,
  p_notes TEXT DEFAULT NULL,
  p_slots JSONB DEFAULT '[]'::JSONB,
  p_weekly_bible_reading TEXT DEFAULT NULL,
  p_opening_song_number INTEGER DEFAULT NULL,
  p_living_song_number INTEGER DEFAULT NULL,
  p_closing_song_number INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_saved_id UUID;
BEGIN
  v_saved_id := public.save_meeting_program_transaction(
    p_program_id => p_program_id,
    p_meeting_date => p_meeting_date,
    p_week_type => p_week_type,
    p_chairman_id => p_chairman_id,
    p_auxiliary_counselor_id => p_auxiliary_counselor_id,
    p_leadership_review_confirmed => p_leadership_review_confirmed,
    p_leadership_review_confirmed_by => p_leadership_review_confirmed_by,
    p_leadership_review_confirmed_at => p_leadership_review_confirmed_at,
    p_circuit_overseer_talk_title => p_circuit_overseer_talk_title,
    p_is_draft => p_is_draft,
    p_notes => p_notes,
    p_slots => p_slots
  );

  UPDATE public.meeting_programs
  SET weekly_bible_reading = NULLIF(BTRIM(p_weekly_bible_reading), ''),
      opening_song_number = p_opening_song_number,
      living_song_number = p_living_song_number,
      closing_song_number = p_closing_song_number
  WHERE id = v_saved_id;

  RETURN v_saved_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER
) TO authenticated;

NOTIFY pgrst, 'reload schema';
