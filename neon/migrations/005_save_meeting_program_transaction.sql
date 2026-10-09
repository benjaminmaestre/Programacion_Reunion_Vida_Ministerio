-- MIGRACIÓN 005: FUNCIÓN RPC TRANSACCIONAL Y SEGURIDAD ESTRICTA (RLS + SECURITY DEFINER)

-- 1. Asegurar restricciones de unicidad para evitar duplicados por concurrencia
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_planning_cycles_year_bimonth'
    ) THEN
        ALTER TABLE planning_cycles ADD CONSTRAINT uq_planning_cycles_year_bimonth UNIQUE (year, bimonth_number);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_history_periods_year_semester'
    ) THEN
        ALTER TABLE history_periods ADD CONSTRAINT uq_history_periods_year_semester UNIQUE (year, semester);
    END IF;
END $$;

-- 2. Función auxiliar interna para resolver o crear ciclo de planificación bimestral
CREATE OR REPLACE FUNCTION resolve_or_create_planning_cycle(
    p_year INT,
    p_bimonth INT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id FROM public.planning_cycles WHERE year = p_year AND bimonth_number = p_bimonth;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    INSERT INTO public.planning_cycles (year, bimonth_number)
    VALUES (p_year, p_bimonth)
    ON CONFLICT (year, bimonth_number) DO UPDATE SET bimonth_number = EXCLUDED.bimonth_number
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Función auxiliar interna para resolver o crear período histórico semestral
CREATE OR REPLACE FUNCTION resolve_or_create_history_period(
    p_year INT,
    p_semester INT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id FROM public.history_periods WHERE year = p_year AND semester = p_semester;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    INSERT INTO public.history_periods (year, semester, start_date, end_date)
    VALUES (p_year, p_semester, p_start_date, p_end_date)
    ON CONFLICT (year, semester) DO UPDATE SET start_date = EXCLUDED.start_date
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Función RPC transaccional completa y protegida para guardado de programas de reunión
CREATE OR REPLACE FUNCTION save_meeting_program_transaction(
    p_program_id UUID,
    p_meeting_date DATE,
    p_week_type week_type_enum,
    p_chairman_id UUID DEFAULT NULL,
    p_auxiliary_counselor_id UUID DEFAULT NULL,
    p_leadership_review_confirmed BOOLEAN DEFAULT false,
    p_leadership_review_confirmed_by UUID DEFAULT NULL,
    p_leadership_review_confirmed_at TIMESTAMPTZ DEFAULT NULL,
    p_circuit_overseer_talk_title VARCHAR(255) DEFAULT NULL,
    p_is_draft BOOLEAN DEFAULT true,
    p_notes TEXT DEFAULT NULL,
    p_slots JSONB DEFAULT '[]'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_calling_user_id UUID;
    v_user_role VARCHAR(50);
    v_year INT;
    v_month INT;
    v_bimonth INT;
    v_semester INT;
    v_cycle_id UUID;
    v_period_id UUID;
    v_existing_draft BOOLEAN;
    v_existing_date DATE;
    v_slot RECORD;
    v_review_by UUID;
    v_review_at TIMESTAMPTZ;
    v_slot_review_by UUID;
    v_slot_review_at TIMESTAMPTZ;
BEGIN
    -- A. Autenticación y Autorización en base de datos
    v_calling_user_id := auth.uid();
    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere sesión autenticada.';
    END IF;

    SELECT role INTO v_user_role
    FROM public.app_users
    WHERE user_id = v_calling_user_id AND is_active = true;

    IF v_user_role IS NULL OR v_user_role NOT IN ('administrator', 'elder', 'coordinator') THEN
        RAISE EXCEPTION 'Acceso denegado: tu rol no permite crear o editar programas de reunión.';
    END IF;

    -- B. Verificar si el programa ya existe y su estado de borrador
    SELECT is_draft, meeting_date INTO v_existing_draft, v_existing_date
    FROM public.meeting_programs
    WHERE id = p_program_id;

    IF v_existing_draft = false THEN
        RAISE EXCEPTION 'El programa ya está publicado y se encuentra protegido contra modificaciones.';
    END IF;

    -- C. Prevenir duplicidad de fechas con otro programa distinto
    IF EXISTS (
        SELECT 1 FROM public.meeting_programs
        WHERE meeting_date = p_meeting_date AND id <> p_program_id
    ) THEN
        RAISE EXCEPTION 'Ya existe otro programa diferente guardado para la fecha %.', p_meeting_date;
    END IF;

    -- D. Calcular y resolver ciclo y período obligatorios
    v_year := EXTRACT(YEAR FROM p_meeting_date);
    v_month := EXTRACT(MONTH FROM p_meeting_date);
    v_bimonth := CEIL(v_month / 2.0);
    v_semester := CASE WHEN v_month <= 6 THEN 1 ELSE 2 END;

    v_cycle_id := public.resolve_or_create_planning_cycle(v_year, v_bimonth);
    v_period_id := public.resolve_or_create_history_period(
        v_year,
        v_semester,
        MAKE_DATE(v_year, CASE WHEN v_semester = 1 THEN 1 ELSE 7 END, 1),
        MAKE_DATE(v_year, CASE WHEN v_semester = 1 THEN 6 ELSE 12 END, CASE WHEN v_semester = 1 THEN 30 ELSE 31 END)
    );

    IF v_cycle_id IS NULL OR v_period_id IS NULL THEN
        RAISE EXCEPTION 'No se pudieron establecer los identificadores de ciclo y período obligatorios.';
    END IF;

    -- E. Trazabilidad segura de revisión de Presidencia y Consejería
    IF p_leadership_review_confirmed = true THEN
        v_review_by := v_calling_user_id;
        v_review_at := NOW();
    ELSE
        v_review_by := NULL;
        v_review_at := NULL;
    END IF;

    -- F. Upsert de programa de reunión
    INSERT INTO public.meeting_programs (
        id, meeting_date, week_type, planning_cycle_id, history_period_id,
        chairman_id, auxiliary_counselor_id, leadership_review_confirmed,
        leadership_review_confirmed_by, leadership_review_confirmed_at,
        circuit_overseer_talk_title, is_draft, notes, updated_at
    ) VALUES (
        p_program_id, p_meeting_date, p_week_type, v_cycle_id, v_period_id,
        p_chairman_id, p_auxiliary_counselor_id, p_leadership_review_confirmed,
        v_review_by, v_review_at,
        p_circuit_overseer_talk_title, true, p_notes, NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        meeting_date = EXCLUDED.meeting_date,
        week_type = EXCLUDED.week_type,
        planning_cycle_id = EXCLUDED.planning_cycle_id,
        history_period_id = EXCLUDED.history_period_id,
        chairman_id = EXCLUDED.chairman_id,
        auxiliary_counselor_id = EXCLUDED.auxiliary_counselor_id,
        leadership_review_confirmed = EXCLUDED.leadership_review_confirmed,
        leadership_review_confirmed_by = EXCLUDED.leadership_review_confirmed_by,
        leadership_review_confirmed_at = EXCLUDED.leadership_review_confirmed_at,
        circuit_overseer_talk_title = EXCLUDED.circuit_overseer_talk_title,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- G. Retiro lógico de intervenciones ausentes
    UPDATE public.assignment_slots
    SET is_deleted = true
    WHERE meeting_program_id = p_program_id
      AND is_deleted = false
      AND id NOT IN (
          SELECT (elem->>'id')::uuid FROM jsonb_array_elements(p_slots) AS elem WHERE elem->>'id' IS NOT NULL
      );

    -- H. Insertar / actualizar intervenciones activas con auditoría autenticada
    FOR v_slot IN SELECT * FROM jsonb_to_recordset(p_slots) AS x(
        id UUID, section section_enum, title VARCHAR(255), duration_minutes INT,
        order_index INT, is_student_part BOOLEAN, assignment_type VARCHAR(100),
        primary_participant_id UUID, assistant_participant_id UUID,
        eligibility_confirmed BOOLEAN, eligibility_confirmed_by UUID,
        eligibility_confirmed_at TIMESTAMPTZ, notes TEXT
    ) LOOP
        IF v_slot.eligibility_confirmed = true THEN
            v_slot_review_by := v_calling_user_id;
            v_slot_review_at := NOW();
        ELSE
            v_slot_review_by := NULL;
            v_slot_review_at := NULL;
        END IF;

        INSERT INTO public.assignment_slots (
            id, meeting_program_id, section, title, duration_minutes,
            order_index, is_student_part, assignment_type,
            primary_participant_id, assistant_participant_id,
            eligibility_confirmed, eligibility_confirmed_by,
            eligibility_confirmed_at, is_deleted, notes
        ) VALUES (
            v_slot.id, p_program_id, v_slot.section, v_slot.title, v_slot.duration_minutes,
            v_slot.order_index, COALESCE(v_slot.is_student_part, false), v_slot.assignment_type,
            v_slot.primary_participant_id, v_slot.assistant_participant_id,
            COALESCE(v_slot.eligibility_confirmed, false), v_slot_review_by,
            v_slot_review_at, false, v_slot.notes
        ) ON CONFLICT (id) DO UPDATE SET
            section = EXCLUDED.section,
            title = EXCLUDED.title,
            duration_minutes = EXCLUDED.duration_minutes,
            order_index = EXCLUDED.order_index,
            is_student_part = EXCLUDED.is_student_part,
            assignment_type = EXCLUDED.assignment_type,
            primary_participant_id = EXCLUDED.primary_participant_id,
            assistant_participant_id = EXCLUDED.assistant_participant_id,
            eligibility_confirmed = EXCLUDED.eligibility_confirmed,
            eligibility_confirmed_by = EXCLUDED.eligibility_confirmed_by,
            eligibility_confirmed_at = EXCLUDED.eligibility_confirmed_at,
            is_deleted = false,
            notes = EXCLUDED.notes;
    END LOOP;

    -- I. Si se solicitó publicar, cambiar is_draft a false al final de la transacción
    IF p_is_draft = false THEN
        UPDATE public.meeting_programs SET is_draft = false, updated_at = NOW() WHERE id = p_program_id;
    END IF;

    RETURN p_program_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Revocación de permisos en PUBLIC/anonymous y concesión estricta a authenticated
REVOKE EXECUTE ON FUNCTION resolve_or_create_planning_cycle(INT, INT) FROM PUBLIC, anonymous;
REVOKE EXECUTE ON FUNCTION resolve_or_create_history_period(INT, INT, DATE, DATE) FROM PUBLIC, anonymous;
REVOKE EXECUTE ON FUNCTION save_meeting_program_transaction(UUID, DATE, week_type_enum, UUID, UUID, BOOLEAN, UUID, TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anonymous;

GRANT EXECUTE ON FUNCTION save_meeting_program_transaction(UUID, DATE, week_type_enum, UUID, UUID, BOOLEAN, UUID, TIMESTAMPTZ, VARCHAR, BOOLEAN, TEXT, JSONB) TO authenticated;
