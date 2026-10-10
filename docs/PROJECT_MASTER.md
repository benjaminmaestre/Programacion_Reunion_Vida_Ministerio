# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 139 personas únicas registradas en el dataset oficial.
- **CI verificado:** el commit `a20a677` pasó 58 pruebas en 7 archivos, `npm run typecheck` y `npm run build` en GitHub Actions.
- **Estado de despliegue:** migración 006 preparada en Git; no aplicada ni ejecutada contra una instancia Neon real.
- **Avance global estimado:** no se declara porcentaje hasta validar las RPC, RLS, persistencia real y la salida visual S-140.

## 1. Objetivo

Centralizar el directorio de hermanos y hermanas de la Congregación Las Violetas, preparar programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S, mantener memoria histórica semestral sin borrar el historial previo y producir el documento S-140 desde la plantilla fuente.

El sistema ayuda a responsables autorizados a tomar decisiones; no infiere por sí mismo la competencia de una persona.

## 2. Alcance y arquitectura deliberada

**Solo hay una congregación.** La congregación cuenta con 139 personas únicas. Los datos viven en una única base de datos y el acceso se controla con Neon Auth, la tabla `app_users` y RLS.

Roles de aplicación (modelo simplificado de 2 roles según migración 007):
- `administrator`: administración suprema de cuentas y del directorio.
- `user`: gestión autorizada del directorio y preparación de programas.

La primera cuenta autorizada se agrega administrativamente a `app_users`. El cliente no puede autoasignarse un rol.

## 3. Fuentes funcionales

- `templates/S-140_S.docx`: plantilla fuente de impresión; conservar sin modificar.
- `templates/S-38_S.pdf`: instrucciones de la reunión, revisión 8/26.
- `src/features/members/official-directory-data.ts`: dataset unificado oficial de 139 personas (12 ancianos, 7 siervos ministeriales, 22 precursores regulares, 87 publicadores sin nombramiento/precursorado, 3 roles combinados nombramiento+PR y 1 responsabilidad adicional de Secretario).

## 4. Estado verificable

### Existente y Verificado en el Repositorio
- [x] Migración `005_save_meeting_program_transaction.sql` contiene la RPC inicial de guardado.
- [ ] Migración `006_rpc_security_and_publication_guards.sql` añade controles de rol, auditoría y publicación, además de restringir escrituras directas. Está preparada en Git, pero aún no se ha aplicado ni validado contra PostgreSQL real.
- [x] `programs-repository.ts` exige la RPC y no usa fallback de escrituras directas; la creación de ciclos y períodos se resuelve dentro de la transacción.
- [x] Formato UUID v4 estricto para `meeting_programs.id` y `assignment_slots.id` en `program-builder.ts` y datos demo.
- [x] Auto-creación estricta y resolución de UUIDs para `planning_cycles` y `history_periods`.
- [x] Validación para semanas especiales y requisitos de aviso; falta contrastar el comportamiento final contra una instancia real y las instrucciones aplicables.
- [x] Pruebas del Route Handler S-140 con Neon simulado para respuestas 503, 401, 403, 404, 500 y 200; la inspección visual frente a la plantilla sigue pendiente.
- [x] Modo demo aislado con datos ficticios exclusivamente.
- [x] CI del commit `a20a677`: 58 pruebas aprobadas, TypeScript y build de producción correctos.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmar la instancia Neon de destino y ejecutar las migraciones 001-006 en un entorno autorizado.
- [ ] Probar RPC, RLS, atomicidad, concurrencia y bloqueo de publicación directa contra PostgreSQL/Neon real.
- [ ] Inspección visual final del DOCX con Microsoft Word o LibreOffice.
- [ ] Mantener bloqueada la importación del directorio oficial de 139 personas hasta cerrar estas verificaciones.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Estabilización de Pruebas, Neon DB y Estilos de Administración
- **Alineación del Modelo de Roles en Pruebas:** Se actualizaron los datos ficticios en `programs-repository.test.ts` pasando del esquema obsoleto de 4 roles al modelo vigente de 2 roles (`administrator` y `user`). Se reescribió la prueba de intento de guardado sin permisos para validar que cuentas inactivas rechazan la operación lanzando `MembershipRequiredError`. `npm test` logró un 100% de éxito (59/59 pruebas pasadas).
- **Textos de Conexión:** Se actualizaron los textos de interfaz reemplazando referencias obsoletas a Supabase por la denominación correcta a Neon DB.
- **Estilos de Administración y Registro:** Se adaptaron las páginas `/admin/users` y `/auth/register` al sistema de diseño unificado, aplicando los tokens globales de color, fuentes `Instrument Sans` / `Newsreader`, bordes finos de 6px y componentes estándar (`gate-*`, `panel`, `button`, `button-primary`).

