-- MIGRACIÓN 004: REVISIÓN HUMANA DE ELEGIBILIDAD Y BAJA LÓGICA DE INTERVENCIONES
-- No asigna competencias automáticamente. La confirmación solo puede registrarla un anciano/administrador.
ALTER TABLE public.assignment_slots
  ADD COLUMN IF NOT EXISTS eligibility_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eligibility_confirmed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eligibility_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.meeting_programs
  ADD COLUMN IF NOT EXISTS leadership_review_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leadership_review_confirmed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leadership_review_confirmed_at TIMESTAMPTZ NULL;


CREATE INDEX IF NOT EXISTS idx_assignment_slots_eligibility_review
  ON public.assignment_slots(eligibility_confirmed);
CREATE INDEX IF NOT EXISTS idx_assignment_slots_active_program
  ON public.assignment_slots(meeting_program_id, is_deleted);

CREATE OR REPLACE FUNCTION public.guard_assignment_eligibility_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_role public.app_user_role;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.eligibility_confirmed = TRUE THEN
      SELECT au.role INTO current_role
      FROM public.app_users AS au
      WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE;

      IF current_role IS NULL OR current_role NOT IN ('administrator', 'elder') THEN
        RAISE EXCEPTION 'Solo un administrador o anciano puede confirmar la revisión S-38-S.';
      END IF;
      NEW.eligibility_confirmed_by := (SELECT auth.uid());
      NEW.eligibility_confirmed_at := NOW();
    ELSE
      NEW.eligibility_confirmed_by := NULL;
      NEW.eligibility_confirmed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.eligibility_confirmed IS DISTINCT FROM OLD.eligibility_confirmed THEN
    IF NEW.eligibility_confirmed = TRUE THEN
      SELECT au.role INTO current_role
      FROM public.app_users AS au
      WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE;

      IF current_role IS NULL OR current_role NOT IN ('administrator', 'elder') THEN
        RAISE EXCEPTION 'Solo un administrador o anciano puede confirmar la revisión S-38-S.';
      END IF;
      NEW.eligibility_confirmed_by := (SELECT auth.uid());
      NEW.eligibility_confirmed_at := NOW();
    ELSE
      NEW.eligibility_confirmed_by := NULL;
      NEW.eligibility_confirmed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assignment_eligibility_confirmation_guard ON public.assignment_slots;
CREATE TRIGGER assignment_eligibility_confirmation_guard
  BEFORE INSERT OR UPDATE ON public.assignment_slots
  FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_eligibility_confirmation();

CREATE OR REPLACE FUNCTION public.guard_program_leadership_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_role public.app_user_role;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.leadership_review_confirmed = TRUE THEN
      SELECT au.role INTO current_role FROM public.app_users AS au
      WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE;
      IF current_role IS NULL OR current_role NOT IN ('administrator', 'elder') THEN
        RAISE EXCEPTION 'Solo un administrador o anciano puede confirmar Presidencia y Consejería.';
      END IF;
      NEW.leadership_review_confirmed_by := (SELECT auth.uid());
      NEW.leadership_review_confirmed_at := NOW();
    ELSE
      NEW.leadership_review_confirmed_by := NULL;
      NEW.leadership_review_confirmed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.leadership_review_confirmed IS DISTINCT FROM OLD.leadership_review_confirmed THEN
    IF NEW.leadership_review_confirmed = TRUE THEN
      SELECT au.role INTO current_role FROM public.app_users AS au
      WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE;
      IF current_role IS NULL OR current_role NOT IN ('administrator', 'elder') THEN
        RAISE EXCEPTION 'Solo un administrador o anciano puede confirmar Presidencia y Consejería.';
      END IF;
      NEW.leadership_review_confirmed_by := (SELECT auth.uid());
      NEW.leadership_review_confirmed_at := NOW();
    ELSE
      NEW.leadership_review_confirmed_by := NULL;
      NEW.leadership_review_confirmed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS program_leadership_review_guard ON public.meeting_programs;
CREATE TRIGGER program_leadership_review_guard
  BEFORE INSERT OR UPDATE ON public.meeting_programs
  FOR EACH ROW EXECUTE FUNCTION public.guard_program_leadership_review();
