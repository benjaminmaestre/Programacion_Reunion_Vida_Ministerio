# Configuración de Supabase

Esta guía conecta el prototipo con una base de datos real. No aplicar la migración a un proyecto Supabase hasta confirmar que es el proyecto correcto: el conector puede mostrar bases de datos de otras aplicaciones.

## 1. Dependencias y variables

El proyecto fija las dependencias `@supabase/ssr`, `@supabase/supabase-js` y `server-only` en `package.json` y `package-lock.json`.

Copia `.env.example` a `.env.local` y reemplaza los marcadores por los valores de **Project Settings → API / Connect** del proyecto correcto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No uses una clave `service_role` ni una secret key en variables `NEXT_PUBLIC_*`. La clave publicable se entrega al navegador; los permisos deben depender de Supabase Auth y RLS.

## 2. Aplicar las migraciones

En un entorno local correctamente enlazado al proyecto Supabase confirmado:

1. Revisa `supabase --help` y los subcomandos disponibles en la versión instalada.
2. Comprueba primero el estado y las migraciones existentes. No ejecutes a ciegas sobre una base que ya tiene tablas o datos.
3. Aplica de forma ordenada `supabase/migrations/001_initial_schema.sql` y `supabase/migrations/002_congregations_memberships_rls.sql`, usando el flujo de migraciones documentado para esa versión del CLI.
4. Ejecuta las pruebas SQL de `supabase/tests/002_rls_policies.test.sql` con `supabase test db` en una base local o entorno de prueba.
5. Revisa los asesores de seguridad/performance disponibles en el CLI, corrige alertas pertinentes y verifica el resultado con consultas de prueba.

La migración 002 mueve los registros de esquema inicial existentes a una congregación temporal con slug `configuracion-inicial`, cuando haya tablas con datos sin congregación. No borra registros. Los datos de esa congregación permanecen inaccesibles a través del Data API hasta asignar una membresía autorizada.

## 3. Crear/invitar el primer usuario administrador

1. En Supabase Auth, crea o invita al usuario que administrará esta instalación.
2. Abre el SQL Editor del **proyecto correcto**, revisa el correo y ejecuta el siguiente SQL reemplazando ambos marcadores explícitamente.

```sql
-- Ejecutar una sola vez como administrador de la base de datos.
-- Sustituye el nombre y correo y comprueba que el SELECT devuelve una fila.
UPDATE public.congregations
SET name = 'NOMBRE DE LA CONGREGACIÓN', updated_at = now()
WHERE slug = 'configuracion-inicial';

INSERT INTO public.congregation_users (congregation_id, user_id, role, created_by)
SELECT c.id, u.id, 'administrator', u.id
FROM public.congregations AS c
CROSS JOIN auth.users AS u
WHERE c.slug = 'configuracion-inicial'
  AND lower(u.email) = lower('CORREO-DEL-ADMINISTRADOR')
ON CONFLICT (congregation_id, user_id)
DO UPDATE SET role = 'administrator', is_active = true;
```

Verifica después que exactamente una membresía activa tenga el usuario esperado. No expongas las herramientas administrativas del SQL Editor dentro de la aplicación ni habilites auto-registro público.

Para una instalación nueva sin filas previas, renombra la congregación temporal con el nombre correcto y añade el administrador como se muestra arriba.

## 4. Roles iniciales

- `administrator`: administración de la instalación y datos.
- `elder`: gestiona datos y asignaciones autorizadas.
- `coordinator`: administra el directorio y programa según las reglas implementadas.
- `viewer`: consulta datos según las políticas aplicables.

La tabla `congregation_users` no permite que el navegador conceda o eleve sus propios privilegios. La primera membresía se agrega por un proceso administrativo confiable. El acceso entre congregaciones se filtra mediante `congregation_id` y políticas RLS.

## 5. Modo de la aplicación

- Si faltan las variables, se abre el modo demostración con nombres ficticios y guardado local.
- Si las variables están configuradas, la aplicación requiere inicio de sesión y una membresía activa.
- El directorio real consulta PostgreSQL; los cambios se guardan en Supabase.
- El historial consulta las asignaciones del período semestral activo.
- Los errores de permisos no deben solventarse desactivando RLS ni exponiendo `service_role`.

## 6. Comprobaciones pendientes de ejecución

Esta guía y los archivos de migración están preparados en el repositorio. Hasta que la migración se aplique a un proyecto confirmado, se configure `.env.local` y se ejecuten los tests sobre una base de datos, no afirmar que el despliegue real de Supabase está operativo.
