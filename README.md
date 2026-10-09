# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación (125 personas), preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto (Fase 4 Completada)

- **Congregación Objetivo:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas.
- **Rama principal:** `main` (desarrollo directo en `main`).
- **Pruebas unitarias:** Ejecutadas con **Vitest** (`npm test` - 53 pruebas automáticas pasando).
- **Identificadores UUID:** Cumplimiento estricto con UUID v4 RFC 4122 para `meeting_programs` y `assignment_slots` compatibles con PostgreSQL.
- **Auto-creación de Ciclos y Semestres:** Resolución y creación automática de UUIDs para `planning_cycles` y `history_periods` impidiendo registros huérfanos.
- **Transaccionalidad en Supabase:** Migración `005_save_meeting_program_transaction.sql` con la función RPC `save_meeting_program_transaction` para operaciones atómicas.
- **Semanas Especiales y Revisiones:** Manejo explícito por tipo de semana (`normal`, `circuit_overseer`, `assembly`, `memorial`) e invalidación de aprobaciones de elegibilidad al cambiar asignaciones (`invalidateReviewIfChanged`).
- **Endpoint y API S-140:** Cobertura de pruebas completa en `s140-route.test.ts` para respuestas 503, 401, 403, 404 y 200 con encabezados `Content-Disposition` y filtrado de intervenciones retiradas lógicamente.
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
