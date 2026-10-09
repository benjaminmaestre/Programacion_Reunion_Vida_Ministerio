# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Este documento registra el estado verificable, la arquitectura, las decisiones y los próximos pasos. Debe actualizarse en cada sesión de desarrollo significativa.

- **Última actualización:** 9 de octubre de 2026
- **Rama de trabajo actual:** `feat/directorio-historial-contextual`
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Estado:** prototipo de directorio interactivo; todavía no conectado a Supabase ni listo para producción.
- **Avance global estimado:** 35% (estimación cualitativa, no métrica automática).

## 1. Objetivo

Desarrollar una aplicación web para gestionar el directorio de la congregación, preparar programas de la reunión Vida y Ministerio Cristianos, validar las reglas de asignación basadas en el S-38-S y conservar un historial semestral sin borrar datos anteriores. La salida principal será un documento S-140 generado a partir de la plantilla oficial proporcionada.

La aplicación debe facilitar decisiones humanas informadas; no decidir automáticamente quién está capacitado para recibir una asignación.

## 2. Fuentes funcionales

- `templates/S-140_S.docx`: plantilla de impresión de referencia. Debe preservarse el archivo original.
- `templates/S-38_S.pdf`: instrucciones de la reunión, revisión 8/26.
- Para reproducir el S-89 se necesitará su plantilla oficial; no se debe fabricar un formulario presentado como oficial sin esa fuente.

Las reglas nuevas deben contrastarse con estos documentos. Las decisiones administrativas no especificadas por las fuentes deben quedar configurables y documentadas.

## 3. Estado real del proyecto

### Implementado o existente en el repositorio
- [x] Migración SQL inicial `supabase/migrations/001_initial_schema.sql` para miembros, habilitaciones, relaciones familiares, ciclos bimestrales, períodos semestrales, reuniones y espacios de asignación.
- [x] Tipos de dominio iniciales en `src/types/domain.ts`.
- [x] Motor inicial de reglas en `src/domain/rules/s38s-engine.ts`.
- [x] Generador inicial DOCX en `src/features/printing/s140-docx-generator.ts`.
- [x] Plantillas fuente en `templates/`.
- [x] Documento maestro del proyecto.

### Añadido en la rama de trabajo actual
- [x] Entrada inicial de Next.js App Router: `src/app/layout.tsx` y `src/app/page.tsx`.
- [x] Sistema de estilos globales y tokens centralizados en `src/app/globals.css`.
- [x] Tokens tipados que referencian variables CSS en `src/lib/design-tokens.ts`.
- [x] Directorio visual e interactivo en `src/features/members/MembersWorkspace.tsx`.
- [x] Tipos y registros ficticios de demostración en `src/features/members/demo-data.ts`.
- [x] Búsqueda, filtros por estado, selección de persona, formulario para añadir/editar y ficha contextual del historial.
- [x] Selector de participante y selector de categoría para mostrar la última participación general y la última de la categoría elegida.
- [x] Guardado local en el navegador para los cambios del directorio de demostración.
- [x] Configuración base `tsconfig.json`, `next.config.ts` y scripts `dev`, `build`, `start`, `typecheck` en `package.json`.

### Limitaciones y pendientes conocidas
- [ ] No hay conexión real al proyecto de Supabase ni variables de entorno configuradas.
- [ ] El directorio usa datos ficticios y localStorage; no sincroniza entre navegadores ni usuarios y no es persistencia de producción.
- [ ] El historial de la interfaz es un conjunto de ejemplos estáticos y actualmente no cambia a partir de las ediciones del directorio.
- [ ] Falta implementar el servicio de datos, autenticación, autorización y políticas RLS verificadas.
- [ ] El esquema inicial de asignaciones contempla titular y ayudante como columnas. Para admitir de forma escalable otras funciones de participación e historial por rol, evaluar una tabla normalizada `assignment_participants` mediante una nueva migración.
- [ ] Faltan formularios completos para competencias y autorizaciones humanas, así como para relaciones familiares con controles de privacidad.
- [ ] Falta el editor de programas, ciclos bimestrales, excepciones de calendario y avisos de tres semanas.
- [ ] Falta probar el generador contra todas las páginas de la plantilla S-140, renderizar visualmente y corregir cualquier desbordamiento.
- [ ] No hay pruebas unitarias ni de extremo a extremo configuradas todavía. No se ha afirmado que la aplicación compile: esta sesión no dispone de una ejecución local de npm/build sobre el repositorio.
- [ ] Falta configuración documentada de despliegue.
- [ ] Se necesita la plantilla oficial S-89 para generar esa salida.

## 4. Stack y arquitectura

- Next.js App Router y React.
- TypeScript estricto.
- PostgreSQL y Supabase previstos para persistencia y control de acceso.
- Lucide React para iconos.
- Zod y React Hook Form disponibles para validación y formularios más complejos.
- Docxtemplater y PizZip disponibles para generación DOCX.
- Estilos globales CSS con tokens compartidos.

### Estructura relevante

```text
docs/PROJECT_MASTER.md
templates/S-140_S.docx
templates/S-38_S.pdf
supabase/migrations/001_initial_schema.sql
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/domain/rules/s38s-engine.ts
src/features/members/MemberCard.tsx
src/features/members/MembersWorkspace.tsx
src/features/members/demo-data.ts
src/features/members/member-types.ts
src/features/printing/s140-docx-generator.ts
src/lib/design-tokens.ts
src/types/domain.ts
tsconfig.json
next.config.ts
package.json
```

## 5. Sistema de diseño global

Los valores de diseño compartidos están definidos en `src/app/globals.css` como variables CSS semánticas: colores, tipografía, espaciado, radios, sombras y estados. Los componentes deben consumir clases globales o tokens compartidos, evitando duplicar estilos visuales por página.

