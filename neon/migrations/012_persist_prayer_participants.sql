-- Persist opening and closing prayer participants with the meeting program.
ALTER TABLE public.meeting_programs
  ADD COLUMN IF NOT EXISTS opening_prayer_participant_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closing_prayer_participant_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

-- Replace the guide-aware save RPC with a version that also accepts prayer assignments.
-- Drop the prior 16-argument signature so PostgREST cannot resolve an ambiguous overload.
DROP FUNCTION IF EXISTS public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER
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
  p_closing_song_number INTEGER DEFAULT NULL,
  p_opening_prayer_participant_id UUID DEFAULT NULL,
  p_closing_prayer_participant_id UUID DEFAULT NULL
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

  IF p_opening_prayer_participant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = p_opening_prayer_participant_id
      AND is_active IS TRUE AND gender = 'male'
  ) THEN
    RAISE EXCEPTION 'La oración de apertura debe asignarse a un varón activo.';
  END IF;

  IF p_closing_prayer_participant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = p_closing_prayer_participant_id
      AND is_active IS TRUE AND gender = 'male'
  ) THEN
    RAISE EXCEPTION 'La oración de conclusión debe asignarse a un varón activo.';
  END IF;

  UPDATE public.meeting_programs
  SET weekly_bible_reading = NULLIF(BTRIM(p_weekly_bible_reading), ''),
      opening_song_number = p_opening_song_number,
      living_song_number = p_living_song_number,
      closing_song_number = p_closing_song_number,
      opening_prayer_participant_id = p_opening_prayer_participant_id,
      closing_prayer_participant_id = p_closing_prayer_participant_id
  WHERE id = v_saved_id;

  RETURN v_saved_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER, UUID, UUID
) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER, UUID, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';
