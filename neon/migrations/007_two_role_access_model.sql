-- MIGRACIÓN 007: modelo de acceso de dos roles
-- administrator = administrador supremo; user = usuario de la plataforma.
-- Ejecutar una sola vez después de las migraciones 001–006.

BEGIN;

-- Retirar las políticas que dependen del enum antiguo antes de cambiarlo.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'app_users', 'members', 'meeting_programs', 'assignment_slots',
        'history_periods', 'planning_cycles', 'family_relationships',
        'member_eligibilities'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Reemplazar el enum para que los únicos roles válidos sean administrator y user.
CREATE TYPE public.app_user_role_v2 AS ENUM ('administrator', 'user');
ALTER TABLE public.app_users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.app_users
  ALTER COLUMN role TYPE public.app_user_role_v2
  USING (
    CASE WHEN role::text = 'administrator' THEN 'administrator' ELSE 'user' END
  )::public.app_user_role_v2;
ALTER TABLE public.app_users ALTER COLUMN role SET DEFAULT 'user'::public.app_user_role_v2;
DROP TYPE public.app_user_role;
ALTER TYPE public.app_user_role_v2 RENAME TO app_user_role;

-- Solo puede existir una cuenta de administrador supremo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_single_administrator
  ON public.app_users (role)
  WHERE role = 'administrator'::public.app_user_role;

-- Funciones auxiliares SECURITY DEFINER: las políticas no hacen consultas recursivas a app_users.
CREATE OR REPLACE FUNCTION public.is_active_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS au
    WHERE au.user_id = auth.uid()
      AND au.is_active IS TRUE
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS au
    WHERE au.user_id = auth.uid()
      AND au.is_active IS TRUE
      AND au.role::text = 'administrator'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_active_app_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_app_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_app_admin() TO authenticated;

-- Permitir comprobar únicamente si el primer administrador ya está configurado.
-- Esta función no concede acceso a ninguna tabla ni revela identidad alguna.
CREATE OR REPLACE FUNCTION public.is_admin_configured()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE role::text = 'administrator'
  );
$function$;
REVOKE ALL ON FUNCTION public.is_admin_configured() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_configured() TO anonymous;
GRANT EXECUTE ON FUNCTION public.is_admin_configured() TO authenticated;

-- Mantener el listado administrativo separado de la lectura ordinaria del perfil propio.
CREATE OR REPLACE FUNCTION public.admin_list_app_users()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'neon_auth', 'pg_temp'
AS $function$
  SELECT au.user_id, au.display_name::text, nu.email::text, au.role::text, au.is_active, au.created_at
  FROM public.app_users AS au
  LEFT JOIN neon_auth."user" AS nu ON nu.id = au.user_id
  WHERE public.is_active_app_admin()
  ORDER BY au.created_at ASC, au.display_name ASC NULLS LAST;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_app_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_app_users() TO authenticated;

-- app_users: una persona activa solo puede leer su propia fila.
-- Únicamente el administrador supremo puede crear o gestionar cuentas ordinarias.
CREATE POLICY app_users_select_self
  ON public.app_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active IS TRUE);

CREATE POLICY app_users_insert_regular_user_admin_only
  ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_admin() AND role = 'user'::public.app_user_role);

CREATE POLICY app_users_update_regular_user_admin_only
  ON public.app_users FOR UPDATE TO authenticated
  USING (public.is_active_app_admin() AND role = 'user'::public.app_user_role)
  WITH CHECK (public.is_active_app_admin() AND role = 'user'::public.app_user_role);

