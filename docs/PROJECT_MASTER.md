# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas registradas en el dataset oficial.
- **Estado:** Motor S-38-S con pruebas unitarias; el importador está disponible como función protegida, pero el flujo visual de importación quedó deshabilitado mientras se implementa una ruta administrativa segura. El editor de programas ya usa el repositorio Supabase cuando está configurado; no se ha probado contra una base de datos real.
- **CI:** los últimos cambios están en verificación; no declarar éxito hasta que termine la ejecución del commit actual.
- **Avance global estimado:** no recalculado; la persistencia real y la impresión S-140 requieren pruebas de integración.

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
- [x] Migraciones `001_initial_schema.sql`, `002_single_congregation_auth_rls.sql`, `003_official_directory_and_titles.sql` y `004_assignment_eligibility_review.sql` (004 aún no aplicada a una base real).
- [x] Tipos de dominio `src/types/domain.ts` con estado de bautismo desconocido (`boolean | null`).
- [x] Motor de reglas S-38-S en `src/domain/rules/s38s-engine.ts` verificado con 17 pruebas unitarias.
- [x] Función de importación oficial protegida por rol y validación estructural en `src/features/members/member-importer.ts`.
- [ ] Flujo visual de importación: temporalmente deshabilitado hasta implementarlo fuera del bundle cliente, con autorización y confirmación explícita.
- [x] Modo demo sin persistencia local; se elimina la clave heredada `s140-directory-demo-v1` para retirar nombres reales que pudieran haberse almacenado en versiones previas. En producción, si Supabase no está configurado, la aplicación muestra error y no abre demo.
- [x] Gestión de nombramientos, precursorado regular, responsabilidades adicionales (Secretario) e inactivación/reactivación en `MembersWorkspace.tsx`.
- [x] Editor conectado a carga/guardado de Supabase, edición de títulos y participantes, bloqueo de publicación en modo demo y vista de solo lectura para programas publicados.
- [x] Prueba del repositorio con cliente Supabase simulado: guarda un título personalizado y lo recupera mediante la función de lectura; también verifica el bloqueo de programas publicados.
- [x] Endpoint autenticado de generación DOCX S-140 y botón para generar desde el programa persistido.
- [x] Validación conservadora de publicación: titular activo, compatibilidad básica, ayudante cuando corresponde y confirmación humana S-38-S.
- [ ] Aplicar migración `004_assignment_eligibility_review.sql` en el proyecto Supabase definitivo antes de probar persistencia de revisión/baja lógica.
- [x] Generador DOCX S-140 en `src/features/printing/s140-docx-generator.ts`.
- [x] Workflow `.github/workflows/ci.yml` ejecutando `npm ci`, `npm run typecheck`, `npm test` y `npm run build`.

### Pendientes / Siguientes pasos prioritarios
- [ ] Confirmar el proyecto Supabase de destino antes de aplicar migraciones 003/004 o importar el directorio real.
- [ ] Probar de extremo a extremo guardar/recargar/publicar en Supabase real; el CI no sustituye esta prueba.
- [ ] Excepciones del calendario (Visita del Superintendente de Circuito, Asamblea de Circuito/Regional, Conmemoración).
- [ ] Renderizado fiel del formulario S-140 para impresión final en DOCX/PDF.
- [x] Pruebas del repositorio con un cliente Supabase simulado.
- [ ] Prueba real de ida/vuelta y renderizado visual del DOCX cuando exista un entorno Supabase de prueba autorizado.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. Inactivar a una persona retira su visibilidad para nuevas asignaciones sin destruir su historial acumulado.

## 6. Registro de avances

### 9 de octubre de 2026 — Importación del directorio, bautismo desconocido y títulos de asignación
- Se completó el importador oficial de 125 personas (`member-importer.ts`) respetando exactamente 12 ancianos, 7 siervos ministeriales, 22 precursores regulares, 87 publicadores, 3 roles combinados (Anciano/SM + PR) y 1 rol de Secretario.
- Se aisló completamente el modo demo para usar únicamente nombres ficticios (`DEMO_MEMBERS`).
- Se corrigió el modelo, repositorio e interfaz para soportar estado de bautismo desconocido (`boolean | null`) sin asumir bautismo predeterminado.
- Se conectó `assignment_type` a `assignment_slots` permitiendo editar y conservar títulos personalizados de cada intervención según la Guía de actividades.
- Se añadieron 26 pruebas unitarias automáticas en Vitest que pasaron al 100%. Typecheck y build exitosos.


### 9 de octubre de 2026 — Aislamiento de demo y persistencia de programas
- El modo demo ya no lee ni escribe el directorio en `localStorage`; al iniciar elimina la clave heredada que pudo contener registros oficiales.
- Se retiró la importación oficial del componente cliente; la función de importación exige un usuario autorizado y bloquea estructuras inválidas. La interfaz de importación sigue pendiente de un flujo seguro.
- `ProgramsWorkspace.tsx` carga miembros/programas de Supabase, edita títulos y participantes, guarda borradores y verifica la lectura posterior al guardado. En desarrollo puede mostrar datos ficticios en memoria; en producción, sin Supabase, falla de forma explícita.
- Se añadieron confirmación humana de elegibilidad S-38-S, migración 004 y baja lógica para no hacer borrados físicos de intervenciones.
- Se añadieron pruebas unitarias para validación previa a publicación. No se ha aplicado la migración 004 ni se ha verificado una ida/vuelta contra Supabase real.


### 9 de octubre de 2026 — Guardado verificable, ciclos UUID y salida S-140
- El repositorio separa las etiquetas visibles de ciclo/semestre de sus UUID reales de PostgreSQL; los campos de relación ya no intentan guardar textos como `2026-6` en columnas UUID.
- El guardado mantiene el programa como borrador hasta que todas las intervenciones se hayan guardado; las intervenciones retiradas del borrador usan baja lógica, no borrado físico.
- Se añadió una prueba de ida/vuelta con un cliente Supabase simulado para título y tipo de asignación. Esta prueba no reemplaza la comprobación contra una instancia Supabase real.
- Se añadió una ruta autenticada para generar el DOCX S-140 a partir de los títulos guardados. El resultado visual de la plantilla todavía requiere inspección.
