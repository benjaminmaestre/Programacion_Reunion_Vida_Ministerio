# PROYECTO MAESTRO — SISTEMA DE GESTIÓN DE ASIGNACIONES S-140

**Fuente de verdad del proyecto.** Leer y actualizar este documento en cada sesión significativa. Describe el código real y no debe depender de la memoria de una conversación.

- **Última actualización:** 9 de octubre de 2026
- **Rama de desarrollo:** `main` exclusivamente. No crear ramas de funcionalidad ni Pull Requests.
- **Repositorio:** https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio
- **Alcance actual:** una congregación, aproximadamente 100 participantes.
- **Estado:** directorio integrado con capa Supabase/Auth/RLS preparada en código. La conexión real y la migración todavía requieren verificación en el entorno destino.
- **Avance global estimado:** 40% (estimación cualitativa, no métrica automática).

## 1. Objetivo

Centralizar el directorio de hermanos y hermanas, preparar programas de la reunión Vida y Ministerio Cristianos, validar las instrucciones S-38-S, mantener memoria histórica semestral sin borrar el historial previo y producir el documento S-140 desde la plantilla fuente.

El sistema ayuda a responsables autorizados a tomar decisiones; no infiere por sí mismo la competencia de una persona.

## 2. Alcance y arquitectura deliberada

**Solo hay una congregación.** Se esperan aproximadamente 100 participantes, una escala pequeña para PostgreSQL. El sistema no necesita un esquema multi-tenant, tabla de congregaciones ni columnas `congregation_id` en todas las tablas. Los datos viven en una única base de datos y el acceso se controla con Supabase Auth, la tabla `app_users` y RLS.

Roles iniciales de aplicación:
- `administrator`: administración del sistema y del directorio.
- `elder`: acceso de administración y a información de habilitaciones/relaciones familiares.
- `coordinator`: mantenimiento del directorio y preparación de programas.
- `viewer`: consulta.

La primera cuenta autorizada se agrega administrativamente a `app_users`. El cliente no puede autoasignarse un rol.

## 3. Fuentes funcionales

- `templates/S-140_S.docx`: plantilla fuente de impresión; conservar sin modificar.
- `templates/S-38_S.pdf`: instrucciones de la reunión, revisión 8/26.
- Se necesita la plantilla oficial S-89 para producir esa salida sin fabricar un formulario no oficial.

No inventar reglas ni datos oficiales que no estén sustentados por las fuentes.

## 4. Estado verificable

### Existente en el repositorio
- [x] Migración inicial `supabase/migrations/001_initial_schema.sql`.
- [x] Tipos de dominio `src/types/domain.ts`.
- [x] Motor inicial de reglas S-38-S en `src/domain/rules/s38s-engine.ts`.
- [x] Generador DOCX inicial en `src/features/printing/s140-docx-generator.ts`.
- [x] Plantillas fuente S-140 y S-38-S.
- [x] App Router en `src/app`.
- [x] Estilos y tokens globales en `src/app/globals.css` y `src/lib/design-tokens.ts`.
- [x] Directorio, búsqueda, filtros y ficha contextual en `src/features/members/MembersWorkspace.tsx`.

### Añadido para la conexión Supabase
- [x] Dependencias fijadas de `@supabase/ssr`, `@supabase/supabase-js` y `server-only`.
- [x] Variables de ejemplo en `.env.example`.
- [x] Clientes Supabase browser/server y refresco de sesión en `src/lib/supabase/` y `src/proxy.ts`.
- [x] Repositorio de miembros e historial en `src/features/members/members-repository.ts`.
- [x] Pantalla con inicio de sesión y guardado/consulta remotos si Supabase está configurado; si no, la aplicación indica modo demo.
- [x] Migración simplificada `supabase/migrations/002_single_congregation_auth_rls.sql` para roles, grants mínimos y RLS.
- [x] Pruebas SQL iniciales en `supabase/tests/002_rls_policies.test.sql`.
- [x] Guía de conexión en `docs/SUPABASE_SETUP.md`.

