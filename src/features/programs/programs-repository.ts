import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { assertCanManageDirectory } from "../members/members-repository";
import { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

interface DbMeetingProgramRow {
  id: string;
  meeting_date: string;
  week_type: "normal" | "circuit_overseer" | "assembly" | "memorial";
  planning_cycle_id: string | null;
  history_period_id: string | null;
  chairman_id: string | null;
  auxiliary_counselor_id: string | null;
  circuit_overseer_talk_title: string | null;
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
  notes: string | null;
}

export async function getMeetingProgramsFromSupabase(
  supabase: SupabaseBrowserClient
): Promise<MeetingProgramDetail[]> {
  const { data: programsData, error: progError } = await supabase
    .from("meeting_programs")
    .select("*")
    .order("meeting_date", { ascending: true });

  if (progError) {
    throw new Error("No se pudieron cargar los programas de la reunión desde Supabase.");
  }

  if (!programsData || programsData.length === 0) {
    return [];
  }

  const programIds = (programsData as unknown as DbMeetingProgramRow[]).map((p) => p.id);
  const { data: slotsData, error: slotsError } = await supabase
    .from("assignment_slots")
    .select("*")
    .in("meeting_program_id", programIds)
    .order("order_index", { ascending: true });

  if (slotsError) {
    throw new Error("No se pudieron cargar los espacios de asignaciones desde Supabase.");
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
      notes: slot.notes || undefined,
    });
    slotsByProgram.set(slot.meeting_program_id, list);
  }

  return (programsData as DbMeetingProgramRow[]).map((p) => ({
    id: p.id,
    meetingDate: p.meeting_date,
    weekType: p.week_type,
    bimonthCycle: p.planning_cycle_id || "2026-6",
    historyPeriod: p.history_period_id || "2026-S2",
    chairmanId: p.chairman_id || undefined,
    auxiliaryCounselorId: p.auxiliary_counselor_id || undefined,
    circuitOverseerTalkTitle: p.circuit_overseer_talk_title || undefined,
    status: p.is_draft ? "draft" : "published",
    notes: p.notes || undefined,
    updatedAt: p.updated_at,
    slots: slotsByProgram.get(p.id) || [],
  }));
}

export async function saveMeetingProgramToSupabase(
  supabase: SupabaseBrowserClient,
  userId: string,
  program: MeetingProgramDetail
): Promise<void> {
  await assertCanManageDirectory(supabase, userId);
  const { data: existingProgram, error: existingProgramError } = await supabase
    .from("meeting_programs")
    .select("is_draft")
    .eq("id", program.id)
    .maybeSingle();

  if (existingProgramError) throw new Error("No se pudo comprobar el estado actual del programa.");
  if (existingProgram && existingProgram.is_draft === false) {
    throw new Error("Este programa ya está publicado y se protege contra modificaciones. No se guardaron cambios.");
  }

  const { data: existingSlots, error: existingSlotsError } = await supabase
    .from("assignment_slots")
    .select("id")
    .eq("meeting_program_id", program.id);
  if (existingSlotsError) throw new Error("No se pudo comprobar la integridad de las intervenciones.");

  const currentSlotIds = program.slots.map((slot) => slot.id);
  const existingSlotIds = (existingSlots ?? []).map((slot: { id: string }) => slot.id);
  const toDelete = existingSlotIds.filter((id: string) => !currentSlotIds.includes(id));
  if (program.status === "published" && toDelete.length > 0) {
    throw new Error("No se pueden eliminar intervenciones al publicar. Guarda el borrador y revisa los cambios.");
  }

  const isDraft = program.status === "draft";
  const { error: progError } = await supabase
    .from("meeting_programs")
    .upsert({
      id: program.id,
      meeting_date: program.meetingDate,
      week_type: program.weekType,
      planning_cycle_id: program.bimonthCycle,
      history_period_id: program.historyPeriod,
      chairman_id: program.chairmanId || null,
      auxiliary_counselor_id: program.auxiliaryCounselorId || null,
      circuit_overseer_talk_title: program.circuitOverseerTalkTitle || null,
      // Publicar es el último paso: si falla una asignación, el programa permanece como borrador.
      is_draft: true,
      notes: program.notes || null,
      updated_at: new Date().toISOString(),
    });

  if (progError) {
    throw new Error("No se pudo guardar el programa en la base de datos.");
  }

  // Solo se eliminan intervenciones que pertenecen a un borrador existente.
  if (isDraft && toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("assignment_slots")
      .delete()
      .in("id", toDelete);
    if (deleteError) throw new Error("No se pudieron eliminar las intervenciones del borrador.");
  }

  for (const slot of program.slots) {
    const { error: slotError } = await supabase
      .from("assignment_slots")
      .upsert({
        id: slot.id,
        meeting_program_id: program.id,
        section: slot.section,
        title: slot.title,
        duration_minutes: slot.durationMinutes,
        order_index: slot.orderIndex,
        is_student_part: slot.isStudentPart,
        assignment_type: slot.assignmentType || null,
        primary_participant_id: slot.primaryParticipantId || null,
        assistant_participant_id: slot.assistantParticipantId || null,
        eligibility_confirmed: slot.eligibilityConfirmed === true,
        eligibility_confirmed_by: slot.eligibilityConfirmed ? (slot.eligibilityConfirmedBy || userId) : null,
        eligibility_confirmed_at: slot.eligibilityConfirmed ? new Date().toISOString() : null,
        notes: slot.notes || null,
      });

    if (slotError) {
      throw new Error(`No se pudo actualizar la asignación "${slot.title}" en Supabase.`);
    }
  }

  if (!isDraft) {
    const { error: publishError } = await supabase
      .from("meeting_programs")
      .update({ is_draft: false, updated_at: new Date().toISOString() })
      .eq("id", program.id);
    if (publishError) {
      throw new Error("Las asignaciones se guardaron, pero no se pudo completar la publicación. El programa permanece como borrador.");
    }
  }
}
