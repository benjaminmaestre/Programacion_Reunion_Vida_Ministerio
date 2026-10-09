import { describe, expect, it } from "vitest";
import type { DirectoryMember } from "../members/demo-data";
import type { MeetingProgramDetail } from "./program-types";
import { validateProgramForPublication } from "./program-validation";

const members: DirectoryMember[] = [
  { id: "m1", firstName: "Laura", lastName: "Vega", gender: "female", appointment: "none", isActive: true, isBaptized: true },
  { id: "m2", firstName: "Sofía", lastName: "Castro", gender: "female", appointment: "none", isActive: true, isBaptized: null },
  { id: "m3", firstName: "David", lastName: "Morales", gender: "male", appointment: "elder", isActive: true, isBaptized: true },
  { id: "m4", firstName: "Carlos", lastName: "Jiménez", gender: "male", appointment: "none", isActive: false, isBaptized: null },
];

function program(overrides: Partial<MeetingProgramDetail> = {}): MeetingProgramDetail {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    meetingDate: "2026-11-02",
    weekType: "normal",
    bimonthCycle: "2026-6",
    historyPeriod: "2026-S2",
    status: "draft",
    updatedAt: "2026-10-09T00:00:00.000Z",
    slots: [{
      id: "00000000-0000-4000-8000-000000000002",
      meetingProgramId: "00000000-0000-4000-8000-000000000001",
      section: "ministers",
      title: "Empecemos conversaciones",
      durationMinutes: 3,
      orderIndex: 1,
      isStudentPart: true,
      assignmentType: "conversation",
      primaryParticipantId: "m1",
      assistantParticipantId: "m2",
      eligibilityConfirmed: true,
      eligibilityConfirmedBy: "responsable-1",
    }],
    ...overrides,
  };
}

describe("validación de publicación de programas", () => {
  it("acepta un programa con participantes activos, ayudante distinto y revisión humana", () => {
    expect(validateProgramForPublication(program(), members)).toEqual({ isValid: true, errors: [] });
  });

  it("bloquea una intervención sin titular", () => {
    const candidate = program({ slots: [{ ...program().slots[0], primaryParticipantId: undefined }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("selecciona un participante activo"))).toBe(true);
  });

  it("bloquea la publicación cuando falta la confirmación humana", () => {
    const candidate = program({ slots: [{ ...program().slots[0], eligibilityConfirmed: false }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("revisión humana"))).toBe(true);
  });

  it("bloquea una asignación de Tesoros a un publicador sin nombramiento", () => {
    const candidate = program({ slots: [{
      ...program().slots[0],
      title: "Tesoros de la Biblia",
      assignmentType: "treasures_talk",
      primaryParticipantId: "m1",
      assistantParticipantId: undefined,
    }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("anciano o siervo ministerial varón"))).toBe(true);
  });

  it("bloquea el uso de un participante inactivo", () => {
    const candidate = program({ slots: [{ ...program().slots[0], primaryParticipantId: "m4" }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("participante activo"))).toBe(true);
  });

  it("bloquea un programa vacío", () => {
    const result = validateProgramForPublication(program({ slots: [] }), members);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("El programa no tiene intervenciones.");
  });
});