`src/lib/design-tokens.ts` expone desde TypeScript referencias como `var(--color-primary)` y `var(--radius-lg)`; no debe convertirse en una segunda fuente de valores literales paralela al CSS.

El formulario oficial S-140 mantiene su formato fuente y no debe heredar visualmente el diseño de las pantallas de la aplicación.

## 6. Reglas de negocio derivadas del S-38-S

- El plan de trabajo contempla los siguientes dos meses cuando esté disponible una nueva Guía de actividades.
- Las asignaciones deben entregarse con al menos tres semanas de antelación.
- Solo los ancianos pueden asignar las partes que no son para estudiantes, según el S-38-S.
- Edad, experiencia y libertad para hablar sobre el tema son datos para la consideración del responsable; el sistema no debe inferir por sí mismo idoneidad o competencia.
- Lectura de la Biblia: varón.
- Empecemos conversaciones: ayudante del mismo sexo o familiar.
- Hagamos revisitas y Hagamos discípulos: ayudante del mismo sexo.
- Expliquemos nuestras creencias: si es discurso, estudiante varón; si es escenificación, estudiante de cualquier sexo y ayudante del mismo sexo o familiar.
- Los discursos y otras partes deben respetar los requisitos específicos de responsabilidad y competencia descritos en los párrafos 3-17 del S-38-S.
- Semana de visita del superintendente de circuito, semana de asamblea y semana de la Conmemoración necesitan tratamiento diferenciado.
- La duración total ordinaria es de 1 hora y 45 minutos, incluidas canciones y oraciones.

Se debe diferenciar una regla que impide confirmar una asignación de una advertencia que requiere revisión humana. Las excepciones autorizadas deben quedar registradas.

## 7. Períodos y memoria

- La planificación bimestral y la memoria semestral son conceptos separados.
- Períodos predeterminados de memoria: 1 de enero–30 de junio y 1 de julio–31 de diciembre; configurable.
- El sistema no debe borrar los registros anteriores al cambiar de semestre.
- Para el período activo, debe mostrar la última participación de cualquier tipo y la última participación de la categoría seleccionada.
- El historial debe registrar la función de cada persona (titular, ayudante u otro rol) y permitir identificar la pareja de participación cuando corresponda.
- El período asociado a una participación depende de la fecha de la reunión, no de cuándo se edite el programa.

## 8. Seguridad prevista

- No exponer claves privadas ni `service_role` al cliente.
- Aplicar controles de autorización en servidor y RLS en PostgreSQL.
- No habilitar registro público de cuentas sin aprobación expresa.
- Limitar la consulta de teléfonos, correos, notas, relaciones familiares e historial personal a usuarios autorizados.
- No enviar datos personales a proveedores externos de IA.
- Registrar cambios críticos en programas y asignaciones.
- Documentar copias de seguridad y recuperación antes de producción.

## 9. Pruebas y comandos

Scripts configurados en `package.json`:
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`

**Estado de pruebas:** comandos configurados, pero no ejecutados en esta sesión. Deben ejecutarse en un checkout real con dependencias instaladas antes de considerar el hito verificado. Añadir Vitest/Playwright y pruebas específicas como siguiente paso de calidad.

## 10. Registro cronológico de avances

### 9 de octubre de 2026 — Etapa 3, primer incremento
- Se inspeccionó la rama principal mediante GitHub. El reporte anterior enumeraba los componentes de dominio, pero la raíz no contenía `src/app`, hoja de estilos globales ni una entrada ejecutable de Next.js.
- Se abrió la rama `feat/directorio-historial-contextual`, sin sustituir la rama `main`.
- Se añadieron el layout y la página principal.
- Se creó el directorio interactivo con formularios, búsqueda, filtros y ficha del historial contextual.
- Los datos de ejemplo son deliberadamente ficticios. El UI muestra claramente que el almacenamiento es local y que aún no existe sincronización con Supabase.
- Se añadieron tokens CSS globales y una referencia tipada en TypeScript.
- Se añadieron scripts de desarrollo y compilación.
- No se ejecutó build ni typecheck en esta sesión; por tanto no están verificados.

## 11. Próximas tareas ordenadas

1. Hacer checkout de `feat/directorio-historial-contextual` en un entorno de desarrollo y ejecutar `npm install`, `npm run typecheck` y `npm run build`; corregir todos los errores encontrados.
2. Conectar Supabase mediante una capa de acceso a datos; definir `.env.example` sin secretos y eliminar la dependencia de localStorage para los datos reales.
3. Añadir autenticación, autorización, RLS y pruebas de acceso.
4. Implementar migración versionada para `assignment_participants` y consultas del historial basadas en datos reales.
5. Construir formulario completo de miembros, competencias y relaciones familiares con las debidas restricciones.
6. Implementar pruebas unitarias para reglas S-38-S y períodos semestrales.
7. Construir calendario y editor de programas, ciclos bimestrales, excepciones y alertas de anticipación.
8. Validar el generador DOCX con la plantilla S-140 real, inspeccionar cada página y documentar resultados.
9. Añadir la salida S-89 cuando se disponga de su plantilla oficial.
10. Completar pruebas end-to-end, revisión de seguridad y guía de despliegue.

## 12. Protocolo obligatorio para sesiones futuras

Al iniciar una sesión: leer este documento y revisar el estado real de la rama y los archivos. Antes de modificar archivos existentes: recuperar su contenido y SHA actuales. Después de cada incremento: ejecutar las pruebas disponibles, actualizar este documento con los resultados reales y dejar claramente identificados los bloqueos. Nunca marcar una función como completada si solo existe como diseño, ejemplo estático o stub.
