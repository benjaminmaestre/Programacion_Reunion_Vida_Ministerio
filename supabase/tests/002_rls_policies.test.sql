BEGIN;

SELECT plan(30);

-- RLS debe estar habilitado en todas las tablas del esquema expuesto.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.congregations'::regclass), 'RLS habilitado: congregations');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.congregation_users'::regclass), 'RLS habilitado: congregation_users');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.members'::regclass), 'RLS habilitado: members');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.member_eligibilities'::regclass), 'RLS habilitado: member_eligibilities');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.family_relationships'::regclass), 'RLS habilitado: family_relationships');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.planning_cycles'::regclass), 'RLS habilitado: planning_cycles');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.history_periods'::regclass), 'RLS habilitado: history_periods');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.meeting_programs'::regclass), 'RLS habilitado: meeting_programs');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.assignment_slots'::regclass), 'RLS habilitado: assignment_slots');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_logs'::regclass), 'RLS habilitado: audit_logs');

-- El rol público anónimo no tiene SELECT sobre ninguna de estas tablas.
SELECT ok(NOT has_table_privilege('anon', 'public.congregations', 'SELECT'), 'anon no puede leer congregations');
SELECT ok(NOT has_table_privilege('anon', 'public.congregation_users', 'SELECT'), 'anon no puede leer congregation_users');
SELECT ok(NOT has_table_privilege('anon', 'public.members', 'SELECT'), 'anon no puede leer members');
SELECT ok(NOT has_table_privilege('anon', 'public.member_eligibilities', 'SELECT'), 'anon no puede leer member_eligibilities');
SELECT ok(NOT has_table_privilege('anon', 'public.family_relationships', 'SELECT'), 'anon no puede leer family_relationships');
SELECT ok(NOT has_table_privilege('anon', 'public.planning_cycles', 'SELECT'), 'anon no puede leer planning_cycles');
SELECT ok(NOT has_table_privilege('anon', 'public.history_periods', 'SELECT'), 'anon no puede leer history_periods');
SELECT ok(NOT has_table_privilege('anon', 'public.meeting_programs', 'SELECT'), 'anon no puede leer meeting_programs');
SELECT ok(NOT has_table_privilege('anon', 'public.assignment_slots', 'SELECT'), 'anon no puede leer assignment_slots');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'SELECT'), 'anon no puede leer audit_logs');

-- Los usuarios autenticados no borran registros históricos desde el navegador.
SELECT ok(NOT has_table_privilege('authenticated', 'public.congregations', 'DELETE'), 'authenticated no puede borrar congregations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.congregation_users', 'DELETE'), 'authenticated no puede borrar membresías ni autoelevar permisos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.members', 'DELETE'), 'authenticated no puede borrar miembros');
SELECT ok(NOT has_table_privilege('authenticated', 'public.member_eligibilities', 'DELETE'), 'authenticated no puede borrar habilitaciones');
SELECT ok(NOT has_table_privilege('authenticated', 'public.family_relationships', 'DELETE'), 'authenticated no puede borrar relaciones familiares');
SELECT ok(NOT has_table_privilege('authenticated', 'public.planning_cycles', 'DELETE'), 'authenticated no puede borrar ciclos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.history_periods', 'DELETE'), 'authenticated no puede borrar períodos históricos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.meeting_programs', 'DELETE'), 'authenticated no puede borrar programas');
SELECT ok(NOT has_table_privilege('authenticated', 'public.assignment_slots', 'DELETE'), 'authenticated no puede borrar asignaciones');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'), 'authenticated no puede borrar auditoría');

SELECT * FROM finish();
ROLLBACK;
