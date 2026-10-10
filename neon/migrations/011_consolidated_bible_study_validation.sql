-- Add support for the consolidated Congregation Bible Study assignment.
-- This function patch preserves the live definition and its current access-control rules.
DO $migration$
DECLARE
  v_signature CONSTANT TEXT := 'public.save_meeting_program_transaction(uuid,date,public.week_type_enum,uuid,uuid,boolean,uuid,timestamptz,character varying,boolean,text,jsonb)';
  v_definition TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(v_signature))
    INTO v_definition;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'No se encontró la función %.', v_signature;
  END IF;

  IF pg_catalog.strpos(v_definition, $old$  v_assistant_gender TEXT;$old$) = 0 THEN
    RAISE EXCEPTION 'La función no contiene la declaración esperada de v_assistant_gender; no se aplicó ningún cambio.';
  END IF;
  v_definition := pg_catalog.replace(
    v_definition,
    $old$  v_assistant_gender TEXT;$old$,
    $new$  v_assistant_gender TEXT;
  v_assistant_appointment TEXT;$new$
  );

  IF pg_catalog.strpos(v_definition, $old$('living_part','living_needs','bible_study_conductor','bible_study_reader')$old$) = 0 THEN
    RAISE EXCEPTION 'No se encontró la validación de sección de Nuestra vida cristiana; no se aplicó ningún cambio.';
  END IF;
  v_definition := pg_catalog.replace(
    v_definition,
    $old$('living_part','living_needs','bible_study_conductor','bible_study_reader')$old$,
    $new$('living_part','living_needs','bible_study','bible_study_conductor','bible_study_reader')$new$
  );

  IF pg_catalog.strpos(v_definition, $old$v_slot.assignment_type NOT IN ('treasures_talk','gems','bible_reading','conversation','revisit','disciples','explain_beliefs','student_talk','living_part','living_needs','bible_study_conductor','bible_study_reader')$old$) = 0 THEN
    RAISE EXCEPTION 'No se encontró la lista de tipos admitidos; no se aplicó ningún cambio.';
  END IF;
  v_definition := pg_catalog.replace(
    v_definition,
    $old$v_slot.assignment_type NOT IN ('treasures_talk','gems','bible_reading','conversation','revisit','disciples','explain_beliefs','student_talk','living_part','living_needs','bible_study_conductor','bible_study_reader')$old$,
    $new$v_slot.assignment_type NOT IN ('treasures_talk','gems','bible_reading','conversation','revisit','disciples','explain_beliefs','student_talk','living_part','living_needs','bible_study','bible_study_conductor','bible_study_reader')$new$
  );

  IF pg_catalog.strpos(v_definition, $old$          WHEN 'conversation','revisit','disciples','explain_beliefs' THEN$old$) = 0 THEN
    RAISE EXCEPTION 'No se encontró el bloque CASE de reglas de asignación; no se aplicó ningún cambio.';
  END IF;
  v_definition := pg_catalog.replace(
    v_definition,
    $old$          WHEN 'conversation','revisit','disciples','explain_beliefs' THEN$old$,
    $new$          WHEN 'bible_study' THEN
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
          WHEN 'conversation','revisit','disciples','explain_beliefs' THEN$new$
  );

  EXECUTE v_definition;
END
$migration$;
