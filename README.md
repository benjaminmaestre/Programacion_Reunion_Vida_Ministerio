# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación (125 personas), preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto (Fase 3)

- **Congregación Objetivo:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas.
- **Rama principal:** `main` (desarrollo directo en `main`).
- **Pruebas unitarias:** Ejecutadas con **Vitest** (`npm test` - 44 pruebas automáticas pasando).
- **Identificadores UUID:** Cumplimiento estricto con UUID v4 RFC 4122 para `meeting_programs` y `assignment_slots` compatibles con PostgreSQL.
- **Persistencia en Supabase:** Creación de programas con persistencia inmediata y recarga verificada.
- **Resolución de Ciclos:** Mapeo de `planning_cycles` y `history_periods` a sus UUIDs en base de datos.
- **Semanas Especiales:** Variaciones para reuniones ordinarias, visita del superintendente de circuito, asambleas y conmemoración.
- **Motor S-38-S:** Validaciones citando párrafos oficiales del S-38-S y revisiones humanas de elegibilidad.
- **Generador S-140:** Endpoint `/api/programs/[programId]/s140` para la descarga directa del documento oficial en formato DOCX.

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
