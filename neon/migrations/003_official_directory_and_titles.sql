-- MIGRACIÓN 003: EXTENSIÓN PARA DIRECTORIO OFICIAL DE CONGREGACIÓN Y TÍTULOS DE ASIGNACIÓN
-- Añade soporte para precursores regulares, responsabilidades adicionales, estado de bautismo desconocido y tipo de asignación estructurado.

-- 1. Añadir columna is_regular_pioneer y additional_roles a la tabla members
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS is_regular_pioneer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_roles VARCHAR(100),
ALTER COLUMN is_baptized DROP DEFAULT,
ALTER COLUMN is_baptized TYPE BOOLEAN USING is_baptized;

-- 2. Añadir columna assignment_type a assignment_slots para desvincular el título editable de la regla S-38-S
ALTER TABLE public.assignment_slots
ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50);

-- Crear índice para búsquedas rápidas por tipo estructurado de asignación
CREATE INDEX IF NOT EXISTS idx_assignment_slots_type ON public.assignment_slots(assignment_type);
