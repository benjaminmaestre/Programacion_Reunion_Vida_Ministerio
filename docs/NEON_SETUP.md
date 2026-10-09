# Configuración de Neon para Programacion_Vida_Ministerio

## Proyecto y base de datos

- Proyecto Neon: `Programacion_Vida_Ministerio`
- Project ID: `curly-voice-68375078`
- Rama principal: `main`
- Branch ID: `br-tiny-pine-b6lbs8l0`
- Región: AWS South America East (São Paulo), `aws-sa-east-1`
- Nombre PostgreSQL interno: `programacion_vida_ministerio`

## Endpoints públicos de servicio

- Neon Data API: `https://ep-dark-hall-b6qitq6a.apirest.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/rest/v1`
- Neon Auth: `https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth`
- JWKS: `https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth/.well-known/jwks.json`

Las URLs son identificadores públicos de endpoint; **no son credenciales**. No publiques contraseñas de roles ni cadenas de conexión de PostgreSQL.

## Variables que requerirá el frontend tras la migración

```dotenv
NEXT_PUBLIC_NEON_DATA_API_URL=https://ep-dark-hall-b6qitq6a.apirest.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/rest/v1
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth
NEON_AUTH_BASE_URL=https://ep-dark-hall-b6qitq6a.neonauth.c-2.sa-east-1.aws.neon.tech/programacion_vida_ministerio/auth
```

La integración server-side de Neon Auth también puede requerir `NEON_AUTH_COOKIE_SECRET`; debe generarse en el entorno de despliegue y no almacenarse en Git. Antes de usar producción, registrar el origen final de la aplicación en los dominios confiables de Neon Auth y crear/asignar el primer usuario administrador.

## Estado de seguridad y datos

- Neon Auth usa Better Auth y sus usuarios tienen UUID.
- La API de datos tiene como rol anónimo `anonymous`; no se concedieron privilegios públicos por defecto.
- RLS está activado en `app_users`, `members`, `member_eligibilities`, `family_relationships`, `planning_cycles`, `history_periods`, `meeting_programs` y `assignment_slots`.
- La autorización distingue `administrator`, `elder`, `coordinator` y `viewer` mediante `public.app_users`.
- El sitio web aún debe migrar sus clientes de Supabase a Neon antes de poder usar esta base de datos.
