# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Este documento registra el estado verificable, la arquitectura, las decisiones y los próximos pasos. Debe actualizarse en cada sesión de desarrollo significativa.

- **Última actualización:** 9 de octubre de 2026
- **Rama de trabajo actual:** `main` (Trabajo directo obligatorio en rama `main`)
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Estado:** Integración exitosa de PR #1 en `main`. Build (`npm run build`) y verificación de tipos (`npm run typecheck`) ejecutados con resultado 0 errores.
- **Avance global estimado:** 35% (prototipo ejecutable del directorio, base SQL, motor de reglas S-38-S y generador DOCX).

## 1. Objetivo

Desarrollar una aplicación web para gestionar el directorio de la congregación, preparar programas de la reunión Vida y Ministerio Cristianos, validar las reglas de asignación basadas en el S-38-S y conservar un historial semestral sin borrar datos anteriores. La salida principal será un documento S-140 generado a partir de la plantilla oficial proporcionada.

La aplicación debe facilitar decisiones humanas informadas; no decidir automáticamente quién está capacitado para recibir una asignación.

## 2. Fuentes funcionales

- `templates/S-140_S.docx`: plantilla de impresión de referencia. Debe preservarse el archivo original.
- `templates/S-38_S.pdf`: instrucciones de la reunión, revisión 8/26.
- Para reproducir el S-89 se necesitará su plantilla oficial; no se debe fabricar un formulario presentado como oficial sin esa fuente.

Las reglas nuevas deben contrastarse con estos documentos. Las decisiones administrativas no especificadas por las fuentes deben quedar configurables y documentadas.

## 3. Estado real del proyecto

### Implementado e integrado directamente en `main`
- [x] Integración completa del PR #1 en la rama `main`.
- [x] Compilación de producción probada e impecable (`npm run build` pasó con 0 errores).
- [x] Verificación de tipos TypeScript estricto (`npm run typecheck` pasó con 0 errores).
- [x] Migración SQL inicial `supabase/migrations/001_initial_schema.sql` para miembros, habilitaciones, relaciones familiares, ciclos bimestrales, períodos semestrales, reuniones y espacios de asignación.
- [x] Tipos de dominio en `src/types/domain.ts`.
- [x] Motor puro de reglas del S-38-S en `src/domain/rules/s38s-engine.ts`.
- [x] Generador DOCX S-140 en `src/features/printing/s140-docx-generator.ts`.
- [x] Plantillas fuente oficiales en `templates/`.
- [x] Entrada Next.js App Router: `src/app/layout.tsx` y `src/app/page.tsx`.
- [x] Sistema de estilos globales y tokens centralizados en `src/app/globals.css` y `src/lib/design-tokens.ts`.
- [x] Directorio visual e interactivo en `src/features/members/MembersWorkspace.tsx`.
- [x] Componentes de tarjetas de miembros `src/features/members/MemberCard.tsx`.

### Limitaciones y pendientes conocidas
- [ ] Conectar la capa de persistencia Supabase real con cliente de base de datos y políticas RLS para reemplazar localStorage/demo-data.
- [ ] Desarrollar el editor de programas semanales de la reunión, ciclos bimestrales y excepciones de calendario.
- [ ] Implementar la vista previa visual HTML e impresión del S-140 interactiva.

## 4. Registro cronológico de avances

### 9 de octubre de 2026 — Integración de PR #1 y estandarización a rama `main`
- Se revisó e integró el Pull Request #1 (`feat/directorio-historial-contextual`) directamente a la rama `main`.
- Se ejecutó `npm run build` y `npm run typecheck` en el repositorio local, verificando 0 errores de compilación o de tipos.
- Se subieron los cambios de integración a `main` en GitHub.
- A partir de ahora, todo desarrollo continuará de forma directa en `main` conforme a la directriz obligatoria.

