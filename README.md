# Gestión de asignaciones — Vida y Ministerio

Aplicación web en desarrollo para administrar el directorio, preparar asignaciones, consultar historial semestral y generar el programa S-140 respetando las instrucciones S-38-S.

## Estado actual

La rama `feat/directorio-historial-contextual` incorpora la primera interfaz navegable del directorio, la edición de registros de demostración y la ficha de historial contextual.

> **Importante:** esta versión es un prototipo. Usa nombres ficticios y guarda las modificaciones del directorio únicamente en el almacenamiento local del navegador. No está conectada todavía a Supabase ni debe utilizarse para datos personales reales o como sistema multiusuario.

## Requisitos

- Node.js compatible con la versión de Next.js instalada.
- npm.

## Ejecutar en desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Verificaciones

```bash
npm run typecheck
npm run build
```

Estas comprobaciones deben ejecutarse localmente antes de considerar verificada la rama. La sesión que creó el prototipo no ejecutó la compilación.

## Documentación principal

Lee primero [docs/PROJECT_MASTER.md](docs/PROJECT_MASTER.md), que mantiene el alcance, estado real, decisiones técnicas y próximos pasos.

## Fuentes funcionales

- `templates/S-140_S.docx`: formato de impresión de referencia.
- `templates/S-38_S.pdf`: instrucciones de la reunión.

Los documentos fuente no deben modificarse como parte de la generación de documentos.
