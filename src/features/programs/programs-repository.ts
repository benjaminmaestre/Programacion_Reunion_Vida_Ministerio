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
  leadership_review_confirmed?: boolean | null;
  leadership_review_confirmed_by?: string | null;
  leadership_review_confirmed_at?: string | null;
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
  eligibility_confirmed_at?: string | null;
  is_deleted?: boolean | null;
  notes: string | null;
}

export async function resolvePlanningCycleUuid(
  supabase: SupabaseBrowserClient,
  meetingDate: string
): Promise<string | null> {
  const date = new Date(`${meetingDate}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const bimonthNumber = Math.ceil((date.getUTCMonth() + 1) / 2);

  const { data, error } = await supabase
    .from("planning_cycles")
    .select("id")
    .eq("year", year)
    .eq("bimonth_number", bimonthNumber)
    .maybeSingle();

  if (!error && data && (data as { id: string }).id) {
    return (data as { id: string }).id;
  }

  // Attempt to auto-create missing cycle
  const { data: newCycle, error: insertError } = await supabase
    .from("planning_cycles")
    .insert({ year, bimonth_number: bimonthNumber })
    .select("id")
    .maybeSingle();

  if (!insertError && newCycle && (newCycle as { id: string }).id) {
    return (newCycle as { id: string }).id;
  }

  // If insertion hit a conflict or race condition, query once more
  const { data: retryData } = await supabase
    .from("planning_cycles")
    .select("id")
    .eq("year", year)
    .eq("bimonth_number", bimonthNumber)
    .maybeSingle();

  return (retryData as { id: string } | null)?.id ?? null;
}

export async function resolveHistoryPeriodUuid(
  supabase: SupabaseBrowserClient,
  meetingDate: string
): Promise<string | null> {
  const date = new Date(`${meetingDate}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const semester = date.getUTCMonth() + 1 <= 6 ? 1 : 2;

  const { data, error } = await supabase
    .from("history_periods")
    .select("id")
    .eq("year", year)
    .eq("semester", semester)
    .maybeSingle();

  if (!error && data && (data as { id: string }).id) {
    return (data as { id: string }).id;
  }

  const startDate = `${year}-${semester === 1 ? "01" : "07"}-01`;
  const endDate = `${year}-${semester === 1 ? "06" : "12"}-${semester === 1 ? "30" : "31"}`;

  // Attempt to auto-create missing period
  const { data: newPeriod, error: insertError } = await supabase
    .from("history_periods")
    .insert({ year, semester, start_date: startDate, end_date: endDate })
    .select("id")
    .maybeSingle();

  if (!insertError && newPeriod && (newPeriod as { id: string }).id) {
    return (newPeriod as { id: string }).id;
  }

  const { data: retryData } = await supabase
    .from("history_periods")
    .select("id")
    .eq("year", year)
    .eq("semester", semester)
    .maybeSingle();

  return (retryData as { id: string } | null)?.id ?? null;
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

  const typedPrograms = programsData as unknown as DbMeetingProgramRow[];
  const programIds = typedPrograms.map((p) => p.id);
  const { data: cyclesData, error: cyclesError } = await supabase
    .from("planning_cycles")
    .select("id, year, bimonth_number");
  if (cyclesError) throw new Error("No se pudieron cargar los ciclos de planificación.");

  const { data: periodsData, error: periodsError } = await supabase
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

  const { data: slotsData, error: slotsError } = await supabase
    .from("assignment_slots")
    .select("*")
    .in("meeting_program_id", programIds)
    .eq("is_deleted", false)
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
      eligibilityConfirmedAt: slot.eligibility_confirmed_at || undefined,
      isDeleted: slot.is_deleted === true,
      notes: slot.notes || undefined,
    });
    slotsByProgram.set(slot.meeting_program_id, list);
  }

  return (programsData as DbMeetingProgramRow[]).map((p) => ({
    id: p.id,
    meetingDate: p.meeting_date,
    weekType: p.week_type,
    bimonthCycle: p.planning_cycle_id ? cycleLabels.get(p.planning_cycle_id) ?? "" : "",
    historyPeriod: p.history_period_id ? periodLabels.get(p.history_period_id) ?? "" : "",
    planningCycleId: p.planning_cycle_id || undefined,
    historyPeriodId: p.history_period_id || undefined,
    chairmanId: p.chairman_id || undefined,
    auxiliaryCounselorId: p.auxiliary_counselor_id || undefined,
    leadershipReviewConfirmed: p.leadership_review_confirmed === true,
    leadershipReviewConfirmedBy: p.leadership_review_confirmed_by || undefined,
    leadershipReviewConfirmedAt: p.leadership_review_confirmed_at || undefined,
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
    .select("id, is_deleted")
    .eq("meeting_program_id", program.id)
    .eq("is_deleted", false);
  if (existingSlotsError) throw new Error("No se pudo comprobar la integridad de las intervenciones.");

  const currentSlotIds = program.slots.map((slot) => slot.id);
  const existingSlotIds = (existingSlots ?? []).map((slot: { id: string }) => slot.id);
  const toDelete = existingSlotIds.filter((id: string) => !currentSlotIds.includes(id));
  if (program.status === "published" && toDelete.length > 0) {
    throw new Error("No se pueden eliminar intervenciones al publicar. Guarda el borrador y revisa los cambios.");
  }

  // Resolve planningCycleId and historyPeriodId strictly
  let planningCycleId = program.planningCycleId;
  if (!planningCycleId) {
    planningCycleId = (await resolvePlanningCycleUuid(supabase, program.meetingDate)) ?? undefined;
  }
  let historyPeriodId = program.historyPeriodId;
  if (!historyPeriodId) {
    historyPeriodId = (await resolveHistoryPeriodUuid(supabase, program.meetingDate)) ?? undefined;
  }

  if (!planningCycleId || !historyPeriodId) {
    throw new Error("No se pudieron resolver ni crear los identificadores obligatorios de ciclo bimestral o período semestral.");
  }

  // Check if RPC procedure exists
  if (typeof supabase.rpc === "function") {
    const { error: rpcError } = await supabase.rpc("save_meeting_program_transaction", {
      p_program_id: program.id,
      p_meeting_date: program.meetingDate,
      p_week_type: program.weekType,
      p_chairman_id: program.chairmanId || null,
      p_auxiliary_counselor_id: program.auxiliaryCounselorId || null,
      p_leadership_review_confirmed: program.leadershipReviewConfirmed === true,
      p_leadership_review_confirmed_by: program.leadershipReviewConfirmed ? (program.leadershipReviewConfirmedBy || userId) : null,
      p_leadership_review_confirmed_at: program.leadershipReviewConfirmed ? (program.leadershipReviewConfirmedAt || new Date().toISOString()) : null,
      p_circuit_overseer_talk_title: program.circuitOverseerTalkTitle || null,
      p_is_draft: program.status === "draft",
      p_notes: program.notes || null,
      p_slots: program.slots.map((s) => ({
        id: s.id,
        section: s.section,
        title: s.title,
        duration_minutes: s.durationMinutes,
        order_index: s.orderIndex,
        is_student_part: s.isStudentPart,
        assignment_type: s.assignmentType || null,
        primary_participant_id: s.primaryParticipantId || null,
        assistant_participant_id: s.assistantParticipantId || null,
        eligibility_confirmed: s.eligibilityConfirmed === true,
        eligibility_confirmed_by: s.eligibilityConfirmed ? (s.eligibilityConfirmedBy || userId) : null,
        eligibility_confirmed_at: s.eligibilityConfirmed ? (s.eligibilityConfirmedAt || new Date().toISOString()) : null,
        notes: s.notes || null,
      })),
    });

    if (!rpcError) {
      return;
    }
  }

  // Fallback if RPC is not present in the client/mock environment
  const isDraft = program.status === "draft";
  const { error: progError } = await supabase
    .from("meeting_programs")
    .upsert({
      id: program.id,
      meeting_date: program.meetingDate,
      week_type: program.weekType,
      planning_cycle_id: planningCycleId,
      history_period_id: historyPeriodId,
      chairman_id: program.chairmanId || null,
      auxiliary_counselor_id: program.auxiliaryCounselorId || null,
      leadership_review_confirmed: program.leadershipReviewConfirmed === true,
      leadership_review_confirmed_by: program.leadershipReviewConfirmed ? (program.leadershipReviewConfirmedBy || userId) : null,
      leadership_review_confirmed_at: program.leadershipReviewConfirmed ? (program.leadershipReviewConfirmedAt || new Date().toISOString()) : null,
      circuit_overseer_talk_title: program.circuitOverseerTalkTitle || null,
      is_draft: true,
      notes: program.notes || null,
      updated_at: new Date().toISOString(),
    });

  if (progError) {
    throw new Error("No se pudo guardar el programa en la base de datos.");
  }

  if (isDraft && toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("assignment_slots")
      .update({ is_deleted: true })
      .in("id", toDelete);
    if (deleteError) throw new Error("No se pudieron retirar las intervenciones del borrador.");
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
        eligibility_confirmed_at: slot.eligibilityConfirmed ? (slot.eligibilityConfirmedAt || new Date().toISOString()) : null,
        is_deleted: false,
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

