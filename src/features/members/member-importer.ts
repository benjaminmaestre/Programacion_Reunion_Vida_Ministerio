import type { OfficialMemberImportRecord } from "./official-directory-data";
import type { DirectoryMember, MemberAppointment, MemberGender } from "./demo-data";
import { assertCanManageDirectory, type MemberWriteInput } from "./members-repository";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

function memberKey(firstName: string, lastName: string): string {
  return `${normalize(firstName)}|${normalize(lastName)}`;
}

// Alias de identidad: conserva el UUID y el historial cuando el listado oficial actualiza nombres.
// Cada clave es nombre+apellido anterior; el valor es la identidad canónica del listado 2026-10-09.
const LEGACY_MEMBER_ALIASES: Record<string, string> = {
  "duver|garzon": "duber antonio|garzon",
  "felix|perez": "felix anibal|perez",
  "gonzalo|alvarez ramirez": "gonzalo|alvarez puerta",
  "juan|lopez": "juan felipe|lopez",
  "luis|castrillo": "luis guillermo|castrillo",
  "luis|ospina": "luis alberto|ospina rodriguez",
  "widmar|grisales": "widmar alberto|grisales",
  "gustavo|ruiz potes": "gustavo|ruiz",
  "roman|rodriguez velasquez": "roman alberto|rodriguez",
  "yomar|marquez": "stirwen yomar|marquez salazar",
  "aura|ospina": "aura rosa|tabares de ospina",
  "diris|arbelaez": "diris isabel|anaya de arbelaez",
  "emilse|castano": "emilsen|de castano",
  "gloria|escobar quintero": "gloria|escobar",
  "gloria|valencia rios": "gloria aleida|valencia",
  "lucy|cano": "lucy|murillo de cano",
  "marilyn|perez": "marilyn|maestre de perez",
  "martha|alvarez": "martha|munoz de alvarez",
  "mary de|marquez": "mary|montilla de marquez",
  "saida de|quintero": "saida|gallardo",
  "sandra|alvarez": "sandra maria|suarez de alvarez",
  "viviana|grisales": "viviana marcela|tabares de grisales",
  "argemiro|murillo": "argemiro|murillo quintero",
  "bernarda|penagos": "bernarda tamayo|penagos",
  "francia|mosquera": "francia nirla|mosquera",
  "javier|castano": "francisco javier|castano",
  "julia elisa|gomez": "julia elisa|gomez gutierrez",
  "leticia|valdez de yepes": "maria leticia|valdez de yepes",
  "lucia de|garcia": "lucia|de garcia",
  "luz amparo|jaramillo": "luz amparo|jaramillo sanchez",
  "martha de|castrillon": "martha|de castrillon",
  "omaira|usuga": "omaira|usuga oquendo",
  "pablo|andrade": "pablo|andrade valencia",
  "rosalba de|castano": "rosalba|de castano",
  "soledad|rodriguez": "soledad|rodriguez de gomez",
  "sonia patricia|londono": "sonia patricia|hernandez",
  "teresa de|valencia": "teresa|de valencia",
  "yeimy|castrillo": "yeimy tibisay|de freitas chacon",
  "yisel de|perez": "yisel adriana|contreras de perez",
  "yosannis|diaz": "yosannis|de diaz",
};

function findExistingMember<T extends { firstName: string; lastName: string }>(
  existingMap: Map<string, T>,
  firstName: string,
  lastName: string,
): T | undefined {
  const key = memberKey(firstName, lastName);
  const canonical = existingMap.get(key);
  if (canonical) return canonical;
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_MEMBER_ALIASES)) {
    if (canonicalKey === key) {
      const existing = existingMap.get(legacyKey);
      if (existing) return existing;
    }
  }
  return undefined;
}

