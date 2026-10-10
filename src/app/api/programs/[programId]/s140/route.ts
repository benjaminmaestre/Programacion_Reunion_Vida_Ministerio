import { createClient } from "@neondatabase/neon-js";
import { NextResponse } from "next/server";
import { S140DocxGenerator } from "../../../../../features/printing/s140-docx-generator";
import { slotRequiresAppointedBrother } from "../../../../../features/programs/assignment-eligibility";

export const runtime = "nodejs";

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  appointment: string | null;
  is_active: boolean | null;
};
type SlotRow = {
  id: string;
  section: "treasures" | "ministers" | "living" | "auxiliary";
  title: string;
  assignment_type: string | null;
  primary_participant_id: string | null;
  assistant_participant_id: string | null;
  order_index: number;
  duration_minutes: number;
  is_deleted?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ programId: string }> },
) {
  try {
    const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim();
    if (!dataApiUrl) {
      return NextResponse.json({ error: "Neon no está configurado." }, { status: 503 });
    }

    const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: "Inicia sesión para generar el S-140." }, { status: 401 });
    }

    // El Data API valida el JWT de Neon Auth y aplica los permisos y las políticas RLS.
    // No se usa una credencial administrativa ni se confía en un userId del navegador.
    const neon = createClient({
      dataApi: {
        url: dataApiUrl,
        getToken: async () => accessToken,
      },
    });

    const { data: appUser, error: roleError } = await neon
      .from("app_users")
      .select("user_id, is_active")
      .eq("is_active", true)
      .maybeSingle();
    if (roleError || !appUser) {
      return NextResponse.json({ error: "No tienes acceso activo a esta aplicación." }, { status: 403 });
    }

    const { programId } = await context.params;
    const { data: program, error: programError } = await neon
      .from("meeting_programs")
      .select("*")
      .eq("id", programId)
      .maybeSingle();
    if (programError || !program) {
      return NextResponse.json({ error: "No se encontró el programa solicitado." }, { status: 404 });
    }

    const { data: slotRows, error: slotsError } = await neon
      .from("assignment_slots")
      .select("*")
      .eq("meeting_program_id", programId)
      .eq("is_deleted", false)
      .order("order_index", { ascending: true });
    if (slotsError) {
      return NextResponse.json({ error: "No se pudieron cargar las intervenciones." }, { status: 500 });
    }

    const { data: memberRows, error: membersError } = await neon
      .from("members")
      .select("id, first_name, last_name, gender, appointment, is_active");
    if (membersError) {
      return NextResponse.json({ error: "No se pudo cargar el directorio." }, { status: 500 });
    }

    const members = (memberRows ?? []) as MemberRow[];
    const membersById = new Map(members.map((member) => [member.id, member]));
    const slots = (slotRows ?? []) as SlotRow[];
    const assignedIds = [
      program.chairman_id,
      program.auxiliary_counselor_id,
      ...slots.flatMap((slot) => [slot.primary_participant_id, slot.assistant_participant_id]),
    ].filter((id): id is string => typeof id === "string" && id.length > 0);
    const inactiveAssignedIds = [...new Set(assignedIds.filter((id) => membersById.get(id)?.is_active !== true))];
    if (inactiveAssignedIds.length > 0) {
      return NextResponse.json({
        error: "No se puede generar el S-140: hay participantes inactivos o ausentes del directorio en el programa. Reasigna esas funciones a personas activas.",
      }, { status: 409 });
    }

    for (const [label, prayerId] of [
      ["oración de apertura", program.opening_prayer_participant_id],
      ["oración de conclusión", program.closing_prayer_participant_id],
    ] as const) {
      if (!prayerId) continue;
      const member = membersById.get(prayerId);
      if (member?.is_active === true && member.gender !== "male") {
        return NextResponse.json({
          error: `No se puede generar el S-140: la ${label} solo puede asignarse a un varón.`,
        }, { status: 409 });
      }
    }

    if (program.chairman_id) {
      const chairman = membersById.get(program.chairman_id);
      if (chairman?.is_active === true && chairman.appointment !== "elder") {
        return NextResponse.json({
          error: "No se puede generar el S-140: el presidente de la reunión debe ser un anciano activo.",
        }, { status: 409 });
      }
    }

    for (const slot of slots) {
      if (!slotRequiresAppointedBrother({
        section: slot.section,
        title: slot.title,
        assignmentType: slot.assignment_type,
      })) continue;

      for (const assignedId of [slot.primary_participant_id, slot.assistant_participant_id]) {
        if (!assignedId) continue;
        const member = membersById.get(assignedId);
        if (!member || member.is_active !== true) continue;
        if (member.gender !== "male"
          || (member.appointment !== "elder" && member.appointment !== "ministerial_servant")) {
          return NextResponse.json({
            error: `No se puede generar el S-140: «${slot.title}» requiere un anciano o siervo ministerial activo.`,
          }, { status: 409 });
        }
      }
    }

    const memberNames = new Map(
      members.map((member) => [
        member.id,
        member.is_active === false ? "" : `${member.first_name} ${member.last_name}`.trim(),
      ]),
    );
    const nameFor = (id: string | null | undefined) => id ? memberNames.get(id) ?? "" : "";
    const byType = (type: string) => slots.find((slot) => slot.assignment_type === type);
    const treasures = byType("treasures_talk");
    const gems = byType("gems");
    const reading = byType("bible_reading");
    const conductor = byType("bible_study_conductor");
    const studyReader = byType("bible_study_reader");

    const document = S140DocxGenerator.generateDocx({
      weekDate: program.meeting_date,
      weeklyBibleReading: program.weekly_bible_reading ?? "",
      openingSongNumber: program.opening_song_number ?? undefined,
      livingSongNumber: program.living_song_number ?? undefined,
      closingSongNumber: program.closing_song_number ?? undefined,
      chairman: nameFor(program.chairman_id),
      auxiliaryCounselor: nameFor(program.auxiliary_counselor_id),
      treasuresTalkTitle: treasures?.title ?? "",
      treasuresTalkSpeaker: nameFor(treasures?.primary_participant_id),
      gemsSpeaker: nameFor(gems?.primary_participant_id),
      bibleReader: nameFor(reading?.primary_participant_id),
      ministersParts: slots
        .filter((slot) => slot.section === "ministers")
        .map((slot) => ({
          title: slot.title,
          speaker: nameFor(slot.primary_participant_id),
          assistant: nameFor(slot.assistant_participant_id) || undefined,
          durationMinutes: slot.duration_minutes,
        })),
      livingParts: slots
        .filter((slot) => slot.section === "living" && slot.assignment_type !== "bible_study_conductor" && slot.assignment_type !== "bible_study_reader")
        .map((slot) => ({ title: slot.title, speaker: nameFor(slot.primary_participant_id), durationMinutes: slot.duration_minutes })),
      congregationStudyConductor: nameFor(conductor?.primary_participant_id),
      congregationStudyReader: nameFor(studyReader?.primary_participant_id),
    });

    return new NextResponse(new Uint8Array(document), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="S-140-${program.meeting_date}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el documento S-140." }, { status: 500 });
  }
}
