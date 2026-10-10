# Configuración de Neon — Programacion_Vida_Ministerio

## Proyecto y base de datos
- Proyecto: `Programacion_Vida_Ministerio`
- ID de proyecto: `curly-voice-68375078`
- Rama principal: `main` (`br-tiny-pine-b6lbs8l0`)
- Región: AWS South America East (São Paulo), `aws-sa-east-1`
- Base PostgreSQL: `programacion_vida_ministerio`
- PostgreSQL: versión 17

## Endpoints
- Data API: `https://ep-dark-hall-b6qitq6a.apirest.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/rest/v1`
- Auth: `https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth`
- JWKS: `https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth/.well-known/jwks.json`

## Variables de entorno para Vercel
Crear las siguientes variables en Preview, Development y Production:

```dotenv
NEXT_PUBLIC_NEON_DATA_API_URL=https://ep-dark-hall-b6qitq6a.apirest.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/rest/v1
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth
NEON_AUTH_BASE_URL=https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth
NEON_AUTH_COOKIE_SECRET=<secreto aleatorio de al menos 32 caracteres>
```

Estas cuatro variables ya están configuradas en Vercel para Production, Preview y Development; `NEON_AUTH_COOKIE_SECRET` y `NEON_AUTH_BASE_URL` están marcadas como sensibles. El cliente usa el proxy de mismo origen `/api/auth`. El origen `https://programacion-vida-ministerio.vercel.app` ya está agregado a los orígenes confiables de Neon Auth. Si se conecta un dominio personalizado, agrega también su origen exacto.

## Estado de la migración
- Esquema SQL 001–006 aplicado.
- Neon Auth (Better Auth) y Neon Data API activos.
- 139 registros de directorio verificados: 12 ancianos, 7 siervos ministeriales, 22 precursores regulares, 128 activos y 11 inactivos.
- RLS habilitado en las ocho tablas públicas y 22 políticas creadas.
- El frontend usa `@neondatabase/neon-js`; la autenticación se enruta por `/api/auth`.
- Proyecto Vercel vinculado al repositorio y desplegado: `https://programacion-vida-ministerio.vercel.app`.
- El dominio de producción es público; los despliegues de Preview conservan la protección SSO.
- La API de generación S-140 requiere un JWT de Neon Auth y consulta exclusivamente mediante Data API/RLS.
- Los usuarios de Supabase Auth no conservan sus contraseñas al cambiar a Neon Auth. Cada usuario debe crear nuevas credenciales.
- Una cuenta recién creada no obtiene una membresía ni rol de aplicación. Para autorizarla, un administrador debe insertar su UUID en `public.app_users` tras comprobar su identidad.

## Migraciones reproducibles
Las migraciones están en `neon/migrations/` en orden 001–006. La importación inicial está en `neon/imports/listado_unificado_las_violetas_2026_10_09.sql` y aborta si la tabla ya contiene personas.
