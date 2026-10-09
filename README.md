# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación (125 personas), preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto

- **Congregación Objetivo:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas.
- **Rama principal:** `main` (desarrollo directo en `main`).
- **Pruebas unitarias:** Ejecutadas con **Vitest** (`npm test` - 26 pruebas automáticas pasando).
- **Importación oficial:** Flujo administrativo de validación y previsualización de los 125 registros oficiales (`member-importer.ts`).
- **Persistencia:** Capa SSR de Supabase Auth y PostgreSQL con RLS lista, junto a un modo demostración aislado con datos ficticios.
- **Motor S-38-S:** Validaciones citando párrafos oficiales del S-38-S para Tesoros, Seamos mejores maestros (ayudantes por sexo/parentesco), Vida cristiana y Presidencia.
- **Editor de programas:** Persistencia de `assignment_type` y títulos editables de asignación (`title`) para el S-140.

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