export interface ImportValidationSummary {
  totalRecords: number;
  eldersCount: number;
  ministerialServantsCount: number;
  regularPioneersCount: number;
  publishersCount: number;
  combinedRolesCount: number;
  inactiveCount: number;
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

export function validateOfficialImportData(records: OfficialMemberImportRecord[]): ImportValidationSummary {
  const errors: string[] = [];

  const elders = records.filter((r) => r.appointment === "elder");
  const servants = records.filter((r) => r.appointment === "ministerial_servant");
  const pioneers = records.filter((r) => r.isRegularPioneer);
  const publishers = records.filter((r) => r.isActive && r.appointment === "none" && !r.isRegularPioneer);
  const inactive = records.filter((r) => !r.isActive);

  const combinedPioneers = records.filter((r) => r.appointment !== "none" && r.isRegularPioneer);
  const secretaries = records.filter((r) => normalize(r.additionalRoles ?? "") === "secretario");
  const combined = records.filter(
    (r) => (r.appointment !== "none" && r.isRegularPioneer) || Boolean(r.additionalRoles?.trim()),
  );
  const seenNames = new Set<string>();
  for (const record of records) {
    const firstName = record.firstName.trim();
    const lastName = record.lastName.trim();
    if (!firstName || !lastName) {
      errors.push("Todos los registros deben tener nombre y apellido.");
      continue;
    }
    const key = `${normalize(firstName)}|${normalize(lastName)}`;
    if (seenNames.has(key)) errors.push(`Nombre duplicado en el listado oficial: ${firstName} ${lastName}.`);
    seenNames.add(key);
  }

  if (records.length !== 139) {
    errors.push(`Se esperaban 139 personas únicas, pero se encontraron ${records.length}.`);
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
  if (publishers.length !== 90) {
    errors.push(`Se esperaban 90 publicadores activos sin nombramiento ni precursorado, pero se encontraron ${publishers.length}.`);
  }
  if (inactive.length !== 11) {
    errors.push(`Se esperaban 11 personas inactivas, pero se encontraron ${inactive.length}.`);
  }
  if (combinedPioneers.length !== 3) {
    errors.push(`Se esperaban 3 personas con nombramiento y precursorado regular combinados, pero se encontraron ${combinedPioneers.length}.`);
  }
  if (secretaries.length !== 1) {
    errors.push(`Se esperaba 1 responsable de Secretaría, pero se encontraron ${secretaries.length}.`);
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
  recordsToImport: OfficialMemberImportRecord[],
): ImportPreviewResult {
  const summary = validateOfficialImportData(recordsToImport);

  const existingMap = new Map<string, DirectoryMember>();
  for (const member of existingMembers) {
    const key = memberKey(member.firstName, member.lastName);
    existingMap.set(key, member);
  }

  const newRecords: OfficialMemberImportRecord[] = [];
  const duplicateRecords: Array<{ newRecord: OfficialMemberImportRecord; existingMember: DirectoryMember }> = [];

  for (const record of recordsToImport) {
    const existing = findExistingMember(existingMap, record.firstName, record.lastName);
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
  userId: string,
  recordsToImport: OfficialMemberImportRecord[],
  overwriteExisting = false,
): Promise<ImportExecutionResult> {
  await assertCanManageDirectory(supabase, userId);
  const validation = validateOfficialImportData(recordsToImport);
  if (!validation.isValidStructure) {
    throw new Error(`La importación fue bloqueada: ${validation.errors.join(" ")}`);
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("members")
    .select("id, first_name, last_name, gender, appointment, is_regular_pioneer, additional_roles, is_active, is_baptized, phone, email, notes");

  if (fetchError) {
    throw new Error(`Error al consultar miembros existentes: ${fetchError.message}`);
  }

  const existingMap = new Map<string, any>();
  for (const row of existingRows ?? []) {
    const key = memberKey(row.first_name, row.last_name);
    existingMap.set(key, row);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const record of recordsToImport) {
    const existing = findExistingMember(existingMap, record.firstName, record.lastName);

    const payload: MemberWriteInput = {
      firstName: record.firstName.trim(),
      lastName: record.lastName.trim(),
      gender: record.gender,
      appointment: record.appointment,
      isRegularPioneer: record.isRegularPioneer,
      additionalRoles: record.additionalRoles || undefined,
      isActive: record.isActive,
      isBaptized: record.isBaptized, // Preserve source uncertainty instead of assuming baptism state
    };

    if (existing) {
      if (overwriteExisting) {
        const { error: updateError } = await supabase
          .from("members")
          .update({
            first_name: payload.firstName,
            last_name: payload.lastName,
            gender: payload.gender,
            appointment: payload.appointment,
            is_regular_pioneer: payload.isRegularPioneer,
            additional_roles: payload.additionalRoles || null,
            is_active: payload.isActive,
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
          is_active: payload.isActive,
          is_baptized: payload.isBaptized,
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
