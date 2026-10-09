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

  const eldersCount = members.filter((member) => member.isActive && member.appointment === "elder").length;
  const chairman = program.chairmanId ? activeMembers.get(program.chairmanId) : undefined;
  if (!chairman) {
    errors.push("Selecciona un presidente activo para la reunión.");
  } else if (chairman.appointment !== "elder" && !(eldersCount < 3 && chairman.appointment === "ministerial_servant")) {
    errors.push("El presidente debe ser anciano; solo en congregaciones con menos de tres ancianos puede considerarse un siervo ministerial capacitado.");
  }
  if (program.leadershipReviewConfirmed !== true) {
    errors.push("Falta la confirmación de un anciano/administrador para Presidencia y Consejería.");
  }
  if (program.auxiliaryCounselorId) {
    const counselor = activeMembers.get(program.auxiliaryCounselorId);
    if (!counselor) errors.push("El consejero auxiliar seleccionado no está activo o no existe.");
    else if (counselor.appointment !== "elder") errors.push("El consejero auxiliar debe ser un anciano.");
  }

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
          if (primary.gender !== "male" || (primary.appointment !== "elder" && primary.appointment !== "ministerial_servant")) {
            errors.push(`${label}: esta intervención requiere un anciano o siervo ministerial varón.`);
          }
          break;
        case "bible_reading":
        case "student_talk":
        case "bible_study_reader":
        case "living_part":
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
          else if ((slot.assignmentType === "revisit" || slot.assignmentType === "disciples") && assistant.gender !== primary.gender) {
            errors.push(`${label}: para revisitas y hacer discípulos, titular y ayudante deben ser del mismo sexo.`);
          }
          break;
        }
        case undefined:
          errors.push(`${label}: el tipo de asignación no está definido; requiere revisión.`);
          break;
        default:
          errors.push(`${label}: el tipo de asignación no tiene una regla de validación definida.`);
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