### Pendientes/limitaciones
- [ ] Ejecutar `npm ci`, `npm run typecheck` y `npm run build` después de la integración reciente. No afirmar que pasa hasta observar el resultado de CI o la ejecución local.
- [ ] Configurar el URL y la clave publicable de **este** proyecto, aplicar migraciones de forma segura y crear el primer usuario en `app_users`.
- [ ] Ejecutar pruebas de RLS en una base local/de prueba y revisar asesores de seguridad.
- [ ] El historial actual considera el titular y el ayudante de las columnas actuales. Diseñar luego una tabla normalizada `assignment_participants` si se registran lectores, conductores u otros roles por separado.
- [ ] Añadir alta/importación de unas 100 personas desde Excel/CSV, con detección de duplicados.
- [ ] Completar habilitaciones aprobadas por responsables y la gestión restringida de relaciones familiares.
- [ ] Implementar editor de reuniones, plan bimestral, excepciones y alerta de tres semanas.
- [ ] Verificar visualmente cada página generada del S-140 usando la plantilla DOCX real.
- [ ] Añadir pruebas unitarias y end-to-end.
- [ ] Se requiere la plantilla S-89 oficial para implementar su impresión.

## 5. Historial semestral y planificación

Los ciclos de planificación de dos meses y la memoria semestral son conceptos diferentes.

Períodos predeterminados de memoria:
- 1 de enero–30 de junio.
- 1 de julio–31 de diciembre.

Al comenzar un semestre no se borran registros. El historial de una persona debe poder consultarse por fecha, categoría, función (titular/ayudante) y compañero. El período se determina por la fecha de la reunión, no por cuándo se edita.

## 6. Seguridad

- No exponer claves `service_role` ni secret keys al navegador.
- Usar la clave publicable solo con Auth y RLS correctamente configurados.
- Denegar acceso a usuarios no autenticados y exigir fila activa en `app_users`.
- Reservar inserción/actualización del directorio a los roles autorizados.
- Restringir habilitaciones y relaciones familiares a administradores/ancianos.
- No conceder al navegador permisos para borrar personas, asignaciones o el historial.
- No resolver errores de permisos desactivando RLS.
- No usar `user_metadata` como fuente de autorización.
- No aplicar migraciones ni publicar datos en un proyecto Supabase sin confirmar su identidad.

## 7. Sistema de diseño

Los tokens compartidos se definen en `src/app/globals.css`; `src/lib/design-tokens.ts` los referencia. Las vistas nuevas deben reutilizar estilos globales y componentes existentes, evitando CSS visual duplicado. El S-140 conserva su propio diseño oficial y no hereda los estilos de la interfaz.

## 8. Comandos

- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run start`

El workflow `.github/workflows/ci.yml` ejecuta `npm ci`, typecheck y build en pushes a `main`. Revisar el estado real de CI después de los cambios.

## 9. Registro de avances

### 9 de octubre de 2026 — Directorio y configuración de Supabase
- El directorio se conectó en código con Supabase Auth y consultas del directorio/historial.
- Se creó una migración inicial de políticas de seguridad con diseño multi-congregación, luego retirada antes de declarar conexión operativa, porque el alcance confirmado es de una sola congregación.
- Se simplificó el modelo a `app_users` y una sola base del directorio.
- Se cambiaron las consultas para no depender de `congregation_id`.
- Se actualizó `docs/SUPABASE_SETUP.md` para explicar la configuración del primer administrador.
- No se aplicó ninguna migración a los proyectos Supabase disponibles: ninguno se confirmó como correspondiente a esta aplicación.
- No se han verificado en esta sesión el build, typecheck ni las pruebas SQL del esquema revisado.

## 10. Próximos pasos prioritarios

1. Verificar CI de `main` y corregir errores de lockfile, TypeScript o build.
2. Confirmar cuál es el proyecto Supabase de esta aplicación; configurar solo ese proyecto.
3. Probar la migración simplificada en una base local/de prueba, validar RLS para administrador, coordinador y lector.
4. Conectar las credenciales de entorno y crear el primer usuario autorizado.
5. Probar altas, edición e historial con datos ficticios antes de importar las aproximadamente 100 personas reales.
6. Continuar con editor de programas y generación fiel del S-140.

## 11. Protocolo permanente

Trabajar directamente sobre `main`; no crear ramas ni PRs. Inspeccionar el estado antes de editar. Después de cada etapa, comprobar el código, ejecutar las pruebas disponibles, actualizar este documento y dejar claramente separado lo implementado, lo verificado y lo pendiente.
