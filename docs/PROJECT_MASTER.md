# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas registradas en el dataset oficial.
- **Estado de Pruebas:** 53 pruebas unitarias en Vitest (`npm test`), TypeScript sin errores (`npm run typecheck`) y build de producción Next.js totalmente limpio (`npm run build`).
- **Avance global estimado:** 95% (Estabilización Fase 4 completada: transaccionalidad RPC, auto-creación y unicidad de ciclos/períodos, validación estricta por tipos de semana, invalidación de revisiones humanas y pruebas de integración API S-140 para códigos HTTP 401, 403, 404 y 200).

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
- [x] Migraciones `001` a `005_save_meeting_program_transaction.sql` (unicidad en ciclos/períodos y procedimiento atómico RPC).
- [x] Formato UUID v4 estricto para `meeting_programs.id` y `assignment_slots.id` en `program-builder.ts` y datos demo (sin prefijos incompatibles).
- [x] Auto-creación estricta y resolución de UUIDs para `planning_cycles` y `history_periods` sin permitir guardados huérfanos.
- [x] Persistencia transaccional RPC `save_meeting_program_transaction` con fallback atómico.
- [x] Estructuras y reglas de validación diferenciadas por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`).
- [x] Distinción estructurada de errores bloqueantes (`errors`) y advertencias (`warnings`), más invalidación automática de revisiones humanas al modificar participantes.
- [x] Pruebas completas del Route Handler S-140 (`s140-route.test.ts`) cubriendo respuestas 503, 401, 403, 404 y 200 con encabezados y filtrado de intervenciones activas.
- [x] Modo demo aislado con datos ficticios exclusivamente y protección contra escrituras accidentales.
- [x] Suite de pruebas automatizadas: 53 pruebas unitarias en 7 archivos pasando al 100%.
- [x] Compilación TypeScript (`npm run typecheck`) y Next.js build de producción sin advertencias ni errores.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmación explícita de la instancia Supabase de destino para ejecución de migraciones e importación real del directorio de 125 personas.
- [ ] Inspección visual final del documento DOCX generado con Microsoft Word / LibreOffice.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Fase 4: Estabilización, Integridad de Datos y Verificación Integral
- **Auto-creación y unicidad de Ciclos/Períodos:** `resolvePlanningCycleUuid` y `resolveHistoryPeriodUuid` garantizan la creación automática o recuperación de UUIDs reales, impidiendo programas sin relaciones obligatorias.
- **Transaccionalidad en Supabase:** Creación de la migración `005_save_meeting_program_transaction.sql` con el procedimiento RPC atómico `save_meeting_program_transaction` y fallback seguro en el cliente.
- **Semanas Especiales y Revisiones:** Soporte completo de validación por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`) e invalidación de aprobaciones de elegibilidad al cambiar asignaciones (`invalidateReviewIfChanged`).
- **Pruebas de Integración Route Handler S-140:** Ampliación de `s140-route.test.ts` para validar códigos 503, 401, 403, 404 y 200 (headers y buffer DOCX).
- **Suite de Pruebas y Build:** 53 pruebas en Vitest pasando al 100%, `npm run typecheck` y `npm run build` sin errores.
