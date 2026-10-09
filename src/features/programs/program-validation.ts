import type { DirectoryMember } from "../members/demo-data";
import type { MeetingProgramDetail } from "./program-types";

export interface ProgramPublicationValidation {
  isValid: boolean;
  errors: string[];
}

/** No permite publicar sin participantes, compatibilidad básica y revisión humana explícita. */
export function validateProgramForPublication(
  program: MeetingProgramDetail,
  members: DirectoryMember[],
): ProgramPublicationValidation {
  const errors: string[] = [];
  const activeMembers = new Map(members.filter((member) => member.isActive).map((member) => [member.id, member]));

  if (program.slots.length === 0) errors.push("El programa no tiene intervenciones.");

  for (const slot of program.slots) {
    const label = slot.title.trim() || `Intervención ${slot.orderIndex}`;
    if (!slot.title.trim()) errors.push(`${label}: falta el título.`);

    const primary = slot.primaryParticipantId ? activeMembers.get(slot.primaryParticipantId) : undefined;
    if (!primary) {
      errors.push(`${label}: selecciona un participante activo.`);
    } else {
      switch (slot.assignmentType) {
        case "treasures_talk":
        case "gems":
          if (primary.gender !== "male" || !["elder", "ministerial_servant"].includes(primary.appointment)) {
            errors.push(`${label}: esta intervención requiere un anciano o siervo ministerial varón.`);
          }
          break;
        case "bible_reading":
        case "student_talk":
        case "bible_study_reader":
          if (primary.gender !== "male") errors.push(`${label}: la asignación requiere un participante varón.`);
          break;
        case "living_needs":
          if (primary.appointment !== "elder") errors.push(`${label}: Necesidades de la congregación debe estar a cargo de un anciano.`);
          break;
        case "bible_study_conductor":
          if (primary.appointment !== "elder") errors.push(`${label}: el conductor del Estudio Bíblico debe ser un anciano.`);
          break;
        case "conversation":
        case "revisit":
        case "disciples":
        case "explain_beliefs": {
          const assistant = slot.assistantParticipantId ? activeMembers.get(slot.assistantParticipantId) : undefined;
          if (!assistant) errors.push(`${label}: selecciona un ayudante activo.`);
          else if (assistant.id === primary.id) errors.push(`${label}: titular y ayudante deben ser personas distintas.`);
          break;
        }
        case undefined:
          errors.push(`${label}: el tipo de asignación no está definido; requiere revisión.`);
          break;
        default:
          break;
      }
    }

    if (slot.assistantParticipantId) {
      const assistant = activeMembers.get(slot.assistantParticipantId);
      if (!assistant) errors.push(`${label}: el ayudante no está activo o no existe en el directorio.`);
      else if (primary && assistant.id === primary.id) errors.push(`${label}: titular y ayudante deben ser personas distintas.`);
    }

    if (slot.eligibilityConfirmed !== true) {
      errors.push(`${label}: falta confirmar la revisión humana de elegibilidad S-38-S.`);
    }
  }

  return { isValid: errors.length === 0, errors };
}
