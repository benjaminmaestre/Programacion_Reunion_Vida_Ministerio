-- MIGRACIÓN 002: INSTALACIÓN DE UNA SOLA CONGREGACIÓN + ROLES Y RLS
-- Modelo deliberadamente simple: una congregación y alrededor de 100 participantes.
-- No añadir tenant/congregation_id a cada tabla sin un cambio de alcance aprobado.

DO $$
BEGIN
  CREATE TYPE public.app_user_role AS ENUM ('administrator', 'elder', 'coordinator', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.app_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(160),
  role public.app_user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_active_role ON public.app_users(is_active, role);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(first_name, last_name);

-- Si la base previa tiene más de un período marcado como activo, conserva el más reciente.
WITH ranked_active_periods AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY start_date DESC, created_at DESC) AS row_number
  FROM public.history_periods
  WHERE is_active = TRUE
)
UPDATE public.history_periods AS hp
SET is_active = FALSE
FROM ranked_active_periods AS ranked
WHERE hp.id = ranked.id AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_history_periods_single_active
  ON public.history_periods(is_active) WHERE is_active = TRUE;

-- Garantizar que todas las tablas del esquema public usadas por la aplicación tengan RLS.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_eligibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_slots ENABLE ROW LEVEL SECURITY;

-- La aplicación solo necesita estos privilegios; RLS define qué usuarios pueden usarlos.
REVOKE ALL ON TABLE
  public.app_users,
  public.members,
  public.member_eligibilities,
  public.family_relationships,
  public.planning_cycles,
  public.history_periods,
  public.meeting_programs,
  public.assignment_slots
FROM anon, authenticated;

GRANT SELECT ON TABLE public.app_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.member_eligibilities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.family_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planning_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.history_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.assignment_slots TO authenticated;

-- El usuario solo puede consultar su propio perfil/rol. No puede editarlo ni elevar sus permisos.
DROP POLICY IF EXISTS app_users_select_self ON public.app_users;
CREATE POLICY app_users_select_self
  ON public.app_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND is_active = TRUE);

-- El directorio lo consultan usuarios autorizados activos; la escritura se limita a responsables.
DROP POLICY IF EXISTS members_select_active_app_user ON public.members;
CREATE POLICY members_select_active_app_user
  ON public.members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
  ));

DROP POLICY IF EXISTS members_insert_manager ON public.members;
CREATE POLICY members_insert_manager
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

DROP POLICY IF EXISTS members_update_manager ON public.members;
CREATE POLICY members_update_manager
  ON public.members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

-- Competencias y relaciones familiares son información restringida a administradores/ancianos.
DROP POLICY IF EXISTS eligibilities_select_authorized ON public.member_eligibilities;
CREATE POLICY eligibilities_select_authorized
  ON public.member_eligibilities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));
DROP POLICY IF EXISTS eligibilities_insert_authorized ON public.member_eligibilities;
CREATE POLICY eligibilities_insert_authorized
  ON public.member_eligibilities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));
DROP POLICY IF EXISTS eligibilities_update_authorized ON public.member_eligibilities;
CREATE POLICY eligibilities_update_authorized
  ON public.member_eligibilities FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));

DROP POLICY IF EXISTS family_relationships_select_authorized ON public.family_relationships;
CREATE POLICY family_relationships_select_authorized
  ON public.family_relationships FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));
DROP POLICY IF EXISTS family_relationships_insert_authorized ON public.family_relationships;
CREATE POLICY family_relationships_insert_authorized
  ON public.family_relationships FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));
DROP POLICY IF EXISTS family_relationships_update_authorized ON public.family_relationships;
CREATE POLICY family_relationships_update_authorized
  ON public.family_relationships FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder')
  ));

-- Programación: lectura para cualquier cuenta activa; edición para roles autorizados.
DROP POLICY IF EXISTS planning_cycles_select_active ON public.planning_cycles;
CREATE POLICY planning_cycles_select_active ON public.planning_cycles
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
  ));
DROP POLICY IF EXISTS planning_cycles_insert_manager ON public.planning_cycles;
CREATE POLICY planning_cycles_insert_manager ON public.planning_cycles
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));
DROP POLICY IF EXISTS planning_cycles_update_manager ON public.planning_cycles;
CREATE POLICY planning_cycles_update_manager ON public.planning_cycles
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

DROP POLICY IF EXISTS history_periods_select_active ON public.history_periods;
CREATE POLICY history_periods_select_active ON public.history_periods
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
  ));
DROP POLICY IF EXISTS history_periods_insert_manager ON public.history_periods;
CREATE POLICY history_periods_insert_manager ON public.history_periods
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));
DROP POLICY IF EXISTS history_periods_update_manager ON public.history_periods;
CREATE POLICY history_periods_update_manager ON public.history_periods
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

DROP POLICY IF EXISTS meeting_programs_select_active ON public.meeting_programs;
CREATE POLICY meeting_programs_select_active ON public.meeting_programs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
  ));
DROP POLICY IF EXISTS meeting_programs_insert_manager ON public.meeting_programs;
CREATE POLICY meeting_programs_insert_manager ON public.meeting_programs
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));
DROP POLICY IF EXISTS meeting_programs_update_manager ON public.meeting_programs;
CREATE POLICY meeting_programs_update_manager ON public.meeting_programs
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

DROP POLICY IF EXISTS assignment_slots_select_active ON public.assignment_slots;
CREATE POLICY assignment_slots_select_active ON public.assignment_slots
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
  ));
DROP POLICY IF EXISTS assignment_slots_insert_manager ON public.assignment_slots;
CREATE POLICY assignment_slots_insert_manager ON public.assignment_slots
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));
DROP POLICY IF EXISTS assignment_slots_update_manager ON public.assignment_slots;
CREATE POLICY assignment_slots_update_manager ON public.assignment_slots
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = TRUE
      AND au.role IN ('administrator', 'elder', 'coordinator')
  ));

-- Los borrados desde el cliente no están permitidos; se conserva la memoria histórica.
