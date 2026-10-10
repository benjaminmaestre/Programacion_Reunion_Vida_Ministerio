-- Supports the consolidated Congregation Bible Study slot (conductor + reader).
-- Source definition retrieved from the production-compatible two-role schema, then patched
-- to recognize bible_study while retaining the existing authorization and audit safeguards.
CREATE OR REPLACE FUNCTION public.save_meeting_program_transaction(p_program_id uuid, p_meeting_date date, p_week_type week_type_enum, p_chairman_id uuid DEFAULT NULL::uuid, p_auxiliary_counselor_id uuid DEFAULT NULL::uuid, p_leadership_review_confirmed boolean DEFAULT false, p_leadership_review_confirmed_by uuid DEFAULT NULL::uuid, p_leadership_review_confirmed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_circuit_overseer_talk_title character varying DEFAULT NULL::character varying, p_is_draft boolean DEFAULT true, p_notes text DEFAULT NULL::text, p_slots jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor UUID;
  v_role TEXT;
  v_old_program public.meeting_programs%ROWTYPE;
  v_program_exists BOOLEAN := FALSE;
  v_old_slot public.assignment_slots%ROWTYPE;
  v_slot_exists BOOLEAN;
  v_same_slot_review BOOLEAN;
  v_is_circuit_talk BOOLEAN;
  v_cycle_id UUID;
  v_period_id UUID;
  v_year INT;
  v_month INT;
  v_bimonth INT;
  v_semester INT;
  v_elders_count INT;
  v_chair_appointment TEXT;
  v_counselor_appointment TEXT;
  v_primary_gender TEXT;
  v_primary_appointment TEXT;
  v_assistant_gender TEXT;
  v_assistant_appointment TEXT;
  v_slot RECORD;
  v_review_by UUID;
  v_review_at TIMESTAMPTZ;
  v_slot_review_by UUID;
  v_slot_review_at TIMESTAMPTZ;
  v_slot_count INT;
  v_distinct_slot_count INT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Acceso denegado: se requiere una sesión autenticada.'; END IF;

  SELECT au.role::text INTO v_role FROM public.app_users AS au
  WHERE au.user_id = v_actor AND au.is_active = TRUE;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'user') THEN
    RAISE EXCEPTION 'Acceso denegado: tu rol no permite preparar programas de reunión.';
  END IF;

  IF p_program_id IS NULL OR p_meeting_date IS NULL OR p_week_type IS NULL THEN
    RAISE EXCEPTION 'Identificador, fecha y tipo de semana son obligatorios.';
  END IF;
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'Las intervenciones deben enviarse como una lista JSON.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT element->>'id')
  INTO v_slot_count, v_distinct_slot_count
  FROM jsonb_array_elements(p_slots) AS item(element);
  IF v_slot_count <> v_distinct_slot_count THEN
    RAISE EXCEPTION 'Cada intervención debe tener un identificador único y válido.';
  END IF;

  -- Bloqueo de la fila existente para evitar carreras de edición/publicación.
  SELECT mp.* INTO v_old_program FROM public.meeting_programs AS mp
  WHERE mp.id = p_program_id FOR UPDATE;
  v_program_exists := FOUND;
  IF v_program_exists AND v_old_program.is_draft IS FALSE THEN
    RAISE EXCEPTION 'El programa ya está publicado y no se puede modificar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.meeting_programs AS mp
    WHERE mp.meeting_date = p_meeting_date AND mp.id <> p_program_id
  ) THEN
    RAISE EXCEPTION 'Ya existe otro programa para la fecha %.', p_meeting_date;
  END IF;

  -- Ciclo y período se resuelven dentro de esta misma transacción.
  v_year := EXTRACT(YEAR FROM p_meeting_date);
  v_month := EXTRACT(MONTH FROM p_meeting_date);
  v_bimonth := CEIL(v_month / 2.0);
  v_semester := CASE WHEN v_month <= 6 THEN 1 ELSE 2 END;
  v_cycle_id := public.resolve_or_create_planning_cycle(v_year, v_bimonth);
  v_period_id := public.resolve_or_create_history_period(
    v_year, v_semester,
    MAKE_DATE(v_year, CASE WHEN v_semester = 1 THEN 1 ELSE 7 END, 1),
    MAKE_DATE(v_year, CASE WHEN v_semester = 1 THEN 6 ELSE 12 END,
      CASE WHEN v_semester = 1 THEN 30 ELSE 31 END)
  );
  IF v_cycle_id IS NULL OR v_period_id IS NULL THEN
    RAISE EXCEPTION 'No se pudieron establecer los UUID obligatorios del ciclo y período.';
  END IF;

  -- Preservar la auditoría cuando la revisión existente sigue siendo válida.
  IF p_leadership_review_confirmed IS TRUE THEN
    IF v_program_exists AND v_old_program.leadership_review_confirmed IS TRUE
       AND v_old_program.chairman_id IS NOT DISTINCT FROM p_chairman_id
       AND v_old_program.auxiliary_counselor_id IS NOT DISTINCT FROM p_auxiliary_counselor_id THEN
      v_review_by := v_old_program.leadership_review_confirmed_by;
      v_review_at := v_old_program.leadership_review_confirmed_at;
    ELSE
      IF v_role NOT IN ('administrator', 'user') THEN
        RAISE EXCEPTION 'Solo un usuario autorizado puede confirmar Presidencia y Consejería.';
      END IF;
      v_review_by := v_actor;
      v_review_at := NOW();
    END IF;
  ELSE
    v_review_by := NULL;
    v_review_at := NULL;
  END IF;

  -- Reglas específicas para las semanas sin programa ordinario.
  IF p_is_draft IS TRUE THEN
    -- Los borradores pueden guardarse incompletos; las reglas se aplican al publicar.
    NULL;
  ELSIF p_week_type = 'assembly'::public.week_type_enum THEN
    IF NOT (LOWER(COALESCE(p_notes, '')) LIKE '%asamblea%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_slots) AS item(element)
        WHERE LOWER(COALESCE(element->>'title', '') || ' ' || COALESCE(element->>'notes', '')) LIKE '%asamblea%'
      )) THEN
      RAISE EXCEPTION 'Asamblea: registra un aviso o nota que identifique la semana de asamblea.';
    END IF;
  ELSIF p_week_type = 'memorial'::public.week_type_enum THEN
    SELECT m.appointment::text INTO v_chair_appointment FROM public.members AS m
    WHERE m.id = p_chairman_id AND m.is_active IS TRUE;
    IF NOT FOUND OR v_chair_appointment IS DISTINCT FROM 'elder' THEN
      RAISE EXCEPTION 'Conmemoración: el presidente debe ser un anciano activo.';
    END IF;
    IF NOT (LOWER(COALESCE(p_notes, '')) LIKE '%conmemoración%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_slots) AS item(element)
        WHERE LOWER(COALESCE(element->>'title', '') || ' ' || COALESCE(element->>'notes', '')) LIKE '%conmemoración%'
      )) THEN
      RAISE EXCEPTION 'Conmemoración: falta identificar el evento especial.';
    END IF;
    IF p_leadership_review_confirmed IS NOT TRUE OR v_review_by IS NULL OR v_review_at IS NULL THEN
      RAISE EXCEPTION 'Conmemoración: falta la revisión válida de Presidencia y Consejería.';
    END IF;
  ELSE
    SELECT m.appointment::text INTO v_chair_appointment FROM public.members AS m
    WHERE m.id = p_chairman_id AND m.is_active IS TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un presidente activo.'; END IF;

    SELECT COUNT(*) INTO v_elders_count FROM public.members AS m
    WHERE m.is_active IS TRUE AND m.appointment = 'elder'::public.appointment_enum;

    IF p_week_type = 'circuit_overseer'::public.week_type_enum THEN
      IF v_chair_appointment IS DISTINCT FROM 'elder' THEN
        RAISE EXCEPTION 'La visita del Superintendente requiere un presidente que sea anciano activo.';
      END IF;
      IF NULLIF(BTRIM(p_circuit_overseer_talk_title), '') IS NULL THEN
        RAISE EXCEPTION 'La visita del Superintendente requiere el título real del discurso de servicio.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_slots) AS item(element)
        WHERE COALESCE(element->>'assignment_type', '') = 'living_part'
          AND LOWER(COALESCE(element->>'title', '') || ' ' || COALESCE(element->>'notes', '')) LIKE '%superintendente de circuito%'
      ) THEN
        RAISE EXCEPTION 'Falta la intervención del discurso del Superintendente de Circuito.';
      END IF;
    ELSIF v_chair_appointment IS DISTINCT FROM 'elder'
      AND NOT COALESCE(v_elders_count < 3 AND v_chair_appointment = 'ministerial_servant', FALSE) THEN
      RAISE EXCEPTION 'El presidente debe ser anciano salvo la excepción aplicable con menos de tres ancianos activos.';
    END IF;

    IF p_leadership_review_confirmed IS NOT TRUE OR v_review_by IS NULL OR v_review_at IS NULL THEN
      RAISE EXCEPTION 'Falta la revisión válida de Presidencia y Consejería.';
    END IF;
    IF p_auxiliary_counselor_id IS NOT NULL THEN
      SELECT m.appointment::text INTO v_counselor_appointment FROM public.members AS m
      WHERE m.id = p_auxiliary_counselor_id AND m.is_active IS TRUE;
      IF NOT FOUND OR v_counselor_appointment IS DISTINCT FROM 'elder' THEN
        RAISE EXCEPTION 'El consejero auxiliar debe ser un anciano activo.';
      END IF;
    END IF;
    IF jsonb_array_length(p_slots) = 0 THEN RAISE EXCEPTION 'El programa debe contener intervenciones.'; END IF;

    FOR v_slot IN
      SELECT * FROM jsonb_to_recordset(p_slots) AS x(
        id UUID, section public.section_enum, title VARCHAR(255), duration_minutes INT,
        order_index INT, is_student_part BOOLEAN, assignment_type VARCHAR(100),
        primary_participant_id UUID, assistant_participant_id UUID,
        eligibility_confirmed BOOLEAN, eligibility_confirmed_by UUID,
        eligibility_confirmed_at TIMESTAMPTZ, notes TEXT
      )
    LOOP
      IF v_slot.id IS NULL OR NULLIF(BTRIM(v_slot.title), '') IS NULL THEN
        RAISE EXCEPTION 'Cada intervención debe tener UUID y título.';
      END IF;
      IF v_slot.duration_minutes IS NULL OR v_slot.duration_minutes < 0 OR v_slot.order_index IS NULL OR v_slot.order_index < 1 THEN
        RAISE EXCEPTION 'La duración o el orden de la intervención % no son válidos.', v_slot.title;
      END IF;

      v_is_circuit_talk := p_week_type = 'circuit_overseer'::public.week_type_enum
        AND v_slot.assignment_type = 'living_part'
        AND LOWER(COALESCE(v_slot.title, '') || ' ' || COALESCE(v_slot.notes, '')) LIKE '%superintendente de circuito%';

      IF v_slot.assignment_type IS NULL
        OR (v_slot.assignment_type IN ('treasures_talk','gems','bible_reading') AND v_slot.section <> 'treasures'::public.section_enum)
        OR (v_slot.assignment_type IN ('conversation','revisit','disciples','explain_beliefs','student_talk') AND v_slot.section <> 'ministers'::public.section_enum)
        OR (v_slot.assignment_type IN ('living_part','living_needs','bible_study','bible_study_conductor','bible_study_reader') AND v_slot.section <> 'living'::public.section_enum)
        OR v_slot.assignment_type NOT IN ('treasures_talk','gems','bible_reading','conversation','revisit','disciples','explain_beliefs','student_talk','living_part','living_needs','bible_study','bible_study_conductor','bible_study_reader') THEN
        RAISE EXCEPTION 'La intervención % tiene un tipo o sección no compatible.', v_slot.title;
      END IF;

      SELECT s.* INTO v_old_slot FROM public.assignment_slots AS s WHERE s.id = v_slot.id FOR UPDATE;
      v_slot_exists := FOUND;
      IF v_slot_exists AND v_old_slot.meeting_program_id <> p_program_id THEN
        RAISE EXCEPTION 'La intervención % ya pertenece a otro programa.', v_slot.title;
      END IF;

      v_same_slot_review := v_slot_exists AND v_old_slot.eligibility_confirmed IS TRUE
        AND v_old_slot.eligibility_confirmed_by IS NOT NULL
        AND v_old_slot.eligibility_confirmed_at IS NOT NULL
        AND v_old_slot.title IS NOT DISTINCT FROM v_slot.title
        AND v_old_slot.assignment_type IS NOT DISTINCT FROM v_slot.assignment_type
        AND v_old_slot.primary_participant_id IS NOT DISTINCT FROM v_slot.primary_participant_id
        AND v_old_slot.assistant_participant_id IS NOT DISTINCT FROM v_slot.assistant_participant_id;

      IF v_slot.eligibility_confirmed IS TRUE AND NOT v_same_slot_review AND v_role NOT IN ('administrator','user') THEN
        RAISE EXCEPTION 'Solo un usuario autorizado puede confirmar la elegibilidad de %.', v_slot.title;
      END IF;
      IF v_slot.eligibility_confirmed IS TRUE AND NOT v_same_slot_review
        AND v_role NOT IN ('administrator','user') THEN
        RAISE EXCEPTION 'La intervención % requiere una nueva confirmación autorizada.', v_slot.title;
      END IF;
      IF NOT v_is_circuit_talk THEN
        IF v_slot.eligibility_confirmed IS NOT TRUE THEN
          RAISE EXCEPTION 'La intervención % no tiene revisión humana S-38-S confirmada.', v_slot.title;
        END IF;
        SELECT m.gender::text, m.appointment::text INTO v_primary_gender, v_primary_appointment
        FROM public.members AS m WHERE m.id = v_slot.primary_participant_id AND m.is_active IS TRUE;
        IF NOT FOUND THEN RAISE EXCEPTION 'La intervención % requiere un participante principal activo.', v_slot.title; END IF;

        CASE v_slot.assignment_type
          WHEN 'treasures_talk','gems' THEN
            IF v_primary_gender IS DISTINCT FROM 'male' OR v_primary_appointment IS NULL OR v_primary_appointment NOT IN ('elder','ministerial_servant') THEN
              RAISE EXCEPTION 'La intervención % requiere un anciano o siervo ministerial varón.', v_slot.title;
            END IF;
          WHEN 'bible_reading','student_talk','bible_study_reader','living_part' THEN
            IF v_primary_gender IS DISTINCT FROM 'male' THEN RAISE EXCEPTION 'La intervención % requiere un participante varón.', v_slot.title; END IF;
          WHEN 'living_needs','bible_study_conductor' THEN
            IF v_primary_appointment IS DISTINCT FROM 'elder' THEN RAISE EXCEPTION 'La intervención % requiere un anciano.', v_slot.title; END IF;
          WHEN 'bible_study' THEN
            IF v_primary_gender IS DISTINCT FROM 'male'
              OR v_primary_appointment IS NULL
              OR v_primary_appointment NOT IN ('elder','ministerial_servant') THEN
              RAISE EXCEPTION 'El conductor del estudio bíblico debe ser un anciano o siervo ministerial activo.';
            END IF;
            IF v_slot.assistant_participant_id IS NULL
              OR v_slot.assistant_participant_id = v_slot.primary_participant_id THEN
              RAISE EXCEPTION 'El estudio bíblico requiere un lector activo distinto del conductor.';
            END IF;
            SELECT m.gender::text, m.appointment::text
              INTO v_assistant_gender, v_assistant_appointment
            FROM public.members AS m
            WHERE m.id = v_slot.assistant_participant_id AND m.is_active IS TRUE;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'El lector del estudio bíblico no está activo.';
            END IF;
            IF v_assistant_gender IS DISTINCT FROM 'male'
              OR v_assistant_appointment IS NULL
              OR v_assistant_appointment NOT IN ('elder','ministerial_servant') THEN
              RAISE EXCEPTION 'El lector del estudio bíblico debe ser un anciano o siervo ministerial activo.';
            END IF;
          WHEN 'conversation','revisit','disciples','explain_beliefs' THEN
            IF v_slot.assistant_participant_id IS NULL OR v_slot.assistant_participant_id = v_slot.primary_participant_id THEN
              RAISE EXCEPTION 'La intervención % requiere un ayudante activo distinto.', v_slot.title;
            END IF;
            SELECT m.gender::text INTO v_assistant_gender FROM public.members AS m
            WHERE m.id = v_slot.assistant_participant_id AND m.is_active IS TRUE;
            IF NOT FOUND THEN RAISE EXCEPTION 'El ayudante de % no está activo.', v_slot.title; END IF;
            IF v_slot.assignment_type IN ('revisit','disciples') AND v_assistant_gender IS DISTINCT FROM v_primary_gender THEN
              RAISE EXCEPTION 'Titular y ayudante de % deben ser del mismo sexo.', v_slot.title;
            END IF;
        END CASE;
      END IF;

      IF v_slot.assistant_participant_id IS NOT NULL AND NOT v_is_circuit_talk THEN
        SELECT m.gender::text INTO v_assistant_gender FROM public.members AS m
        WHERE m.id = v_slot.assistant_participant_id AND m.is_active IS TRUE;
        IF NOT FOUND OR v_slot.assistant_participant_id = v_slot.primary_participant_id THEN
          RAISE EXCEPTION 'El ayudante de % no está activo o no es distinto del titular.', v_slot.title;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF p_leadership_review_confirmed IS TRUE AND (v_review_by IS NULL OR v_review_at IS NULL) THEN
    RAISE EXCEPTION 'La revisión de Presidencia y Consejería no tiene auditoría válida.';
  END IF;

  -- Usar UPDATE para conservar la auditoría de revisiones existentes; un UPSERT dispara
  -- primero el trigger INSERT incluso cuando termina actualizando una fila confirmada.
  IF v_program_exists THEN
    UPDATE public.meeting_programs SET
      meeting_date = p_meeting_date, week_type = p_week_type,
      planning_cycle_id = v_cycle_id, history_period_id = v_period_id,
      chairman_id = p_chairman_id, auxiliary_counselor_id = p_auxiliary_counselor_id,
      leadership_review_confirmed = COALESCE(p_leadership_review_confirmed,FALSE),
      leadership_review_confirmed_by = v_review_by, leadership_review_confirmed_at = v_review_at,
      circuit_overseer_talk_title = NULLIF(BTRIM(p_circuit_overseer_talk_title),''),
      is_draft = TRUE, notes = p_notes, updated_at = NOW()
    WHERE id = p_program_id;
  ELSE
    INSERT INTO public.meeting_programs(
      id, meeting_date, week_type, planning_cycle_id, history_period_id,
      chairman_id, auxiliary_counselor_id, leadership_review_confirmed,
      leadership_review_confirmed_by, leadership_review_confirmed_at,
      circuit_overseer_talk_title, is_draft, notes, updated_at
    ) VALUES (
      p_program_id, p_meeting_date, p_week_type, v_cycle_id, v_period_id,
      p_chairman_id, p_auxiliary_counselor_id, COALESCE(p_leadership_review_confirmed,FALSE),
      v_review_by, v_review_at, NULLIF(BTRIM(p_circuit_overseer_talk_title),''),
      TRUE, p_notes, NOW()
    );
  END IF;

  UPDATE public.assignment_slots AS existing SET is_deleted = TRUE
  WHERE existing.meeting_program_id = p_program_id AND existing.is_deleted = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_slots) AS item(element)
      WHERE (item.element->>'id')::uuid = existing.id
    );

  FOR v_slot IN SELECT * FROM jsonb_to_recordset(p_slots) AS x(
    id UUID, section public.section_enum, title VARCHAR(255), duration_minutes INT,
    order_index INT, is_student_part BOOLEAN, assignment_type VARCHAR(100),
    primary_participant_id UUID, assistant_participant_id UUID,
    eligibility_confirmed BOOLEAN, eligibility_confirmed_by UUID,
    eligibility_confirmed_at TIMESTAMPTZ, notes TEXT
  ) LOOP
    SELECT s.* INTO v_old_slot FROM public.assignment_slots AS s WHERE s.id = v_slot.id FOR UPDATE;
    v_slot_exists := FOUND;

    IF v_slot_exists THEN
      IF v_old_slot.meeting_program_id <> p_program_id THEN RAISE EXCEPTION 'La intervención pertenece a otro programa.'; END IF;
      v_same_slot_review := v_old_slot.eligibility_confirmed IS TRUE
        AND v_old_slot.eligibility_confirmed_by IS NOT NULL
        AND v_old_slot.eligibility_confirmed_at IS NOT NULL
        AND v_old_slot.title IS NOT DISTINCT FROM v_slot.title
        AND v_old_slot.assignment_type IS NOT DISTINCT FROM v_slot.assignment_type
        AND v_old_slot.primary_participant_id IS NOT DISTINCT FROM v_slot.primary_participant_id
        AND v_old_slot.assistant_participant_id IS NOT DISTINCT FROM v_slot.assistant_participant_id;
      IF v_slot.eligibility_confirmed IS TRUE AND v_same_slot_review THEN
        v_slot_review_by := v_old_slot.eligibility_confirmed_by;
        v_slot_review_at := v_old_slot.eligibility_confirmed_at;
      ELSIF v_slot.eligibility_confirmed IS TRUE THEN
        IF v_role NOT IN ('administrator','user') THEN RAISE EXCEPTION 'Solo un usuario autorizado puede confirmar la elegibilidad de una intervención.'; END IF;
        v_slot_review_by := v_actor; v_slot_review_at := NOW();
      ELSE
        v_slot_review_by := NULL; v_slot_review_at := NULL;
      END IF;
      UPDATE public.assignment_slots SET
        section = v_slot.section, title = v_slot.title, duration_minutes = v_slot.duration_minutes,
        order_index = v_slot.order_index, is_student_part = COALESCE(v_slot.is_student_part,FALSE),
        assignment_type = v_slot.assignment_type, primary_participant_id = v_slot.primary_participant_id,
        assistant_participant_id = v_slot.assistant_participant_id,
        eligibility_confirmed = COALESCE(v_slot.eligibility_confirmed,FALSE),
        eligibility_confirmed_by = v_slot_review_by, eligibility_confirmed_at = v_slot_review_at,
        is_deleted = FALSE, notes = v_slot.notes
      WHERE id = v_slot.id;
    ELSE
      IF v_slot.eligibility_confirmed IS TRUE AND v_role NOT IN ('administrator','user') THEN
        RAISE EXCEPTION 'Solo un usuario autorizado puede confirmar la elegibilidad de una nueva intervención.';
      END IF;
      IF v_slot.eligibility_confirmed IS TRUE THEN
        v_slot_review_by := v_actor; v_slot_review_at := NOW();
      ELSE
        v_slot_review_by := NULL; v_slot_review_at := NULL;
      END IF;
      INSERT INTO public.assignment_slots(
        id, meeting_program_id, section, title, duration_minutes, order_index, is_student_part,
        assignment_type, primary_participant_id, assistant_participant_id,
        eligibility_confirmed, eligibility_confirmed_by, eligibility_confirmed_at, is_deleted, notes
      ) VALUES (
        v_slot.id, p_program_id, v_slot.section, v_slot.title, v_slot.duration_minutes, v_slot.order_index,
        COALESCE(v_slot.is_student_part,FALSE), v_slot.assignment_type, v_slot.primary_participant_id,
        v_slot.assistant_participant_id, COALESCE(v_slot.eligibility_confirmed,FALSE),
        v_slot_review_by, v_slot_review_at, FALSE, v_slot.notes
      );
    END IF;
  END LOOP;

  IF p_is_draft IS FALSE THEN
    UPDATE public.meeting_programs SET is_draft = FALSE, updated_at = NOW()
    WHERE id = p_program_id;
  END IF;
  RETURN p_program_id;
END;
$function$
