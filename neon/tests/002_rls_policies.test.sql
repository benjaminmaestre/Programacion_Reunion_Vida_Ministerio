BEGIN;

SELECT plan(29);

-- Todas las tablas de aplicación usan RLS.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.app_users'::regclass), 'RLS habilitado: app_users');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.members'::regclass), 'RLS habilitado: members');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.member_eligibilities'::regclass), 'RLS habilitado: member_eligibilities');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.family_relationships'::regclass), 'RLS habilitado: family_relationships');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.planning_cycles'::regclass), 'RLS habilitado: planning_cycles');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.history_periods'::regclass), 'RLS habilitado: history_periods');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.meeting_programs'::regclass), 'RLS habilitado: meeting_programs');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.assignment_slots'::regclass), 'RLS habilitado: assignment_slots');

-- El rol anónimo no tiene acceso de lectura a ninguna tabla de la aplicación.
SELECT ok(NOT has_table_privilege('anonymous', 'public.app_users', 'SELECT'), 'anonymous no puede leer app_users');
SELECT ok(NOT has_table_privilege('anonymous', 'public.members', 'SELECT'), 'anonymous no puede leer members');
SELECT ok(NOT has_table_privilege('anonymous', 'public.member_eligibilities', 'SELECT'), 'anonymous no puede leer member_eligibilities');
SELECT ok(NOT has_table_privilege('anonymous', 'public.family_relationships', 'SELECT'), 'anonymous no puede leer family_relationships');
SELECT ok(NOT has_table_privilege('anonymous', 'public.planning_cycles', 'SELECT'), 'anonymous no puede leer planning_cycles');
SELECT ok(NOT has_table_privilege('anonymous', 'public.history_periods', 'SELECT'), 'anonymous no puede leer history_periods');
SELECT ok(NOT has_table_privilege('anonymous', 'public.meeting_programs', 'SELECT'), 'anonymous no puede leer meeting_programs');
SELECT ok(NOT has_table_privilege('anonymous', 'public.assignment_slots', 'SELECT'), 'anonymous no puede leer assignment_slots');

-- La aplicación no permite borrados ni cambios de rol desde el cliente.
SELECT ok(NOT has_table_privilege('authenticated', 'public.app_users', 'INSERT'), 'authenticated no puede crear perfiles ni autoasignarse rol');
SELECT ok(NOT has_table_privilege('authenticated', 'public.app_users', 'UPDATE'), 'authenticated no puede elevar su rol');
SELECT ok(NOT has_table_privilege('authenticated', 'public.app_users', 'DELETE'), 'authenticated no puede borrar perfiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.members', 'DELETE'), 'authenticated no puede borrar miembros');
SELECT ok(NOT has_table_privilege('authenticated', 'public.member_eligibilities', 'DELETE'), 'authenticated no puede borrar habilitaciones');
SELECT ok(NOT has_table_privilege('authenticated', 'public.family_relationships', 'DELETE'), 'authenticated no puede borrar relaciones familiares');
SELECT ok(NOT has_table_privilege('authenticated', 'public.planning_cycles', 'DELETE'), 'authenticated no puede borrar ciclos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.history_periods', 'DELETE'), 'authenticated no puede borrar períodos históricos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.meeting_programs', 'DELETE'), 'authenticated no puede borrar programas');
SELECT ok(NOT has_table_privilege('authenticated', 'public.assignment_slots', 'DELETE'), 'authenticated no puede borrar asignaciones');

-- El directorio permite al rol authenticated usar las operaciones necesarias, sujetas a RLS.
SELECT ok(has_table_privilege('authenticated', 'public.members', 'SELECT'), 'authenticated tiene permiso SQL SELECT para directorio');
SELECT ok(has_table_privilege('authenticated', 'public.members', 'INSERT'), 'authenticated tiene permiso SQL INSERT para directorio');
SELECT ok(has_table_privilege('authenticated', 'public.members', 'UPDATE'), 'authenticated tiene permiso SQL UPDATE para directorio');

SELECT * FROM finish();
ROLLBACK;
