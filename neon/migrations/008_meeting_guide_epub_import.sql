-- Stores the week-level scripture range from the official meeting-workbook EPUB.
ALTER TABLE public.meeting_programs
  ADD COLUMN IF NOT EXISTS weekly_bible_reading TEXT;

-- Extend the existing guarded save operation without weakening its membership,
-- publication, eligibility, or audit checks.
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
  p_weekly_bible_reading TEXT DEFAULT NULL
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
  SET weekly_bible_reading = NULLIF(BTRIM(p_weekly_bible_reading), '')
  WHERE id = v_saved_id;

  RETURN v_saved_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT
) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.save_meeting_program_with_guide(
  UUID, DATE, public.week_type_enum, UUID, UUID, BOOLEAN, UUID,
  TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB, TEXT
) TO authenticated;