-- Todo usuario con acceso activo puede operar los módulos funcionales de la aplicación.
-- No se concede DELETE directo: el borrado lógico existente se conserva en el flujo de negocio.
CREATE POLICY members_select_active_app_user
  ON public.members FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY members_insert_active_app_user
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY members_update_active_app_user
  ON public.members FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY meeting_programs_select_active_app_user
  ON public.meeting_programs FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY meeting_programs_insert_active_app_user
  ON public.meeting_programs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY meeting_programs_update_active_app_user
  ON public.meeting_programs FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY assignment_slots_select_active_app_user
  ON public.assignment_slots FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY assignment_slots_insert_active_app_user
  ON public.assignment_slots FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY assignment_slots_update_active_app_user
  ON public.assignment_slots FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY history_periods_select_active_app_user
  ON public.history_periods FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY history_periods_insert_active_app_user
  ON public.history_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY history_periods_update_active_app_user
  ON public.history_periods FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY planning_cycles_select_active_app_user
  ON public.planning_cycles FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY planning_cycles_insert_active_app_user
  ON public.planning_cycles FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY planning_cycles_update_active_app_user
  ON public.planning_cycles FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY family_relationships_select_active_app_user
  ON public.family_relationships FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY family_relationships_insert_active_app_user
  ON public.family_relationships FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY family_relationships_update_active_app_user
  ON public.family_relationships FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

CREATE POLICY member_eligibilities_select_active_app_user
  ON public.member_eligibilities FOR SELECT TO authenticated
  USING (public.is_active_app_user());
CREATE POLICY member_eligibilities_insert_active_app_user
  ON public.member_eligibilities FOR INSERT TO authenticated
  WITH CHECK (public.is_active_app_user());
CREATE POLICY member_eligibilities_update_active_app_user
  ON public.member_eligibilities FOR UPDATE TO authenticated
  USING (public.is_active_app_user())
  WITH CHECK (public.is_active_app_user());

GRANT SELECT, INSERT, UPDATE ON
  public.app_users, public.members, public.meeting_programs, public.assignment_slots,
  public.history_periods, public.planning_cycles, public.family_relationships,
  public.member_eligibilities
TO authenticated;

-- Las revisiones funcionales las puede registrar cualquier usuario activo.
-- Se mantienen intactas las reglas de negocio relativas a nombramientos de participantes.
DO $$
DECLARE f RECORD; src TEXT;
BEGIN
  FOR f IN
    SELECT p.oid
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'guard_assignment_eligibility_confirmation',
        'guard_program_leadership_review',
        'save_meeting_program_transaction'
      )
      AND p.prokind = 'f'
  LOOP
    src := pg_get_functiondef(f.oid);
    src := replace(src, 'v_role NOT IN (''administrator'', ''elder'')', 'v_role NOT IN (''administrator'', ''user'')');
    src := replace(src, 'v_role NOT IN (''administrator'', ''elder'', ''coordinator'')', 'v_role NOT IN (''administrator'', ''user'')');
    src := replace(src, 'v_role NOT IN (''administrator'',''elder'')', 'v_role NOT IN (''administrator'',''user'')');
    src := replace(src, 'v_role NOT IN (''administrator'', ''elder'',''coordinator'')', 'v_role NOT IN (''administrator'', ''user'')');
    src := replace(src, 'v_user_role NOT IN (''administrator'', ''elder'', ''coordinator'')', 'v_user_role NOT IN (''administrator'', ''user'')');
    src := replace(src, 'Solo un administrador o anciano puede confirmar la elegibilidad S-38-S.', 'Solo un usuario autorizado puede confirmar la elegibilidad S-38-S.');
    src := replace(src, 'Solo un administrador o anciano puede crear o renovar la revisión S-38-S.', 'Solo un usuario autorizado puede crear o renovar la revisión S-38-S.');
    src := replace(src, 'Solo un administrador o anciano puede confirmar Presidencia y Consejería.', 'Solo un usuario autorizado puede confirmar Presidencia y Consejería.');
    src := replace(src, 'Solo un administrador o anciano puede crear o renovar la revisión de Presidencia y Consejería.', 'Solo un usuario autorizado puede crear o renovar la revisión de Presidencia y Consejería.');
    src := replace(src, 'Solo un administrador o anciano puede confirmar la elegibilidad de %.', 'Solo un usuario autorizado puede confirmar la elegibilidad de %.');
    src := replace(src, 'Solo un administrador o anciano puede confirmar la elegibilidad de una intervención.', 'Solo un usuario autorizado puede confirmar la elegibilidad de una intervención.');
    src := replace(src, 'Solo un administrador o anciano puede confirmar la elegibilidad de una nueva intervención.', 'Solo un usuario autorizado puede confirmar la elegibilidad de una nueva intervención.');
    EXECUTE src;
  END LOOP;
END $$;

COMMIT;
