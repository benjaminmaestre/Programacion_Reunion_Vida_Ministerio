-- Authorized users can permanently delete a draft meeting program and its assignment slots.
-- Published meeting programs cannot be deleted directly (they must be reopened first).
CREATE OR REPLACE FUNCTION public.delete_draft_meeting_program(
  p_program_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor UUID;
  v_role TEXT;
  v_program public.meeting_programs%ROWTYPE;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere una sesión autenticada.';
  END IF;

  SELECT au.role::text INTO v_role
  FROM public.app_users AS au
  WHERE au.user_id = v_actor AND au.is_active IS TRUE;

  IF v_role IS NULL OR v_role NOT IN ('administrator', 'user') THEN
    RAISE EXCEPTION 'Acceso denegado: tu rol no permite eliminar programas.';
  END IF;

  IF p_program_id IS NULL THEN
    RAISE EXCEPTION 'El identificador del programa es obligatorio.';
  END IF;

  SELECT mp.* INTO v_program
  FROM public.meeting_programs AS mp
  WHERE mp.id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el programa que deseas eliminar.';
  END IF;

  IF v_program.is_draft IS NOT TRUE THEN
    RAISE EXCEPTION 'No se pueden eliminar programas publicados. Primero debes reabrirlo a borrador.';
  END IF;

  DELETE FROM public.assignment_slots
  WHERE meeting_program_id = p_program_id;

  DELETE FROM public.meeting_programs
  WHERE id = p_program_id AND is_draft IS TRUE;

  RETURN p_program_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_draft_meeting_program(UUID) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.delete_draft_meeting_program(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
