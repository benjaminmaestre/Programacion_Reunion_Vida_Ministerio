import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AssignmentHistoryEntry,
  DirectoryMember,
  HistoryCategory,
  MemberAppointment,
  MemberGender,
} from "./demo-data";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
export type AppUserRole = "administrator" | "elder" | "coordinator" | "viewer";

interface AppUserRow {
  user_id: string;
  role: AppUserRole;
  is_active: boolean;
}

interface DbMemberRow {
  id: string;
  first_name: string;
  last_name: string;
  gender: MemberGender;
  appointment: MemberAppointment | null;
  is_regular_pioneer?: boolean | null;
  additional_roles?: string | null;
  is_active: boolean | null;
  is_baptized: boolean | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface DbHistorySlotRow {
  id: string;
  section: "treasures" | "ministers" | "living" | "auxiliary";
  title: string;
  primary_participant_id: string | null;
  assistant_participant_id: string | null;
  meeting_programs: { meeting_date: string } | Array<{ meeting_date: string }>;
}

export interface MemberWriteInput {
  firstName: string;
  lastName: string;
  gender: MemberGender;
  appointment: MemberAppointment;
  isRegularPioneer?: boolean;
  additionalRoles?: string;
  isActive: boolean;
  isBaptized: boolean;
  phone?: string;
  email?: string;
  notes?: string;
}

export class MembershipRequiredError extends Error {
  constructor(message = "Tu usuario no tiene un acceso activo a esta aplicación. Solicita al administrador que configure tu cuenta.") {
    super(message);
    this.name = "MembershipRequiredError";
  }
}

export class PermissionRequiredError extends Error {
  constructor(message = "Tu rol no permite realizar esta operación.") {
    super(message);
    this.name = "PermissionRequiredError";
  }
}

function throwIfError(error: { message: string } | null, action: string): void {
  if (error) {
    // Evita mostrar detalles internos de SQL/PostgREST en la interfaz final.
    throw new Error(`No se pudo ${action}. Comprueba tu acceso o contacta al administrador.`);
  }
}

function mapMember(row: DbMemberRow): DirectoryMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    appointment: row.appointment ?? "none",
    isRegularPioneer: row.is_regular_pioneer ?? false,
    additionalRoles: row.additional_roles ?? undefined,
    isActive: row.is_active ?? true,
    isBaptized: row.is_baptized ?? true,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function toDatabaseRow(input: MemberWriteInput) {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    gender: input.gender,
    appointment: input.appointment,
    is_regular_pioneer: input.isRegularPioneer ?? false,
    additional_roles: input.additionalRoles?.trim() || null,
    is_active: input.isActive,
    is_baptized: input.isBaptized,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

function canManageDirectory(role: AppUserRole) {
  return role === "administrator" || role === "elder" || role === "coordinator";
}

/** Lee el perfil/rol de la cuenta autenticada. RLS permite consultar únicamente el propio perfil. */
export async function getCurrentAppUser(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<AppUserRow> {
  const { data, error } = await supabase
    .from("app_users")
    .select("user_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("No se pudo comprobar tu acceso a la aplicación.");
  const appUser = data as AppUserRow | null;
  if (!appUser) throw new MembershipRequiredError();
  return appUser;
}

export async function listMembers(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<{ members: DirectoryMember[] }> {
  await getCurrentAppUser(supabase, userId);
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  throwIfError(error, "cargar el directorio");
  return { members: ((data ?? []) as unknown as DbMemberRow[]).map(mapMember) };
}

export async function createMember(
  supabase: SupabaseBrowserClient,
  userId: string,
  input: MemberWriteInput,
): Promise<DirectoryMember> {
  const appUser = await getCurrentAppUser(supabase, userId);
  if (!canManageDirectory(appUser.role)) throw new PermissionRequiredError();

  const { data, error } = await supabase
    .from("members")
    .insert(toDatabaseRow(input))
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes")
    .single();

  throwIfError(error, "guardar la persona");
  if (!data) throw new Error("La persona no fue devuelta por la base de datos.");
  return mapMember(data as unknown as DbMemberRow);
}

export async function updateMember(
  supabase: SupabaseBrowserClient,
  userId: string,
  memberId: string,
  input: MemberWriteInput,
): Promise<DirectoryMember> {
  const appUser = await getCurrentAppUser(supabase, userId);
  if (!canManageDirectory(appUser.role)) throw new PermissionRequiredError();

  const { data, error } = await supabase
    .from("members")
    .update(toDatabaseRow(input))
    .eq("id", memberId)
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes")
    .single();

  throwIfError(error, "actualizar la persona");
  if (!data) throw new Error("No se encontró la persona o no tienes permiso para modificarla.");
  return mapMember(data as unknown as DbMemberRow);
}

function getSemesterRange(reference = new Date()): { start: string; end: string } {
  const year = reference.getFullYear();
  if (reference.getMonth() < 6) return { start: `${year}-01-01`, end: `${year}-06-30` };
  return { start: `${year}-07-01`, end: `${year}-12-31` };
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function mapCategory(section: DbHistorySlotRow["section"], title: string): HistoryCategory {
  const normalized = normalizeText(title);

  if (normalized.includes("lectura de la biblia")) return "bible-reading";
  if (normalized.includes("perlas")) return "gems";
  if (section === "treasures") return "treasures";
  if (section === "ministers") {
    if (normalized.includes("conversacion")) return "conversation";
    if (normalized.includes("revisita")) return "revisit";
    if (normalized.includes("discipulo")) return "disciples";
    if (normalized.includes("creencia")) return "explain-beliefs";
    return "student-talk";
  }
  if (section === "living") return "living";
  return "living";
}

function getMeeting(row: DbHistorySlotRow) {
  return Array.isArray(row.meeting_programs) ? row.meeting_programs[0] : row.meeting_programs;
}

export async function getMemberHistory(
  supabase: SupabaseBrowserClient,
  userId: string,
  memberId: string,
): Promise<AssignmentHistoryEntry[]> {
  await getCurrentAppUser(supabase, userId);

  const { data: activePeriods, error: periodError } = await supabase
    .from("history_periods")
    .select("start_date, end_date")
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1);

  throwIfError(periodError, "consultar el período histórico");
  const configuredPeriod = (activePeriods ?? [])[0] as { start_date: string; end_date: string } | undefined;
  const range = configuredPeriod
    ? { start: configuredPeriod.start_date, end: configuredPeriod.end_date }
    : getSemesterRange();

  const { data, error } = await supabase
    .from("assignment_slots")
    .select("id, section, title, primary_participant_id, assistant_participant_id, meeting_programs!inner(meeting_date)")
    .gte("meeting_programs.meeting_date", range.start)
    .lte("meeting_programs.meeting_date", range.end)
    .or(`primary_participant_id.eq.${memberId},assistant_participant_id.eq.${memberId}`);

  throwIfError(error, "consultar el historial de asignaciones");

  const slots = ((data ?? []) as unknown as DbHistorySlotRow[])
    .map((slot) => {
      const meeting = getMeeting(slot);
      if (!meeting) return null;

      const isPrimary = slot.primary_participant_id === memberId;
      const participation: AssignmentHistoryEntry["participation"] = isPrimary ? "Titular" : "Ayudante";
      const companionId = isPrimary ? slot.assistant_participant_id : slot.primary_participant_id;

      return {
        id: slot.id,
        memberId,
        date: meeting.meeting_date,
        category: mapCategory(slot.section, slot.title),
        assignment: slot.title,
        participation,
        companionId,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const companionIds = [...new Set(slots.map((slot) => slot.companionId).filter((id): id is string => Boolean(id)))];
  const namesById = new Map<string, string>();

  if (companionIds.length > 0) {
    const { data: companions, error: companionError } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", companionIds);

    throwIfError(companionError, "consultar los nombres de los participantes");
    for (const companion of (companions ?? []) as unknown as Array<{ id: string; first_name: string; last_name: string }>) {
      namesById.set(companion.id, `${companion.first_name} ${companion.last_name}`.trim());
    }
  }

  return slots.map(({ companionId, ...entry }) => ({
    ...entry,
    companionName: companionId ? namesById.get(companionId) : undefined,
  }));
}
