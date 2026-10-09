# Gestión de Asignaciones — Vida y Ministerio Cristianos (S-140 / S-38-S)

Aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase para administrar el directorio de la congregación (125 personas), preparar los programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S y generar el documento impreso S-140 desde la plantilla oficial.

## Estado Actual del Proyecto

- **Congregación Objetivo:** Congregación Las Violetas (Medellín, Colombia) — 125 personas únicas.
- **Rama principal:** `main` (desarrollo directo en `main`).
- **Pruebas:** Vitest incluye pruebas unitarias del motor, importación y validación de publicación. Verificar el resultado del último workflow antes de afirmar que CI está verde.
- **Importación oficial:** Función de importación protegida por rol y validación; el botón de importación está temporalmente retirado del cliente hasta implementar un flujo administrativo seguro.
- **Persistencia:** El editor de programas utiliza el repositorio Supabase cuando hay conexión; el modo demo es temporal, solo en desarrollo y no persiste en localStorage. La conexión real y las migraciones deben verificarse en un proyecto de prueba autorizado.
- **Motor S-38-S:** Validaciones citando párrafos oficiales del S-38-S para Tesoros, Seamos mejores maestros (ayudantes por sexo/parentesco), Vida cristiana y Presidencia.
- **Editor de programas:** Carga y guardado de programas, títulos editables y participantes mediante Supabase; publicación bloqueada si faltan asignaciones o revisión humana S-38-S. La ida/vuelta real depende de un entorno Supabase configurado y de aplicar las migraciones correspondientes.

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
