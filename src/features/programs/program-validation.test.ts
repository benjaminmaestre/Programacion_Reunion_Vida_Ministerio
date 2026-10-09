import { describe, expect, it } from "vitest";
import type { DirectoryMember } from "../members/demo-data";
import type { MeetingProgramDetail } from "./program-types";
import { invalidateReviewIfChanged, validateProgramForPublication } from "./program-validation";

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
    chairmanId: "m3",
    leadershipReviewConfirmed: true,
    leadershipReviewConfirmedBy: "responsable-1",
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
    const result = validateProgramForPublication(program(), members);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("permite semanas de asamblea sin intervenciones ordinarias", () => {
    const assemblyProg = program({ weekType: "assembly", notes: "Semana de asamblea: no hay reunión ordinaria.", slots: [] });
    const result = validateProgramForPublication(assemblyProg, members);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("permite semana de conmemoración exigiendo solo presidente activo", () => {
    const memorialProg = program({ weekType: "memorial", chairmanId: "m3", notes: "Semana de la Conmemoración de la Muerte de Cristo.", slots: [] });
    const result = validateProgramForPublication(memorialProg, members);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("bloquea una semana de asamblea sin aviso ni nota identificable", () => {
    const result = validateProgramForPublication(program({ weekType: "assembly", notes: undefined, slots: [] }), members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("aviso"))).toBe(true);
  });

  it("exige presidente anciano y nota del evento para la Conmemoración", () => {
    const wrongChairman = validateProgramForPublication(program({
      weekType: "memorial",
      chairmanId: "m1",
      notes: "Semana de la Conmemoración.",
      slots: [],
    }), members);
    expect(wrongChairman.isValid).toBe(false);
    expect(wrongChairman.errors.some((error) => error.includes("anciano"))).toBe(true);

    const missingNotice = validateProgramForPublication(program({
      weekType: "memorial",
      chairmanId: "m3",
      notes: undefined,
      slots: [],
    }), members);
    expect(missingNotice.isValid).toBe(false);
    expect(missingNotice.errors.some((error) => error.includes("evento especial"))).toBe(true);
  });

  it("bloquea una visita del superintendente sin título real del discurso", () => {
    const result = validateProgramForPublication(program({
      weekType: "circuit_overseer",
      circuitOverseerTalkTitle: " ",
      chairmanId: "m3",
    }), members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("título real"))).toBe(true);
  });

  it("invalida la confirmación de elegibilidad cuando cambia el participante titular", () => {
    const originalSlot = {
      id: "s1",
      primaryParticipantId: "m1",
      eligibilityConfirmed: true,
      eligibilityConfirmedBy: "user-1",
    };
    const updatedSlot = invalidateReviewIfChanged(originalSlot, { primaryParticipantId: "m2" });
    expect(updatedSlot.eligibilityConfirmed).toBe(false);
    expect(updatedSlot.eligibilityConfirmedBy).toBeUndefined();

    const titleChanged = invalidateReviewIfChanged({
      title: "Título original",
      eligibilityConfirmed: true,
      eligibilityConfirmedBy: "user-1",
    }, { title: "Título modificado" });
    expect(titleChanged.eligibilityConfirmed).toBe(false);
    expect(titleChanged.eligibilityConfirmedBy).toBeUndefined();
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

  it("bloquea un programa vacío en semana normal", () => {
    const result = validateProgramForPublication(program({ slots: [] }), members);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("El programa no tiene intervenciones.");
  });

  it("bloquea revisitas con titular y ayudante de distinto sexo", () => {
    const candidate = program({ slots: [{
      ...program().slots[0],
      assignmentType: "revisit",
      primaryParticipantId: "m1",
      assistantParticipantId: "m3",
    }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("deben ser del mismo sexo"))).toBe(true);
  });

  it("bloquea publicación sin revisión de Presidencia y Consejería", () => {
    const candidate = program({ leadershipReviewConfirmed: false });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("Presidencia y Consejería"))).toBe(true);
  });

  it("bloquea un tipo de asignación no reconocido", () => {
    const candidate = program({ slots: [{
      ...program().slots[0],
      assignmentType: undefined,
    }] });
    const result = validateProgramForPublication(candidate, members);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("tipo de asignación"))).toBe(true);
  });
});
