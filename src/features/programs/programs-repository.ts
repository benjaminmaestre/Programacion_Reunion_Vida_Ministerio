import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  program: MeetingProgramDetail
): Promise<void> {
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
      is_draft: isDraft,
      notes: program.notes || null,
      updated_at: new Date().toISOString(),
    });

  if (progError) {
    throw new Error("No se pudo guardar el programa en la base de datos.");
  }

  // Cleanup removed slots from draft
  const currentSlotIds = program.slots.map((s) => s.id);
  const { data: existingSlots } = await supabase
    .from("assignment_slots")
    .select("id")
    .eq("meeting_program_id", program.id);

  if (existingSlots && existingSlots.length > 0) {
    const toDelete = existingSlots
      .map((s: { id: string }) => s.id)
      .filter((id: string) => !currentSlotIds.includes(id));

    if (toDelete.length > 0) {
      await supabase
        .from("assignment_slots")
        .delete()
        .in("id", toDelete);
    }
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
        notes: slot.notes || null,
      });

    if (slotError) {
      throw new Error(`No se pudo actualizar la asignación "${slot.title}" en Supabase.`);
    }
  }
}