### 9 de octubre de 2026 — Rediseño de UI e Instalación de Tailwind v4
- **Instalación de Tailwind v4:** Se instaló `@tailwindcss/postcss` y `postcss`, creando `postcss.config.mjs` y configurando `@import "tailwindcss";` en `src/app/globals.css`. Se encapsularon todas las utilidades y componentes en `@layer components` para prevenir conflictos de precedencia. Se eliminó la librería obsoleta `tailwindcss-animate`.
- **Sistema de Diseño y Tipografía:** Se incorporaron las fuentes Google `Instrument Sans` y `Newsreader` mediante `next/font/google` en `src/app/layout.tsx`. Se actualizaron los tokens de color e imponen bordes finos de 1px sin sombras (`box-shadow: none`) ni degradados decorativos, manteniendo bordes redondeados strictly de 6px en controles.
- **Navegación Unificada:** Se integró la navegación en `src/app/page.tsx` con una barra lateral / rail común (`VM`, `Programas`, `Directorio` y `Usuarios`) y se eliminó el chrome propio (topbar/sidebar duplicado) en `MembersWorkspace.tsx`.
- **Rediseño de Programación:** Se transformó `ProgramsWorkspace.tsx` en una hoja de ruta con navegación bimestral por tira de semanas, secciones temáticas ("Tesoros de la Biblia", "Seamos mejores maestros", "Nuestra vida cristiana"), hilo conector vertical y panel lateral con medidores de avance.
- **Sin Alteración de Lógica Interna:** Se preservaron sin tocar todos los módulos de dominio, funciones de repositorio, RPC, seguridad Neon, validaciones y generación de S-140.

### 9 de octubre de 2026 — Fase 5: Seguridad RPC, Integridad Transaccional y Validación Final
- **Seguridad en RPC `SECURITY DEFINER`:** En `005_save_meeting_program_transaction.sql`, se revocó el permiso de ejecución a `PUBLIC` y `anon`, otorgándolo exclusivamente a `authenticated`. Se fijó `search_path = public, pg_temp;` y se incluyeron comprobaciones internas de `auth.uid()` contra la tabla `app_users` para verificar roles activos (`administrator`, `elder`, `coordinator`).
- **Trazabilidad de Auditoría:** Las confirmaciones de revisión humana sobrescriben la identidad con `auth.uid()` y la fecha con `NOW()`, impidiendo la falsificación de auditoría desde el cliente.
- **Eliminación del Fallback Inseguro:** Se eliminó el camino de escrituras directas múltiples de `programs-repository.ts`. Si la RPC falla o no está desplegada, la operación se detiene y retorna una excepción atómica.
- **Validaciones de Semanas Especiales:** Se reforzó la obligatoriedad del título del discurso en visitas de circuito y las reglas especiales en asambleas y conmemoración.
- **Pruebas S-140 Extremo a Extremo:** `s140-route.test.ts` verifica los códigos HTTP 503, 401, 403, 404, 500 y 200, validando la firma de bytes `PK\x03\x04` del archivo DOCX.
- **Verificación Completa:** 54 pruebas unitarias pasando al 100% en Vitest, TypeScript y Next.js build limpios.
