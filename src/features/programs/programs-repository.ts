import { createNeonBrowserClient } from "@/lib/neon/client";
import { assertCanManageDirectory } from "../members/members-repository";
import { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";

type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;

interface DbMeetingProgramRow {
  id: string;
  meeting_date: string;
  week_type: "normal" | "circuit_overseer" | "assembly" | "memorial";
  planning_cycle_id: string | null;
  history_period_id: string | null;
  chairman_id: string | null;
  auxiliary_counselor_id: string | null;
  opening_prayer_participant_id?: string | null;
  closing_prayer_participant_id?: string | null;
  leadership_review_confirmed?: boolean | null;
  leadership_review_confirmed_by?: string | null;
  leadership_review_confirmed_at?: string | null;
  circuit_overseer_talk_title: string | null;
  weekly_bible_reading?: string | null;
  opening_song_number?: number | null;
  living_song_number?: number | null;
  closing_song_number?: number | null;
  is_draft: boolean;
  notes: string | null;
  updated_at: string;
}

interface DbAssignmentSlotRow {
  id: string;
  meeting_program_id: string;
  section: "treasures" | "ministers" | "living" | "auxiliary";
  title: string;
  duration_minutes: number;
  order_index: number;
  is_student_part: boolean;
  assignment_type: string | null;
  primary_participant_id: string | null;
  assistant_participant_id: string | null;
  eligibility_confirmed?: boolean | null;
  eligibility_confirmed_by?: string | null;
  eligibility_confirmed_at?: string | null;
  is_deleted?: boolean | null;
  notes: string | null;
}

export async function getMeetingProgramsFromNeon(
  neon: NeonBrowserClient
): Promise<MeetingProgramDetail[]> {
  const { data: programsData, error: progError } = await neon
    .from("meeting_programs")
    .select("*")
    .order("meeting_date", { ascending: true });

  if (progError) {
    throw new Error("No se pudieron cargar los programas de la reunión desde Neon.");
  }

  if (!programsData || programsData.length === 0) {
    return [];
  }

  const typedPrograms = programsData as unknown as DbMeetingProgramRow[];
  const programIds = typedPrograms.map((p) => p.id);
  const { data: cyclesData, error: cyclesError } = await neon
    .from("planning_cycles")
    .select("id, year, bimonth_number");
  if (cyclesError) throw new Error("No se pudieron cargar los ciclos de planificación.");

  const { data: periodsData, error: periodsError } = await neon
    .from("history_periods")
    .select("id, year, semester");
  if (periodsError) throw new Error("No se pudieron cargar los períodos históricos.");

  const cycleLabels = new Map<string, string>(
    ((cyclesData ?? []) as Array<{ id: string; year: number; bimonth_number: number }>)
      .map((cycle) => [cycle.id, `${cycle.year}-${cycle.bimonth_number}`]),
  );
  const periodLabels = new Map<string, string>(
    ((periodsData ?? []) as Array<{ id: string; year: number; semester: number }>)
      .map((period) => [period.id, `${period.year}-S${period.semester}`]),
  );

  const { data: slotsData, error: slotsError } = await neon
    .from("assignment_slots")
    .select("*")
    .in("meeting_program_id", programIds)
    .eq("is_deleted", false)
    .order("order_index", { ascending: true });

  if (slotsError) {
    throw new Error("No se pudieron cargar los espacios de asignaciones desde Neon.");
  }

  const slotsByProgram = new Map<string, AssignmentSlotDetail[]>();
  for (const slot of (slotsData ?? []) as DbAssignmentSlotRow[]) {
    const list = slotsByProgram.get(slot.meeting_program_id) || [];
    list.push({
      id: slot.id,
      meetingProgramId: slot.meeting_program_id,
      section: slot.section,
      title: slot.title,
      durationMinutes: slot.duration_minutes,
      orderIndex: slot.order_index,
      isStudentPart: slot.is_student_part,
      assignmentType: (slot.assignment_type as AssignmentSlotDetail["assignmentType"]) || undefined,
      primaryParticipantId: slot.primary_participant_id || undefined,
      assistantParticipantId: slot.assistant_participant_id || undefined,
      eligibilityConfirmed: slot.eligibility_confirmed === true,
      eligibilityConfirmedBy: slot.eligibility_confirmed_by || undefined,
      eligibilityConfirmedAt: slot.eligibility_confirmed_at || undefined,
      isDeleted: slot.is_deleted === true,
      notes: slot.notes || undefined,
    });
    slotsByProgram.set(slot.meeting_program_id, list);
  }

  function normalizeLegacyBibleStudySlots(slots: AssignmentSlotDetail[]): AssignmentSlotDetail[] {
    const conductor = slots.find((slot) => slot.assignmentType === "bible_study_conductor");
    const reader = slots.find((slot) => slot.assignmentType === "bible_study_reader");
    if (!conductor && !reader) return slots;

    // Los programas guardados antes de la consolidación tenían dos filas.
    // Se muestran como una sola, preservando conductor y lector.
    const canonical = conductor ?? reader!;
    const normalized: AssignmentSlotDetail = {
      ...canonical,
      title: "Estudio bíblico de la congregación",
      assignmentType: "bible_study",
      section: "living",
      isStudentPart: false,
      primaryParticipantId: conductor?.primaryParticipantId ?? canonical.primaryParticipantId,
      assistantParticipantId: reader?.primaryParticipantId ?? reader?.assistantParticipantId
        ?? conductor?.assistantParticipantId,
      eligibilityConfirmed: false,
      eligibilityConfirmedBy: undefined,
      eligibilityConfirmedAt: undefined,
      orderIndex: Math.min(conductor?.orderIndex ?? Number.MAX_SAFE_INTEGER, reader?.orderIndex ?? Number.MAX_SAFE_INTEGER),
    };
    return slots
      .filter((slot) => slot !== conductor && slot !== reader)
      .concat(normalized)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((slot, index) => ({ ...slot, orderIndex: index + 1 }));
  }

  return (programsData as DbMeetingProgramRow[]).map((p) => ({
    id: p.id,
    meetingDate: p.meeting_date,
    weekType: p.week_type,
    bimonthCycle: p.planning_cycle_id ? cycleLabels.get(p.planning_cycle_id) ?? "" : "",
    historyPeriod: p.history_period_id ? periodLabels.get(p.history_period_id) ?? "" : "",
    weeklyBibleReading: p.weekly_bible_reading || undefined,
    openingSongNumber: p.opening_song_number ?? undefined,
    livingSongNumber: p.living_song_number ?? undefined,
    closingSongNumber: p.closing_song_number ?? undefined,
    planningCycleId: p.planning_cycle_id || undefined,
    historyPeriodId: p.history_period_id || undefined,
    chairmanId: p.chairman_id || undefined,
    auxiliaryCounselorId: p.auxiliary_counselor_id || undefined,
    openingPrayerParticipantId: p.opening_prayer_participant_id || undefined,
    closingPrayerParticipantId: p.closing_prayer_participant_id || undefined,
    leadershipReviewConfirmed: p.leadership_review_confirmed === true,
    leadershipReviewConfirmedBy: p.leadership_review_confirmed_by || undefined,
    leadershipReviewConfirmedAt: p.leadership_review_confirmed_at || undefined,
    circuitOverseerTalkTitle: p.circuit_overseer_talk_title || undefined,
    status: p.is_draft ? "draft" : "published",
    notes: p.notes || undefined,
    updatedAt: p.updated_at,
    slots: normalizeLegacyBibleStudySlots(slotsByProgram.get(p.id) || []),
  }));
}

export async function saveMeetingProgramToNeon(
  neon: NeonBrowserClient,
  userId: string,
  program: MeetingProgramDetail
): Promise<void> {
  // Esta comprobación mejora el mensaje en interfaz; PostgreSQL vuelve a comprobar
  // identidad y rol dentro de la RPC privilegiada.
  await assertCanManageDirectory(neon, userId);

  if (typeof neon.rpc !== "function") {
    throw new Error("El cliente de Neon no soporta llamadas RPC transaccionales.");
  }

  const { data, error } = await neon.rpc("save_meeting_program_with_guide", {
    p_program_id: program.id,
    p_meeting_date: program.meetingDate,
    p_week_type: program.weekType,
    p_chairman_id: program.chairmanId || null,
    p_auxiliary_counselor_id: program.auxiliaryCounselorId || null,
    p_leadership_review_confirmed: program.leadershipReviewConfirmed === true,
    // La identidad y fecha de la revisión se obtienen/validan en PostgreSQL, no del cliente.
    p_leadership_review_confirmed_by: null,
    p_leadership_review_confirmed_at: null,
    p_circuit_overseer_talk_title: program.circuitOverseerTalkTitle || null,
    p_is_draft: program.status === "draft",
    p_notes: program.notes || null,
    p_slots: program.slots.map((slot) => ({
      id: slot.id,
      section: slot.section,
      title: slot.title,
      duration_minutes: slot.durationMinutes,
      order_index: slot.orderIndex,
      is_student_part: slot.isStudentPart,
      assignment_type: slot.assignmentType || null,
      primary_participant_id: slot.primaryParticipantId || null,
      assistant_participant_id: slot.assistantParticipantId || null,
      eligibility_confirmed: slot.eligibilityConfirmed === true,
      eligibility_confirmed_by: null,
      eligibility_confirmed_at: null,
      notes: slot.notes || null,
    })),
    p_weekly_bible_reading: program.weeklyBibleReading || null,
    p_opening_song_number: program.openingSongNumber ?? null,
    p_living_song_number: program.livingSongNumber ?? null,
    p_closing_song_number: program.closingSongNumber ?? null,
    p_opening_prayer_participant_id: program.openingPrayerParticipantId || null,
    p_closing_prayer_participant_id: program.closingPrayerParticipantId || null,
  });

  if (error) {
    const rpcError = error as { code?: string; message?: string };
    if (rpcError.code === "PGRST202" || /could not find the function|schema cache/i.test(rpcError.message ?? "")) {
      throw new Error("No está desplegada la RPC save_meeting_program_with_guide. Revisa las migraciones requeridas en el proyecto Neon autorizado.");
    }
    throw new Error(rpcError.message || "No se pudo guardar el programa mediante la transacción atómica de Neon.");
  }

  if (typeof data === "string" && data.toLowerCase() !== program.id.toLowerCase()) {
    throw new Error("Neon devolvió un identificador diferente al del programa guardado.");
  }
}

/**
 * Reabre un programa publicado como borrador sin borrar sus datos.
 * La RPC valida el rol y realiza la transición bajo el propietario autorizado
 * para mantener el bloqueo contra escrituras directas sobre programas publicados.
 */
export async function reopenMeetingProgramInNeon(
  neon: NeonBrowserClient,
  userId: string,
  programId: string,
): Promise<void> {
  await assertCanManageDirectory(neon, userId);

  if (typeof neon.rpc !== "function") {
    throw new Error("El cliente de Neon no soporta llamadas RPC transaccionales.");
  }

  const { data, error } = await neon.rpc("reopen_meeting_program", {
    p_program_id: programId,
  });

  if (error) {
    const rpcError = error as { code?: string; message?: string };
    if (rpcError.code === "PGRST202" || /could not find the function|schema cache/i.test(rpcError.message ?? "")) {
      throw new Error("No está desplegada la RPC reopen_meeting_program. Revisa la migración de reapertura de programas.");
    }
    throw new Error(rpcError.message || "No se pudo reabrir el programa publicado.");
  }

  if (typeof data === "string" && data.toLowerCase() !== programId.toLowerCase()) {
    throw new Error("Neon devolvió un identificador diferente al del programa reabierto.");
  }
}

/**
 * Elimina permanentemente un programa en borrador y sus intervenciones asociadas.
 * Los programas publicados no se pueden eliminar directamente.
 */
export async function deleteDraftProgramInNeon(
  neon: NeonBrowserClient,
  userId: string,
  programId: string
): Promise<void> {
  await assertCanManageDirectory(neon, userId);

  if (typeof neon.rpc !== "function") {
    throw new Error("El cliente de Neon no soporta llamadas RPC transaccionales.");
  }

  const { data, error } = await neon.rpc("delete_draft_meeting_program", {
    p_program_id: programId,
  });

  if (error) {
    const rpcError = error as { code?: string; message?: string };
    if (rpcError.code === "PGRST202" || /could not find the function|schema cache/i.test(rpcError.message ?? "")) {
      throw new Error("No está desplegada la RPC delete_draft_meeting_program. Revisa la migración de eliminación de borradores.");
    }
    throw new Error(rpcError.message || "No se pudo eliminar el borrador.");
  }

  if (typeof data === "string" && data.toLowerCase() !== programId.toLowerCase()) {
    throw new Error("Neon devolvió un identificador diferente al del programa eliminado.");
  }
}

/**
 * Elimina permanentemente varios programas en borrador y sus intervenciones asociadas.
 * Reutiliza la eliminación individual, que protege los programas publicados.
 * Devuelve la cantidad de borradores eliminados.
 */
export async function deleteAllDraftProgramsInNeon(
  neon: NeonBrowserClient,
  userId: string,
  programIds: string[]
): Promise<number> {
  let deleted = 0;
  for (const programId of programIds) {
    await deleteDraftProgramInNeon(neon, userId, programId);
    deleted += 1;
  }
  return deleted;
}

