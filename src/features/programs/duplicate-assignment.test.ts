import { describe, expect, it } from "vitest";
import { findExistingAssignment } from "./duplicate-assignment";
import type { MeetingProgramDetail } from "./program-types";

describe("findExistingAssignment", () => {
  const sampleProgram: MeetingProgramDetail = {
    id: "prog-1",
    meetingDate: "2026-03-02",
    bimonthCycle: "2026-1",
    historyPeriod: "2026-S1",
    weekType: "normal",
    status: "draft",
    updatedAt: "2026-03-01T00:00:00Z",
    chairmanId: "member-elder-1",
    auxiliaryCounselorId: "member-elder-2",
    openingPrayerParticipantId: "member-elder-3",
    closingPrayerParticipantId: "member-brother-2",
    slots: [
      {
        id: "slot-reading",
        meetingProgramId: "prog-1",
        orderIndex: 1,
        title: "Lectura de la Biblia",
        section: "treasures",
        durationMinutes: 4,
        isStudentPart: true,
        primaryParticipantId: "member-brother-1",
        assignmentType: "bible_reading",
        eligibilityConfirmed: true,
      },
      {
        id: "slot-talk",
        meetingProgramId: "prog-1",
        orderIndex: 2,
        title: "Primera conversación",
        section: "ministers",
        durationMinutes: 4,
        isStudentPart: true,
        primaryParticipantId: "member-sister-1",
        assistantParticipantId: "member-sister-2",
        assignmentType: "conversation",
        eligibilityConfirmed: true,
      },
    ],
  };

  it("devuelve null cuando el participante no tiene ninguna asignación previa", () => {
    const result = findExistingAssignment(sampleProgram, "member-free", "primary", "slot-new");
    expect(result).toBeNull();
  });

  it("no despliega advertencia al seleccionar para una oración inicial", () => {
    const result = findExistingAssignment(sampleProgram, "member-brother-1", "opening_prayer");
    expect(result).toBeNull();
  });

  it("no despliega advertencia al seleccionar para una oración final", () => {
    const result = findExistingAssignment(sampleProgram, "member-brother-1", "closing_prayer");
    expect(result).toBeNull();
  });

  it("detecta duplicado si el presidente intenta ser asignado como titular en un slot", () => {
    const result = findExistingAssignment(sampleProgram, "member-elder-1", "primary", "slot-reading");
    expect(result).toEqual({ title: "Presidente de la reunión" });
  });

  it("no marca duplicado sobre sí mismo al volver a seleccionar el presidente como presidente", () => {
    const result = findExistingAssignment(sampleProgram, "member-elder-1", "chairman");
    expect(result).toBeNull();
  });

  it("detecta duplicado si el consejero auxiliar intenta ser asignado a un slot", () => {
    const result = findExistingAssignment(sampleProgram, "member-elder-2", "primary", "slot-talk");
    expect(result).toEqual({ title: "Consejero auxiliar" });
  });

  it("detecta duplicado si un titular ya asignado se selecciona como ayudante en otro slot", () => {
    const result = findExistingAssignment(sampleProgram, "member-brother-1", "assistant", "slot-talk");
    expect(result).toEqual({ title: "Lectura de la Biblia (Titular)" });
  });

  it("detecta duplicado si un ayudante ya asignado se selecciona como titular en otro slot", () => {
    const result = findExistingAssignment(sampleProgram, "member-sister-2", "primary", "slot-reading");
    expect(result).toEqual({ title: "Primera conversación (Ayudante)" });
  });

  it("detecta duplicado si una persona intenta ser titular y ayudante dentro de la misma parte", () => {
    const result = findExistingAssignment(sampleProgram, "member-sister-1", "assistant", "slot-talk");
    expect(result).toEqual({ title: "Primera conversación (Titular)" });
  });
});
