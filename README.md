# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación (125 personas), preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto (Endurecimiento posterior a Fase 5)

- **Congregación Objetivo:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas.
- **Rama principal:** `main` (desarrollo directo en `main`).
- **Pruebas unitarias:** Ejecutadas con **Vitest** (`npm test` - 54 pruebas automáticas pasando al 100%).
- **Seguridad RPC SECURITY DEFINER:** Funciones en `005_save_meeting_program_transaction.sql` protegidas con `search_path = public, pg_temp`, revocación de permisos a `PUBLIC`/`anon`, comprobación interna de `auth.uid()` contra la tabla `app_users` y sobrescritura segura de campos de auditoría.
- **Eliminación del Fallback Inseguro:** Remoción total de escrituras directas múltiples no atómicas en `programs-repository.ts`, exigiendo exclusivamente la llamada RPC `save_meeting_program_transaction`.
- **Identificadores UUID:** Cumplimiento estricto con UUID v4 RFC 4122 para `meeting_programs` y `assignment_slots` compatibles con PostgreSQL.
- **Auto-creación de Ciclos y Semestres:** Resolución y creación automática de UUIDs para `planning_cycles` y `history_periods` impidiendo registros huérfanos.
- **Semanas Especiales y Revisiones:** Manejo explícito por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`) e invalidación de aprobaciones de elegibilidad al cambiar asignaciones (`invalidateReviewIfChanged`).
- **Endpoint y API S-140:** Cobertura de pruebas completa en `s140-route.test.ts` para respuestas 503, 401, 403, 404, 500 y 200 (con validación de cabeceras HTTP y bytes mágicos `PK\x03\x04` del contenedor DOCX).
- **Motor S-38-S:** Validaciones citando párrafos oficiales del S-38-S y revisiones humanas de elegibilidad.

## Requisitos e Instalación

- Node.js 18+ o superior.
- npm.

```bash
# Instalación de dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# Ejecutar pruebas unitarias
npm test

# Comprobar tipos TypeScript y build de producción
npm run typecheck
npm run build
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Documentación Principal

Toda la especificación técnica, decisiones arquitectónicas, esquema SQL y registro de avances se encuentran documentados en:
📍 [docs/PROJECT_MASTER.md](docs/PROJECT_MASTER.md)

## Fuentes Funcionales Oficiales

- `templates/S-140_S.docx`: plantilla oficial de impresión S-140.
- `templates/S-38_S.pdf`: instrucciones oficiales de la reunión Vida y Ministerio.
- `src/features/members/official-directory-data.ts`: dataset unificado oficial de 125 personas de la Congregación Las Violetas.


## Pendientes antes de producción

- La migración 006 está en Git, pero todavía no se ha aplicado a un proyecto Supabase real.
- Falta probar permisos RLS/RPC, atomicidad y concurrencia contra una instancia autorizada.
- Falta la inspección visual del DOCX S-140 en Word o LibreOffice.
- No importar el directorio oficial de 125 personas hasta confirmar y validar el proyecto Supabase de destino.
