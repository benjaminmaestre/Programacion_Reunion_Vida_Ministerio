import type { DirectoryMember } from "../members/demo-data";
import type { MeetingProgramDetail } from "./program-types";
import { isWhatWouldYouSayAssignment } from "./assignment-eligibility";

export interface ProgramPublicationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Invalida la confirmación de revisión si los datos fundamentales han cambiado */
export function invalidateReviewIfChanged<T extends { title?: string; eligibilityConfirmed?: boolean; eligibilityConfirmedBy?: string; eligibilityConfirmedAt?: string }>(
  originalItem: T,
  newItem: Partial<T>
): T {
  const hasParticipantChanged =
    ("title" in newItem && (newItem as unknown as { title?: string }).title !== (originalItem as unknown as { title?: string }).title) ||
    ("primaryParticipantId" in newItem && (newItem as unknown as { primaryParticipantId?: string }).primaryParticipantId !== (originalItem as unknown as { primaryParticipantId?: string }).primaryParticipantId) ||
    ("assistantParticipantId" in newItem && (newItem as unknown as { assistantParticipantId?: string }).assistantParticipantId !== (originalItem as unknown as { assistantParticipantId?: string }).assistantParticipantId) ||
    ("assignmentType" in newItem && (newItem as unknown as { assignmentType?: string }).assignmentType !== (originalItem as unknown as { assignmentType?: string }).assignmentType);

  if (hasParticipantChanged) {
    return {
      ...originalItem,
      ...newItem,
      eligibilityConfirmed: false,
      eligibilityConfirmedBy: undefined,
      eligibilityConfirmedAt: undefined,
    };
  }

  return { ...originalItem, ...newItem };
}

/** No permite publicar sin participantes, compatibilidad básica y revisión humana explícita. */
export function validateProgramForPublication(
  program: MeetingProgramDetail,
  members: DirectoryMember[],
): ProgramPublicationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const activeMembers = new Map(members.filter((member) => member.isActive).map((member) => [member.id, member]));

  // Manejo de semanas especiales
  if (program.weekType === "assembly") {
    const specialText = [program.notes ?? "", ...program.slots.flatMap((slot) => [slot.title, slot.notes ?? ""])]
      .join(" ").toLocaleLowerCase("es");
    if (!specialText.includes("asamblea")) {
      errors.push("Asamblea: registra un aviso o una nota que identifique la semana de asamblea.");
    }
    if (program.slots.some((slot) => slot.section !== "auxiliary" || !!slot.assignmentType)) {
      warnings.push("Semana de asamblea: revisa que no se hayan incluido intervenciones de una reunión ordinaria.");
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (program.weekType === "memorial") {
    const chairman = program.chairmanId ? activeMembers.get(program.chairmanId) : undefined;
    if (!chairman || chairman.appointment !== "elder") {
      errors.push("Conmemoración: selecciona un presidente activo que sea anciano.");
    }
    const specialText = [program.notes ?? "", ...program.slots.flatMap((slot) => [slot.title, slot.notes ?? ""])]
      .join(" ").toLocaleLowerCase("es");
    if (!specialText.includes("conmemoración")) {
      errors.push("Conmemoración: registra el evento especial en el título de una intervención o en las notas.");
    }
    if (program.leadershipReviewConfirmed !== true) {
      errors.push("Conmemoración: falta la confirmación de la revisión humana por parte de un anciano o administrador.");
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (program.weekType === "circuit_overseer") {
    if (!program.circuitOverseerTalkTitle?.trim()) {
      errors.push("Visita del Superintendente: Ingresa el título real del discurso de servicio de 30 minutos.");
    }
  }

  if (program.slots.length === 0) {
    errors.push("El programa no tiene intervenciones.");
  }

  const chairman = program.chairmanId ? activeMembers.get(program.chairmanId) : undefined;
  if (program.weekType === "circuit_overseer") {
    if (!chairman || chairman.appointment !== "elder") {
      errors.push("Visita del Superintendente: selecciona un presidente activo que sea anciano.");
    }
  } else if (!chairman) {
    errors.push("Selecciona un presidente activo para la reunión.");
  } else if (chairman.appointment !== "elder") {
    errors.push("El presidente de la reunión debe ser un anciano activo.");
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
    const expectedSectionByType: Record<string, string> = {
      treasures_talk: "treasures", gems: "treasures", bible_reading: "treasures",
      conversation: "ministers", revisit: "ministers", disciples: "ministers", explain_beliefs: "ministers", student_talk: "ministers",
      living_part: "living", living_needs: "living", bible_study_conductor: "living", bible_study_reader: "living",
    };
    const expectedSection = slot.assignmentType ? expectedSectionByType[slot.assignmentType] : undefined;
    if (!slot.assignmentType || !expectedSection) {
      errors.push(`${label}: el tipo de asignación no está definido o no tiene una regla de validación.`);
      continue;
    }
    if (expectedSection && slot.section !== expectedSection) {
      errors.push(`${label}: el tipo ${slot.assignmentType} no corresponde a la sección ${slot.section}.`);
    }

    const isCircuitTalk = program.weekType === "circuit_overseer"
      && slot.assignmentType === "living_part"
      && `${slot.title} ${slot.notes ?? ""}`.toLocaleLowerCase("es").includes("superintendente de circuito");
    if (isCircuitTalk) continue;

    const primary = slot.primaryParticipantId ? activeMembers.get(slot.primaryParticipantId) : undefined;
    if (!primary) {
      errors.push(`${label}: selecciona un participante activo.`);
    } else {
      if (slot.assignmentType === "treasures_talk" && slot.durationMinutes !== 10) {
        errors.push(`${label}: el discurso inicial de Tesoros de la Biblia debe durar 10 minutos.`);
      }
      if (slot.section === "living" && (
        primary.gender !== "male"
        || (primary.appointment !== "elder" && primary.appointment !== "ministerial_servant")
      )) {
        errors.push(`${label}: Nuestra vida cristiana requiere un anciano o siervo ministerial activo.`);
      }
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
          if (slot.assignmentType === "student_talk" && isWhatWouldYouSayAssignment(slot)
            && primary.appointment !== "elder" && primary.appointment !== "ministerial_servant") {
            errors.push(`${label}: la parte «¿Qué diría?» requiere un anciano o siervo ministerial activo.`);
          }
          break;
        case "living_needs":
          if (primary.appointment !== "elder" && primary.appointment !== "ministerial_servant") {
            errors.push(`${label}: Nuestra vida cristiana requiere un anciano o siervo ministerial activo.`);
          }
          break;
        case "bible_study_conductor":
          if (primary.appointment !== "elder" && primary.appointment !== "ministerial_servant") {
            errors.push(`${label}: el conductor debe ser un anciano o siervo ministerial activo.`);
          }
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
      else {
        if (primary && assistant.id === primary.id) errors.push(`${label}: titular y ayudante deben ser personas distintas.`);
        if ((slot.assignmentType === "treasures_talk" || slot.assignmentType === "gems" || slot.section === "living")
          && (assistant.gender !== "male" || (assistant.appointment !== "elder" && assistant.appointment !== "ministerial_servant"))) {
          errors.push(`${label}: los participantes de esta parte deben ser ancianos o siervos ministeriales activos.`);
        }
      }
    }

    if (slot.eligibilityConfirmed !== true) {
      errors.push(`${label}: falta confirmar la revisión humana de elegibilidad S-38-S.`);
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

