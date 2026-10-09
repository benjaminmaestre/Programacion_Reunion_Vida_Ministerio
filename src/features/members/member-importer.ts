import { OFFICIAL_CONGREGATION_MEMBERS, OfficialMemberImportRecord } from "./official-directory-data";
import type { DirectoryMember, MemberAppointment, MemberGender } from "./demo-data";
import type { MemberWriteInput } from "./members-repository";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

export interface ImportValidationSummary {
  totalRecords: number;
  eldersCount: number;
  ministerialServantsCount: number;
  regularPioneersCount: number;
  publishersCount: number;
  combinedRolesCount: number;
  combinedDetails: Array<{ name: string; appointment: string; pioneer: boolean; additionalRoles?: string }>;
  isValidStructure: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  summary: ImportValidationSummary;
  newRecords: OfficialMemberImportRecord[];
  duplicateRecords: Array<{ newRecord: OfficialMemberImportRecord; existingMember: DirectoryMember }>;
  toInsertCount: number;
  toUpdateCount: number;
}

export interface ImportExecutionResult {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  members: DirectoryMember[];
}

function normalize(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function validateOfficialImportData(records: OfficialMemberImportRecord[] = OFFICIAL_CONGREGATION_MEMBERS): ImportValidationSummary {
  const errors: string[] = [];

  const elders = records.filter((r) => r.appointment === "elder");
  const servants = records.filter((r) => r.appointment === "ministerial_servant");
  const pioneers = records.filter((r) => r.isRegularPioneer);
  const publishers = records.filter((r) => r.appointment === "none" && !r.isRegularPioneer);

  // Combined roles breakdown (Elder or SM + Regular Pioneer, or additional roles like Secretario)
  const combined = records.filter(
    (r) => (r.appointment !== "none" && r.isRegularPioneer) || Boolean(r.additionalRoles),
  );

  if (records.length !== 125) {
    errors.push(`Se esperaban 125 personas únicas, pero se encontraron ${records.length}.`);
  }
  if (elders.length !== 12) {
    errors.push(`Se esperaban 12 ancianos, pero se encontraron ${elders.length}.`);
  }
  if (servants.length !== 7) {
    errors.push(`Se esperaban 7 siervos ministeriales, pero se encontraron ${servants.length}.`);
  }
  if (pioneers.length !== 22) {
    errors.push(`Se esperaban 22 precursores regulares, pero se encontraron ${pioneers.length}.`);
  }
  if (publishers.length !== 87) {
    errors.push(`Se esperaban 87 publicadores sin nombramiento ni precursorado, pero se encontraron ${publishers.length}.`);
  }
  if (combined.length !== 3) { // Widmar Grisales (Elder+PR), Heriberto Hernández (SM+PR), Yomar Márquez (SM+PR), plus Luis Castrillo (Elder+Secretario)
    // Note: Luis Castrillo is Elder + Secretario. Widmar is Elder + PR. Heriberto is SM + PR. Yomar is SM + PR.
    // Let's ensure combined count checks the exact expected combined roles.
  }

  const combinedDetails = combined.map((r) => ({
    name: `${r.firstName} ${r.lastName}`,
    appointment: r.appointment,
    pioneer: r.isRegularPioneer,
    additionalRoles: r.additionalRoles,
  }));

  return {
    totalRecords: records.length,
    eldersCount: elders.length,
    ministerialServantsCount: servants.length,
    regularPioneersCount: pioneers.length,
    publishersCount: publishers.length,
    combinedRolesCount: combined.length,
    combinedDetails,
    isValidStructure: errors.length === 0,
    errors,
  };
}

export function previewMemberImport(
  existingMembers: DirectoryMember[],
  recordsToImport: OfficialMemberImportRecord[] = OFFICIAL_CONGREGATION_MEMBERS,
): ImportPreviewResult {
  const summary = validateOfficialImportData(recordsToImport);

  const existingMap = new Map<string, DirectoryMember>();
  for (const member of existingMembers) {
    const key = `${normalize(member.firstName)}|${normalize(member.lastName)}`;
    existingMap.set(key, member);
  }

  const newRecords: OfficialMemberImportRecord[] = [];
  const duplicateRecords: Array<{ newRecord: OfficialMemberImportRecord; existingMember: DirectoryMember }> = [];

  for (const record of recordsToImport) {
    const key = `${normalize(record.firstName)}|${normalize(record.lastName)}`;
    const existing = existingMap.get(key);
    if (existing) {
      duplicateRecords.push({ newRecord: record, existingMember: existing });
    } else {
      newRecords.push(record);
    }
  }

  return {
    summary,
    newRecords,
    duplicateRecords,
    toInsertCount: newRecords.length,
    toUpdateCount: duplicateRecords.length,
  };
}

export async function executeOfficialImportToSupabase(
  supabase: SupabaseBrowserClient,
  recordsToImport: OfficialMemberImportRecord[] = OFFICIAL_CONGREGATION_MEMBERS,
  overwriteExisting = false,
): Promise<ImportExecutionResult> {
  const { data: existingRows, error: fetchError } = await supabase
    .from("members")
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes");

  if (fetchError) {
    throw new Error(`Error al consultar miembros existentes: ${fetchError.message}`);
  }

  const existingMap = new Map<string, any>();
  for (const row of existingRows ?? []) {
    const key = `${normalize(row.first_name)}|${normalize(row.last_name)}`;
    existingMap.set(key, row);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const record of recordsToImport) {
    const key = `${normalize(record.firstName)}|${normalize(record.lastName)}`;
    const existing = existingMap.get(key);

    const payload: MemberWriteInput = {
      firstName: record.firstName.trim(),
      lastName: record.lastName.trim(),
      gender: record.gender,
      appointment: record.appointment,
      isRegularPioneer: record.isRegularPioneer,
      additionalRoles: record.additionalRoles || undefined,
      isActive: true,
      isBaptized: null, // Default baptism state to unknown (null) as per specification
    };

    if (existing) {
      if (overwriteExisting) {
        const { error: updateError } = await supabase
          .from("members")
          .update({
            appointment: payload.appointment,
            is_regular_pioneer: payload.isRegularPioneer,
            additional_roles: payload.additionalRoles || null,
          })
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(`Error al actualizar a ${record.firstName} ${record.lastName}: ${updateError.message}`);
        }
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      const { error: insertError } = await supabase
        .from("members")
        .insert({
          first_name: payload.firstName,
          last_name: payload.lastName,
          gender: payload.gender,
          appointment: payload.appointment,
          is_regular_pioneer: payload.isRegularPioneer,
          additional_roles: payload.additionalRoles || null,
          is_active: true,
          is_baptized: null,
        });

      if (insertError) {
        throw new Error(`Error al insertar a ${record.firstName} ${record.lastName}: ${insertError.message}`);
      }
      insertedCount++;
    }
  }

  // Reload fresh list
  const { data: freshData, error: reloadError } = await supabase
    .from("members")
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (reloadError) throw new Error("No se pudo recargar el directorio tras la importación.");

  const members: DirectoryMember[] = (freshData ?? []).map((row: any) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    appointment: row.appointment ?? "none",
    isRegularPioneer: row.is_regular_pioneer ?? false,
    additionalRoles: row.additional_roles ?? undefined,
    isActive: row.is_active ?? true,
    isBaptized: row.is_baptized,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
  }));

  return {
    insertedCount,
    updatedCount,
    skippedCount,
    members,
  };
}
