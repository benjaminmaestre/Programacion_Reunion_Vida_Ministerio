import type { DirectoryMember } from "../members/demo-data";
import type { MeetingProgramDetail } from "./program-types";

/** Normaliza títulos para detectar nombres de partes sin depender de mayúsculas ni tildes. */
export function normalizeAssignmentTitle(value: string): string {
  return value.toLocaleLowerCase("es").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Identifica la asignación especial «¿Qué diría?» dentro de Seamos mejores maestros. */
export function isWhatWouldYouSayAssignment(slot: { section: string; title: string }): boolean {
  return slot.section === "ministers" && normalizeAssignmentTitle(slot.title).includes("que diria");
}

/** Estas asignaciones están reservadas a un hermano anciano o siervo ministerial activo. */
export function slotRequiresAppointedBrother(
  slot: { section: string; title: string; assignmentType?: string | null },
): boolean {
  return slot.assignmentType === "treasures_talk"
    || slot.assignmentType === "gems"
    || slot.section === "living"
    || isWhatWouldYouSayAssignment(slot);
}

export function isActiveAppointedBrother(member: DirectoryMember): boolean {
  return member.isActive
    && member.gender === "male"
    && (member.appointment === "elder" || member.appointment === "ministerial_servant");
}

/**
 * Restricciones de nombramiento que se aplican al guardar borradores y antes de generar el S-140.
 * No exige que las asignaciones estén completas ni reemplaza la validación completa de publicación.
 */
export function validateAssignmentRoleRestrictions(
  program: MeetingProgramDetail,
  members: DirectoryMember[],
): string[] {
  const errors: string[] = [];
  const membersById = new Map(members.map((member) => [member.id, member]));

  if (program.chairmanId) {
    const chairman = membersById.get(program.chairmanId);
    if (chairman?.isActive && chairman.appointment !== "elder") {
      errors.push("El presidente de la reunión debe ser un anciano activo.");
    }
  }

  for (const slot of program.slots) {
    if (!slotRequiresAppointedBrother(slot)) continue;
    const label = slot.title.trim() || `Intervención ${slot.orderIndex}`;

    for (const [role, id] of [
      ["titular", slot.primaryParticipantId],
      ["ayudante", slot.assistantParticipantId],
    ] as const) {
      if (!id) continue;
      const member = membersById.get(id);
      // La validación de inactivos/no existentes se realiza por separado.
      if (!member || !member.isActive) continue;
      if (member.gender !== "male"
        || (member.appointment !== "elder" && member.appointment !== "ministerial_servant")) {
        errors.push(`${label}: ${role === "titular" ? "el participante" : "el ayudante"} debe ser un anciano o siervo ministerial activo.`);
      }
    }
  }

  return [...new Set(errors)];
}
