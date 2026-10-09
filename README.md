# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación, preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto

- **Rama principal:** `main` (Desarrollo directo obligatorio en `main`).
- **Pruebas unitarias:** Ejecutadas con **Vitest** (`npx vitest run` - 9 tests pasaron).
- **Persistencia:** Capa SSR de Supabase Auth y PostgreSQL con RLS lista, junto a un modo demostración local seguro.
- **Motor S-38-S:** Validaciones citando párrafos oficiales del S-38-S para Tesoros, Seamos mejores maestros (ayudantes por sexo/parentesco), Vida cristiana y Presidencia.

## Requisitos e Instalación

- Node.js 18+ o superior.
- npm.

```bash
# Instalación de dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# Ejecutar pruebas unitarias
npx vitest run

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
