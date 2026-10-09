# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas registradas en el dataset oficial.
- **Estado de Pruebas:** 54 pruebas unitarias en Vitest (`npm test`), TypeScript sin errores (`npm run typecheck`) y build de producción Next.js totalmente limpio (`npm run build`).
- **Avance global estimado:** 100% en lógica de aplicación, validaciones S-38-S, transaccionalidad RPC, seguridad RLS y pruebas automatizadas (pendiente confirmación de instancia de producción Supabase para despliegue de migraciones y carga de 125 miembros).

## 1. Objetivo

Centralizar el directorio de hermanos y hermanas de la Congregación Las Violetas, preparar programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S, mantener memoria histórica semestral sin borrar el historial previo y producir el documento S-140 desde la plantilla fuente.

El sistema ayuda a responsables autorizados a tomar decisiones; no infiere por sí mismo la competencia de una persona.

## 2. Alcance y arquitectura deliberada

**Solo hay una congregación.** La congregación cuenta con 125 personas únicas. Los datos viven en una única base de datos y el acceso se controla con Supabase Auth, la tabla `app_users` y RLS.

Roles iniciales de aplicación:
- `administrator`: administración del sistema y del directorio.
- `elder`: acceso de administración y a información de habilitaciones/relaciones familiares.
- `coordinator`: mantenimiento del directorio y preparación de programas.
- `viewer`: consulta.

La primera cuenta autorizada se agrega administrativamente a `app_users`. El cliente no puede autoasignarse un rol.

## 3. Fuentes funcionales

- `templates/S-140_S.docx`: plantilla fuente de impresión; conservar sin modificar.
- `templates/S-38_S.pdf`: instrucciones de la reunión, revisión 8/26.
- `src/features/members/official-directory-data.ts`: dataset unificado oficial de 125 personas (12 ancianos, 7 siervos ministeriales, 22 precursores regulares, 87 publicadores sin nombramiento/precursorado, 3 roles combinados nombramiento+PR y 1 responsabilidad adicional de Secretario).

## 4. Estado verificable

### Existente y Verificado en el Repositorio
- [x] Migración `005_save_meeting_program_transaction.sql` reforzada con `SET search_path = public, pg_temp`, revocación de ejecuciones a `PUBLIC`/`anon`, verificación de `auth.uid()` e historial de auditoría de revisiones.
- [x] Eliminación total de fallbacks inseguros en `programs-repository.ts` exigiendo la función RPC atómica `save_meeting_program_transaction`.
- [x] Formato UUID v4 estricto para `meeting_programs.id` y `assignment_slots.id` en `program-builder.ts` y datos demo.
- [x] Auto-creación estricta y resolución de UUIDs para `planning_cycles` y `history_periods`.
- [x] Reglas estrictas por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`) en `program-validation.ts`.
- [x] Pruebas completas del Route Handler S-140 (`s140-route.test.ts`) cubriendo respuestas 503, 401, 403, 404, 500 y 200 con verificación de firma de bytes mágicos `PK\x03\x04` en el contenedor DOCX.
- [x] Modo demo aislado con datos ficticios exclusivamente y protección contra escrituras accidentales.
- [x] Suite de pruebas automatizadas: 54 pruebas unitarias en 7 archivos pasando al 100%.
- [x] Compilación TypeScript (`npm run typecheck`) y Next.js build de producción sin advertencias ni errores.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmación explícita de la instancia Supabase de destino para ejecución de migraciones 001-005 e importación real del directorio de 125 personas.
- [ ] Inspección visual final del documento DOCX generado mediante Microsoft Word / LibreOffice.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Fase 5: Seguridad RPC, Integridad Transaccional y Validación Final
- **Seguridad en RPC `SECURITY DEFINER`:** En `005_save_meeting_program_transaction.sql`, se revocó el permiso de ejecución a `PUBLIC` y `anon`, otorgándolo exclusivamente a `authenticated`. Se fijó `search_path = public, pg_temp;` y se incluyeron comprobaciones internas de `auth.uid()` contra la tabla `app_users` para verificar roles activos (`administrator`, `elder`, `coordinator`).
- **Trazabilidad de Auditoría:** Las confirmaciones de revisión humana sobrescriben la identidad con `auth.uid()` y la fecha con `NOW()`, impidiendo la falsificación de auditoría desde el cliente.
- **Eliminación del Fallback Inseguro:** Se eliminó el camino de escrituras directas múltiples de `programs-repository.ts`. Si la RPC falla o no está desplegada, la operación se detiene y retorna una excepción atómica.
- **Validaciones de Semanas Especiales:** Se reforzó la obligatoriedad del título del discurso en visitas de circuito y las reglas especiales en asambleas y conmemoración.
- **Pruebas S-140 Extremo a Extremo:** `s140-route.test.ts` verifica los códigos HTTP 503, 401, 403, 404, 500 y 200, validando la firma de bytes `PK\x03\x04` del archivo DOCX.
- **Verificación Completa:** 54 pruebas unitarias pasando al 100% en Vitest, TypeScript y Next.js build limpios.
