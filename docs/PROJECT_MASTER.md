# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas registradas en el dataset oficial.
- **Estado de Pruebas:** 44 pruebas unitarias en Vitest (`npm test`), TypeScript sin errores (`npm run typecheck`) y build de producción Next.js limpio.
- **Avance global estimado:** 90% (Directorio, UUID v4 puros, persistencia inmediata, resolución de ciclos/semestres, motor S-38-S, baja lógica y S-140 integrados).

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
- [x] Migraciones `001_initial_schema.sql`, `002_single_congregation_auth_rls.sql`, `003_official_directory_and_titles.sql` y `004_assignment_eligibility_review.sql`.
- [x] Formato UUID v4 estricto para `meeting_programs.id` y `assignment_slots.id` en `program-builder.ts` y datos demo (sin prefijos incompatibles).
- [x] Persistencia inmediata en Supabase al crear un programa en modo conectado (`saveMeetingProgramToSupabase` + recarga verificada).
- [x] Resolución de UUIDs para `planning_cycles` y `history_periods` mediante las funciones `resolvePlanningCycleUuid` y `resolveHistoryPeriodUuid`.
- [x] Estructuras diferenciadas por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`).
- [x] Tipos de dominio `src/types/domain.ts` con estado de bautismo desconocido (`boolean | null`).
- [x] Motor de reglas S-38-S en `src/domain/rules/s38s-engine.ts` verificado con 17 pruebas unitarias.
- [x] Función e interfaz de importación oficial con previsualización dry-run, advertencias de duplicados y bloqueo de carga hasta confirmar instancia de destino (`member-importer.ts`).
- [x] Modo demo aislado con datos ficticios exclusivamente.
- [x] Gestión de nombramientos, precursorado regular, responsabilidades adicionales (Secretario) e inactivación/reactivación en `MembersWorkspace.tsx`.
- [x] Retiro lógico de asignaciones (`is_deleted: true`) sin borrado físico.
- [x] Endpoint autenticado `/api/programs/[programId]/s140` y pruebas unitarias de filtrado de asignaciones activas.
- [x] Pruebas unitarias completas: 44 pruebas en 7 archivos de prueba ejecutados por Vitest.
- [x] Workflow `.github/workflows/ci.yml` ejecutando `npm ci`, `npm run typecheck`, `npm test` y `npm run build`.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmación explícita de la instancia Supabase de destino antes de ejecutar migraciones e importación real a la base de datos de producción.
- [ ] Inspección visual del renderizado DOCX S-140 generado con Microsoft Word / LibreOffice.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Fase 3: Corrección Crítica de Identificadores UUID, Persistencia Imediata y Resolución de Ciclos
- **Identificadores UUID v4:** Se corrigió el generador en `program-builder.ts` y `programs-demo-data.ts` eliminando prefijos incompatibles (`prog-`, `slot-`).
- **Persistencia Inmediata:** La creación de nuevas reuniones en modo conectado guarda inmediatamente en Supabase y recarga la lista para verificar coincidencia.
- **Resolución de Ciclos y Semestres:** `programs-repository.ts` resuelve y asigna las claves UUID de `planning_cycles` y `history_periods` manteniendo las etiquetas visibles (`2026-6`, `2026-S2`).
- **Tipos de Semana:** Estructuras configuradas para semanas normales, visita de circuito (discurso de 30 min), asambleas y conmemoración.
- **Pruebas Automatizadas:** 44 pruebas unitarias en Vitest pasando al 100%. TypeScript y build de producción limpios.
