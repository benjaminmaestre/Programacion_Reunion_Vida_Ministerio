import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { S140DocxGenerator } from "@/features/printing/s140-docx-generator";

export const runtime = "nodejs";

type MemberRow = { id: string; first_name: string; last_name: string; is_active: boolean | null };
type SlotRow = {
  id: string;
  section: "treasures" | "ministers" | "living" | "auxiliary";
  title: string;
  assignment_type: string | null;
  primary_participant_id: string | null;
  assistant_participant_id: string | null;
  order_index: number;
  is_deleted?: boolean;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ programId: string }> },
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(values) {
          try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* En Route Handlers los cambios de cookie pueden estar gestionados por middleware. */ }
        },
      },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Inicia sesión para generar el S-140." }, { status: 401 });
    }

    const { data: appUser, error: roleError } = await supabase
      .from("app_users")
      .select("user_id, is_active")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (roleError || !appUser) {
      return NextResponse.json({ error: "No tienes acceso activo a esta aplicación." }, { status: 403 });
    }

    const { programId } = await context.params;
    const { data: program, error: programError } = await supabase
      .from("meeting_programs")
      .select("*")
      .eq("id", programId)
      .maybeSingle();
    if (programError || !program) {
      return NextResponse.json({ error: "No se encontró el programa solicitado." }, { status: 404 });
    }

    const { data: slotRows, error: slotsError } = await supabase
      .from("assignment_slots")
      .select("*")
      .eq("meeting_program_id", programId)
      .eq("is_deleted", false)
      .order("order_index", { ascending: true });
    if (slotsError) {
      return NextResponse.json({ error: "No se pudieron cargar las intervenciones." }, { status: 500 });
    }

    const { data: memberRows, error: membersError } = await supabase
      .from("members")
      .select("id, first_name, last_name, is_active");
    if (membersError) {
      return NextResponse.json({ error: "No se pudo cargar el directorio." }, { status: 500 });
    }

    const members = (memberRows ?? []) as MemberRow[];
    const memberNames = new Map(members.map((member) => [member.id, member.is_active === false ? "" : `${member.first_name} ${member.last_name}`.trim()]));
    const nameFor = (id: string | null | undefined) => id ? memberNames.get(id) ?? "" : "";
    const slots = (slotRows ?? []) as SlotRow[];
    const byType = (type: string) => slots.find((slot) => slot.assignment_type === type);
    const treasures = byType("treasures_talk");
    const gems = byType("gems");
    const reading = byType("bible_reading");
    const conductor = byType("bible_study_conductor");
    const studyReader = byType("bible_study_reader");

    const document = S140DocxGenerator.generateDocx({
      weekDate: program.meeting_date,
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
        })),
      livingParts: slots
        .filter((slot) => slot.section === "living" && slot.assignment_type !== "bible_study_conductor" && slot.assignment_type !== "bible_study_reader")
        .map((slot) => ({ title: slot.title, speaker: nameFor(slot.primary_participant_id) })),
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
