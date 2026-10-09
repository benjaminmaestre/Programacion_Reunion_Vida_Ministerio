# Configuración de Supabase — una congregación

Esta aplicación se ha diseñado para **una sola congregación con aproximadamente 100 participantes**. No usa una arquitectura multi-tenant: no hay tabla de congregaciones ni una columna `congregation_id` repetida en todas las tablas. El acceso se controla mediante Supabase Auth, la tabla `app_users` y políticas RLS.

No aplicar la migración a un proyecto Supabase hasta confirmar que ese es el proyecto destinado a esta aplicación.

## 1. Dependencias y variables

El proyecto fija `@supabase/ssr`, `@supabase/supabase-js` y `server-only` en `package.json` y `package-lock.json`.

Copia `.env.example` a `.env.local` y configura estos valores desde **Project Settings → API / Connect** del proyecto Supabase correcto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca pongas una clave `service_role` ni una secret key en una variable `NEXT_PUBLIC_*`. La clave publicable se envía al navegador; la seguridad depende de Auth y RLS.

## 2. Migraciones

En un entorno local o de prueba enlazado con el proyecto correcto:

1. Revisa `supabase --help` y los subcomandos disponibles en la versión instalada del CLI.
2. Comprueba las tablas existentes y el estado de las migraciones antes de ejecutar DDL. No ejecutes a ciegas sobre una base con datos.
3. Aplica `supabase/migrations/001_initial_schema.sql` si el esquema inicial todavía no existe.
4. Aplica `supabase/migrations/002_single_congregation_auth_rls.sql` para añadir los roles y políticas de seguridad.
5. Ejecuta `supabase/tests/002_rls_policies.test.sql` contra una base local o entorno de prueba y revisa los asesores de seguridad de Supabase.

La migración 002 no borra los miembros ni los programas existentes. Añade `app_users`, activa RLS en las tablas de aplicación y revoca el acceso anónimo. No se han aplicado estas migraciones a ningún proyecto conectado desde esta sesión.

## 3. Crear el primer administrador

1. Invita o crea el usuario en **Supabase Dashboard → Authentication**.
2. En el SQL Editor del proyecto correcto, sustituye el marcador de correo y ejecuta:

```sql
INSERT INTO public.app_users (user_id, display_name, role, is_active)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.email),
  'administrator',
  TRUE
FROM auth.users AS u
WHERE lower(u.email) = lower('CORREO-DEL-ADMINISTRADOR')
ON CONFLICT (user_id)
DO UPDATE SET role = 'administrator', is_active = TRUE, updated_at = NOW()
RETURNING user_id, display_name, role, is_active;
```

Verifica que devuelve exactamente el usuario previsto. Ejecuta este procedimiento solamente desde un entorno administrativo confiable; la aplicación no concede a los usuarios permisos para insertar o modificar su propia fila de `app_users`.

## 4. Roles de la aplicación

- `administrator`: administración del directorio.
- `elder`: administración del directorio y acceso a información de habilitaciones/relaciones familiares.
- `coordinator`: mantenimiento del directorio y preparación de programas.
- `viewer`: consulta sin permisos de escritura.

La matriz exacta de permisos puede ajustarse al modelo real de responsabilidades. Las políticas RLS de PostgreSQL son la barrera definitiva; ocultar botones en la interfaz no se considera seguridad.

## 5. Modo de la aplicación

- Sin variables de entorno, se abre el modo de demostración con nombres ficticios y guardado local.
- Con variables configuradas, la aplicación exige iniciar sesión.
- Si la cuenta no tiene un registro activo en `app_users`, se muestra una pantalla que explica que el administrador debe configurarla.
- En modo conectado, el directorio y su historial consultan PostgreSQL; los cambios se guardan en Supabase.
- El modo demo no se debe usar con datos personales reales.

## 6. Verificaciones pendientes

Aunque el código de conexión, la migración y las pruebas SQL estén versionados, la integración no se considera desplegada hasta que:

- Se confirme el proyecto Supabase correcto.
- Se configuren las variables de entorno.
- Se apliquen las migraciones sin errores.
- Se cree el primer usuario autorizado.
- Pasen `npm ci`, `npm run typecheck` y `npm run build`.
- Pasen las pruebas RLS con usuarios de diferentes roles.
