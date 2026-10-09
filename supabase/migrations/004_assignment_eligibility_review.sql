-- MIGRACIÓN 004: CONFIRMACIÓN HUMANA DE ELEGIBILIDAD POR INTERVENCIÓN
-- No asigna competencias automáticamente: registra que un responsable revisó la asignación.
ALTER TABLE public.assignment_slots
  ADD COLUMN IF NOT EXISTS eligibility_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eligibility_confirmed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eligibility_confirmed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_assignment_slots_eligibility_review
  ON public.assignment_slots(eligibility_confirmed);
