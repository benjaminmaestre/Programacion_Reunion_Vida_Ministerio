-- MIGRACIÓN 002: MULTITENENCIA, MEMBRESÍAS Y RLS PARA DATOS DE CONGREGACIÓN
-- Los accesos de aplicación quedan denegados hasta que el usuario tenga membresía activa.
-- No se usa service_role en navegador ni se confía en user_metadata para permisos.

CREATE TYPE public.congregation_role_enum AS ENUM ('administrator', 'elder', 'coordinator', 'viewer');

CREATE TABLE public.congregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.congregation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.congregation_role_enum NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (congregation_id, user_id)
);

CREATE INDEX idx_congregation_users_user_active
  ON public.congregation_users(user_id, is_active);

-- Un registro de instalación facilita migrar las tablas iniciales sin perder datos existentes.
-- El propietario real debe asignarse manualmente después de crear/invitar su usuario Auth.
DO $$
DECLARE
  initial_congregation_id UUID;
BEGIN
  INSERT INTO public.congregations (name, slug)
  VALUES ('Congregación pendiente de configuración', 'configuracion-inicial')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO initial_congregation_id;

  ALTER TABLE public.members ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);
  ALTER TABLE public.member_eligibilities ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);
  ALTER TABLE public.family_relationships ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);
  ALTER TABLE public.planning_cycles ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);
  ALTER TABLE public.history_periods ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);
  ALTER TABLE public.meeting_programs ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id);

  UPDATE public.members SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
  UPDATE public.member_eligibilities SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
  UPDATE public.family_relationships SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
  UPDATE public.planning_cycles SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
  UPDATE public.history_periods SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
  UPDATE public.meeting_programs SET congregation_id = initial_congregation_id WHERE congregation_id IS NULL;
END $$;

ALTER TABLE public.members ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.member_eligibilities ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.family_relationships ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.planning_cycles ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.history_periods ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.meeting_programs ALTER COLUMN congregation_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_id_congregation_unique
  ON public.members(id, congregation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_planning_cycles_id_congregation_unique
  ON public.planning_cycles(id, congregation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_periods_id_congregation_unique
  ON public.history_periods(id, congregation_id);

-- Integridad: las referencias de un programa no deben cruzar congregaciones.
ALTER TABLE public.meeting_programs
  ADD CONSTRAINT meeting_chairman_same_congregation_fk
  FOREIGN KEY (chairman_id, congregation_id)
  REFERENCES public.members(id, congregation_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.meeting_programs
  ADD CONSTRAINT meeting_counselor_same_congregation_fk
  FOREIGN KEY (auxiliary_counselor_id, congregation_id)
  REFERENCES public.members(id, congregation_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.meeting_programs
  ADD CONSTRAINT meeting_planning_cycle_same_congregation_fk
  FOREIGN KEY (planning_cycle_id, congregation_id)
  REFERENCES public.planning_cycles(id, congregation_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.meeting_programs
  ADD CONSTRAINT meeting_history_period_same_congregation_fk
  FOREIGN KEY (history_period_id, congregation_id)
  REFERENCES public.history_periods(id, congregation_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.member_eligibilities
  ADD CONSTRAINT eligibility_member_same_congregation_fk
  FOREIGN KEY (member_id, congregation_id)
  REFERENCES public.members(id, congregation_id)
  ON DELETE CASCADE;

ALTER TABLE public.family_relationships
  ADD CONSTRAINT family_member_same_congregation_fk
  FOREIGN KEY (member_id, congregation_id)
  REFERENCES public.members(id, congregation_id)
  ON DELETE CASCADE;

ALTER TABLE public.family_relationships
  ADD CONSTRAINT family_related_member_same_congregation_fk
  FOREIGN KEY (related_member_id, congregation_id)
  REFERENCES public.members(id, congregation_id)
  ON DELETE CASCADE;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_meeting_programs_congregation_date
  ON public.meeting_programs(congregation_id, meeting_date);
CREATE INDEX idx_members_congregation_name
  ON public.members(congregation_id, first_name, last_name);
CREATE INDEX idx_assignment_slots_primary_history
  ON public.assignment_slots(primary_participant_id);
CREATE INDEX idx_assignment_slots_assistant_history
  ON public.assignment_slots(assistant_participant_id);
CREATE INDEX idx_history_periods_congregation_dates
  ON public.history_periods(congregation_id, start_date, end_date);

-- Todas las tablas del esquema expuesto usan RLS y grants de mínimo privilegio.
ALTER TABLE public.congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congregation_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_eligibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.congregations,
  public.congregation_users,
  public.members,
  public.member_eligibilities,
  public.family_relationships,
  public.planning_cycles,
  public.history_periods,
  public.meeting_programs,
  public.assignment_slots,
  public.audit_logs
FROM anon, authenticated;

GRANT SELECT ON TABLE public.congregation_users TO authenticated;
GRANT SELECT ON TABLE public.congregations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.member_eligibilities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.family_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planning_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.history_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.assignment_slots TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- Un usuario únicamente puede leer sus propias membresías. No puede autoasignarse roles.
CREATE POLICY congregation_users_select_self
  ON public.congregation_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND is_active = TRUE);

CREATE POLICY congregations_select_member
  ON public.congregations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = congregations.id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.is_active = TRUE
    )
  );

CREATE POLICY members_select_member
  ON public.members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = members.congregation_id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.is_active = TRUE
    )
  );

CREATE POLICY members_insert_manager
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = members.congregation_id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator')
    )
  );

