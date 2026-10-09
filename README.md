# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web para administrar el directorio de la congregación, preparar programas de la reunión Vida y Ministerio Cristianos, validar reglas S-38-S y generar el documento S-140.

## Estado de infraestructura — 9 de octubre de 2026

- **Base de datos Neon creada:** proyecto `Programacion_Vida_Ministerio`, región AWS São Paulo (`aws-sa-east-1`).
- **Base PostgreSQL:** `programacion_vida_ministerio` (PostgreSQL convierte los nombres no entrecomillados a minúsculas).
- **Autenticación Neon Auth y Data API:** configuradas.
- **Esquema:** migraciones 001 a 006 aplicadas, incluidas reglas de autorización por rol y la RPC transaccional para guardar programas.
- **Directorio importado y verificado:** 139 personas únicas: 12 ancianos, 7 siervos ministeriales, 22 precursores regulares, 128 activos y 11 inactivos. El estado de bautismo está en `NULL` para las 139 personas porque la fuente no lo especificaba.
- **Seguridad:** RLS está habilitado en las ocho tablas públicas de la aplicación. El acceso de usuarios requiere una cuenta Neon Auth y una fila activa en `public.app_users` con el rol correspondiente.

## Integración de la aplicación pendiente

La infraestructura y los datos ya están en Neon, pero el código de la interfaz todavía usa el cliente de Supabase (`@supabase/supabase-js` y `@supabase/ssr`). **No apuntes el sitio a los datos reales hasta completar y probar la sustitución del cliente y la autenticación por Neon.** Las URLs públicas de Neon están documentadas en `docs/NEON_SETUP.md`; las cadenas de conexión y secretos no se guardan en Git.

## Migraciones SQL

Las migraciones adaptadas para Neon están en `neon/migrations/`. Aplicarlas en orden a una base Neon nueva:

1. `001_initial_schema.sql`
2. `002_neon_auth_rls.sql`
3. `003_official_directory_and_titles.sql`
4. `004_assignment_eligibility_review.sql`
5. `005_save_meeting_program_transaction.sql`
6. `006_rpc_security_and_publication_guards.sql`

La importación validada está en `neon/imports/listado_unificado_las_violetas_2026_10_09.sql`. Requiere las migraciones 001 y 003 y aborta si `public.members` ya contiene registros; no borra ni sobreescribe datos existentes.

## Desarrollo

Requisitos: Node.js y npm.

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

La conexión real de la interfaz y las pruebas integrales de autenticación deben completarse antes de producción.
