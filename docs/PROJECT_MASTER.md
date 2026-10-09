# PROYECTO: SISTEMA DE GESTIÓN DE ASIGNACIONES S-140 — VIDA Y MINISTERIO CRISTIANOS

## 1. OBJETIVO Y ALCANCE DEL SISTEMA

El **Sistema de Gestión de Asignaciones S-140** es una aplicación web profesional desarrollada con Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL y Supabase. Su objetivo principal es centralizar y automatizar el proceso de preparación, asignación, validación histórica e impresión del programa semanal de la reunión **Vida y Ministerio Cristianos** de las congregaciones de los Testigos de Jehová, respetando estrictamente las reglas oficiales del documento **S-38-S** y generando el formulario impreso **S-140** preservando fielmente su formato original.

### Funcionalidades Clave
1. **Directorio Centralizado de la Congregación:** Registro de hermanos/hermanas, roles, competencias autorizadas, grupos y restricciones.
2. **Motor de Reglas de Elegibilidad (S-38-S):** Validación en tiempo real de titulares y ayudantes por sección y tipo de asignación (sexo, nombramientos, asignaciones de estudiante, intervención del presidente, etc.).
3. **Memoria Histórica de 6 Meses (Semestral):** Seguimiento de participaciones pasadas sin borrar registros antiguos, separando el ciclo de planificación (bimestral) de la memoria de rotación (semestral).
4. **Planificación Bimestral & Excepciones de Calendario:** Gestión de ciclos de 2 meses, control de 3 semanas de antelación, visitas del superintendente de circuito, asambleas y Conmemoración.
5. **Generador y Vista Previa del Documento S-140:** Relleno de la plantilla oficial DOCX (`templates/S-140_S.docx`) y vista HTML de impresión de alta fidelidad.
6. **Seguridad y Privacidad RLS:** Autenticación por Supabase Auth y políticas RLS para protección de datos personales y asignaciones.

---

## 2. ESTADO ACTUAL DEL PROYECTO

- **Porcentaje estimado de avance global:** 15% (Etapa 1 completada + Estructura e instalación base de Etapa 2).
- **Última actualización:** 09 de Octubre de 2026.

### Resumen de Avances Realizados
- [x] Repositorio Git vinculado a GitHub en `https://github.com/benjaminmaestre/Programacion_Reunion_Vida_Ministerio.git`.
- [x] Ubicación de las fuentes oficiales de referencia: `templates/S-140_S.docx` y `templates/S-38_S.pdf`.
- [x] Creación e inicio de `docs/PROJECT_MASTER.md`.
- [x] Instalación de dependencias core (Next.js, React, TypeScript, Tailwind CSS, Lucide Icons, Zod, React Hook Form, Docxtemplater, PizZip, TanStack Table).

---

## 3. ARQUITECTURA TÉCNICA Y ESTRUCTURA DEL REPOSITORIO

```text
Programacion_Reunion_Vida_Ministerio/
├── docs/
│   └── PROJECT_MASTER.md       # Documento Maestro de Fuente de Verdad
├── templates/
│   ├── S-140_S.docx            # Plantilla oficial DOCX de asignaciones
│   └── S-38_S.pdf             # Instrucciones oficiales de la reunión
├── src/
│   ├── app/                    # Next.js App Router (Páginas y API Routes)
│   ├── components/             # Sistema de diseño, UI, Layout y Shared
│   ├── domain/                 # Reglas de negocio puras (S-38-S engine)
│   ├── features/               # Módulos por dominio (members, programs, printing, history)
│   ├── lib/                    # Supabase client, utils, tokens, validations
│   └── types/                  # Definiciones de tipos TypeScript
├── supabase/
│   └── migrations/             # Esquema PostgreSQL y políticas RLS
└── package.json
```

---

## 4. REGLAS DE NEGOCIO Y ELEGIBILIDAD (S-38-S)

1. **Tesoros de la Biblia:**
   - *Discurso (10 min):* Anciano o Siervo Ministerial competente.
   - *Perlas Escondidas (10 min):* Anciano o Siervo Ministerial competente.
   - *Lectura de la Biblia (4 min):* Estudiante Varón.

2. **Seamos Mejores Maestros (Asignaciones de Estudiante):**
   - *Empecemos conversaciones:* Estudiante Varón o Hermana. Ayudante del mismo sexo o familiar.
   - *Hagamos revisitas:* Ayudante del mismo sexo que el estudiante.
   - *Hagamos discípulos:* Ayudante del mismo sexo.
   - *Expliquemos nuestras creencias:* Si es discurso -> Varón. Si es escenificación -> Varón o Hermana con ayudante del mismo sexo o familiar.

3. **Nuestra Vida Cristiana:**
   - *Necesidades de la congregación:* Anciano.
   - *Estudio Bíblico de la Congregación:* Conductor designado (Anciano capacitado) y Lector.

4. **Reglas Generales y Rotaciones:**
   - Incompatibilidad de asignaciones dobles en la misma semana para la misma persona.
   - Control de intervalo de 6 meses en memoria semestral.

---

## 5. PRÓXIMAS TAREAS (ETAPA 2 Y ETAPA 3)

1. Implementar la estructura del esquema SQL de Supabase (`supabase/migrations/001_initial_schema.sql`).
2. Configurar tokens de diseño centralizados en `src/app/globals.css` y `src/lib/design-tokens.ts`.
3. Implementar el motor de reglas independiente en `src/domain/rules/assignment-rules.ts` con pruebas Vitest.
4. Construir el módulo del Directorio de Hermanos (`src/features/members`).