CREATE POLICY members_update_manager
  ON public.members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = members.congregation_id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = members.congregation_id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator')
    )
  );

-- Solo administradores y ancianos consultan/administran habilitaciones y parentescos.
CREATE POLICY eligibilities_select_authorized
  ON public.member_eligibilities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = member_eligibilities.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

CREATE POLICY eligibilities_insert_authorized
  ON public.member_eligibilities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = member_eligibilities.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

CREATE POLICY eligibilities_update_authorized
  ON public.member_eligibilities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = member_eligibilities.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = member_eligibilities.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

CREATE POLICY family_relationships_select_authorized
  ON public.family_relationships FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = family_relationships.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

CREATE POLICY family_relationships_insert_authorized
  ON public.family_relationships FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = family_relationships.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

CREATE POLICY family_relationships_update_authorized
  ON public.family_relationships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = family_relationships.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = family_relationships.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder')
    )
  );

-- Ciclos, períodos y programas: lectura para toda membresía activa;
-- escritura reservada a roles responsables de gestión.
CREATE POLICY planning_cycles_select_member
  ON public.planning_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = planning_cycles.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE)
  );
CREATE POLICY planning_cycles_insert_manager
  ON public.planning_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = planning_cycles.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );
CREATE POLICY planning_cycles_update_manager
  ON public.planning_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = planning_cycles.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = planning_cycles.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );

CREATE POLICY history_periods_select_member
  ON public.history_periods FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = history_periods.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE)
  );
CREATE POLICY history_periods_insert_manager
  ON public.history_periods FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = history_periods.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );
CREATE POLICY history_periods_update_manager
  ON public.history_periods FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = history_periods.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = history_periods.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );

CREATE POLICY meeting_programs_select_member
  ON public.meeting_programs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = meeting_programs.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE)
  );
CREATE POLICY meeting_programs_insert_manager
  ON public.meeting_programs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = meeting_programs.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );
CREATE POLICY meeting_programs_update_manager
  ON public.meeting_programs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = meeting_programs.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = meeting_programs.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  );

CREATE POLICY assignment_slots_select_member
  ON public.assignment_slots FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.meeting_programs mp
      JOIN public.congregation_users cu ON cu.congregation_id = mp.congregation_id
      WHERE mp.id = assignment_slots.meeting_program_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE)
  );
CREATE POLICY assignment_slots_insert_manager
  ON public.assignment_slots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meeting_programs mp
      JOIN public.congregation_users cu ON cu.congregation_id = mp.congregation_id
      WHERE mp.id = assignment_slots.meeting_program_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator')
        AND (assignment_slots.primary_participant_id IS NULL OR EXISTS (
          SELECT 1 FROM public.members m WHERE m.id = assignment_slots.primary_participant_id AND m.congregation_id = mp.congregation_id))
        AND (assignment_slots.assistant_participant_id IS NULL OR EXISTS (
          SELECT 1 FROM public.members m WHERE m.id = assignment_slots.assistant_participant_id AND m.congregation_id = mp.congregation_id)))
  );
CREATE POLICY assignment_slots_update_manager
  ON public.assignment_slots FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.meeting_programs mp
      JOIN public.congregation_users cu ON cu.congregation_id = mp.congregation_id
      WHERE mp.id = assignment_slots.meeting_program_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meeting_programs mp
      JOIN public.congregation_users cu ON cu.congregation_id = mp.congregation_id
      WHERE mp.id = assignment_slots.meeting_program_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder', 'coordinator')
        AND (assignment_slots.primary_participant_id IS NULL OR EXISTS (
          SELECT 1 FROM public.members m WHERE m.id = assignment_slots.primary_participant_id AND m.congregation_id = mp.congregation_id))
        AND (assignment_slots.assistant_participant_id IS NULL OR EXISTS (
          SELECT 1 FROM public.members m WHERE m.id = assignment_slots.assistant_participant_id AND m.congregation_id = mp.congregation_id)))
  );

CREATE POLICY audit_logs_select_authorized
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.congregation_users cu
      WHERE cu.congregation_id = audit_logs.congregation_id
        AND cu.user_id = (SELECT auth.uid()) AND cu.is_active = TRUE
        AND cu.role IN ('administrator', 'elder'))
  );

-- No se concede DELETE desde el cliente. Los registros se desactivan o se conservan,
-- preservando el historial de participación para futuras auditorías.
