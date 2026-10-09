# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas registradas en el dataset oficial.
- **Estado de Pruebas:** 42 pruebas unitarias en Vitest (`npm test`), TypeScript sin errores (`npm run typecheck`) y build de producción Next.js limpio.
- **Avance global estimado:** 85% (Directorio, motor de reglas S-38-S, creador de programas, baja lógica, revisiones humanas y generador S-140 integrados).

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
- [x] Tipos de dominio `src/types/domain.ts` con estado de bautismo desconocido (`boolean | null`).
- [x] Motor de reglas S-38-S en `src/domain/rules/s38s-engine.ts` verificado con 17 pruebas unitarias.
- [x] Constructor de programas iniciales y calculador de ciclos/semestres en `src/features/programs/program-builder.ts` (3 pruebas unitarias).
- [x] Función e interfaz de importación oficial con previsualización dry-run, advertencias de duplicados y bloqueo de carga hasta confirmar instancia de destino (`member-importer.ts`).
- [x] Modo demo aislado con datos ficticios exclusivamente.
- [x] Gestión de nombramientos, precursorado regular, responsabilidades adicionales (Secretario) e inactivación/reactivación en `MembersWorkspace.tsx`.
- [x] Editor conectado a Supabase, creación de reuniones, selección de tipo de semana, edición de títulos y participantes, retiro lógico de asignaciones (`is_deleted`) y protección frente a doble clic.
- [x] Pruebas del repositorio con cliente Supabase simulado (4 pruebas unitarias): ida/vuelta de título y tipo, bloqueo de programas publicados, permisos de escritura y baja lógica sin borrado físico.
- [x] Endpoint autenticado `/api/programs/[programId]/s140` para la generación del documento DOCX S-140.
- [x] Validación de publicación previa: presidente activo, revisión humana de Presidencia/Consejería, titular activo, compatibilidad tipo/sección, ayudante cuando corresponde y confirmación humana S-38-S por intervención (9 pruebas unitarias).
- [x] Workflow `.github/workflows/ci.yml` ejecutando `npm ci`, `npm run typecheck`, `npm test` (42 pruebas) y `npm run build`.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmar expresamente la instancia Supabase de destino antes de aplicar migraciones y realizar la importación real de las 125 personas a la base de datos.
- [ ] Excepciones del calendario (Visita del Superintendente de Circuito, Asamblea de Circuito/Regional, Conmemoración).
- [ ] Inspección visual del renderizado DOCX S-140 generado con Microsoft Word / LibreOffice.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Fase 2: Ciclo de Vida de Programas, Creador de Reuniones y Baja Lógica
- Se implementó el constructor de programas `program-builder.ts` para calcular automáticamente los ciclos bimestrales (`2026-6`) y períodos semestrales (`2026-S2`), inicializando programas borradores con intervenciones estándar.
- Se incorporó la creación de nuevas reuniones desde la interfaz y el retiro lógico de asignaciones (`is_deleted: true`).
- Se reforzó la protección contra operaciones simultáneas / doble clic en guardado y generación S-140.
- Se agregaron pruebas para `program-builder` alcanzando **42 pruebas automáticas en Vitest** pasando al 100%. TypeScript y build de producción sin advertencias ni errores.
