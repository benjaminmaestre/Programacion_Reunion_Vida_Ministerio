import type { MeetingProgramDetail } from "./program-types";

export interface PendingDuplicateAssignment {
  memberId: string;
  memberName: string;
  existingPartTitle: string;
  targetRole: "chairman" | "auxiliary" | "opening_prayer" | "closing_prayer" | "primary" | "assistant";
  slotId?: string;
  isChairmanAssigningOther: boolean;
}

/**
 * Comprueba si un participante ya tiene una intervención asignada en la misma fecha de reunión.
 * Si ya tiene una asignación en otro rol o slot, devuelve el título descriptivo de dicha asignación.
 */
export function findExistingAssignment(
  program: MeetingProgramDetail,
  memberId: string,
  targetRole: "chairman" | "auxiliary" | "opening_prayer" | "closing_prayer" | "primary" | "assistant",
  currentSlotId?: string
): { title: string } | null {
  // Las oraciones no despliegan advertencia de duplicidad
  if (targetRole === "opening_prayer" || targetRole === "closing_prayer") {
    return null;
  }

  if (targetRole !== "chairman" && program.chairmanId === memberId) {
    return { title: "Presidente de la reunión" };
  }
  if (targetRole !== "auxiliary" && program.auxiliaryCounselorId === memberId) {
    return { title: "Consejero auxiliar" };
  }
  for (const slot of program.slots) {
    if (slot.id === currentSlotId) {
      if (targetRole === "primary" && slot.assistantParticipantId === memberId) {
        return { title: `${slot.title} (Ayudante)` };
      }
      if (targetRole === "assistant" && slot.primaryParticipantId === memberId) {
        return { title: `${slot.title} (Titular)` };
      }
    } else {
      if (slot.primaryParticipantId === memberId) {
        return { title: `${slot.title} (Titular)` };
      }
      if (slot.assistantParticipantId === memberId) {
        return { title: `${slot.title} (Ayudante)` };
      }
    }
  }
  return null;
}
