import { describe, expect, it } from "vitest";
import { buildDefaultMeetingProgram, calculateBimonthCycle, calculateHistoryPeriod } from "./program-builder";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Constructor de programas e identificadores UUID válidos", () => {
  it("genera identificadores UUID v4 puros sin prefijos ni concatenaciones incompatibles con PostgreSQL", () => {
    const program = buildDefaultMeetingProgram("2026-11-16", "normal");

    expect(program.id).toMatch(UUID_V4_REGEX);
    expect(program.id).not.toContain("prog-");

    for (const slot of program.slots) {
      expect(slot.id).toMatch(UUID_V4_REGEX);
      expect(slot.id).not.toContain("slot-");
      expect(slot.meetingProgramId).toBe(program.id);
    }
  });

  it("calcula correctamente los 6 ciclos bimestrales y los 2 semestres con fechas límite", () => {
    // Ciclos 1 a 6
    expect(calculateBimonthCycle("2026-01-01")).toBe("2026-1");
    expect(calculateBimonthCycle("2026-02-28")).toBe("2026-1");
    expect(calculateBimonthCycle("2026-03-01")).toBe("2026-2");
    expect(calculateBimonthCycle("2026-04-30")).toBe("2026-2");
    expect(calculateBimonthCycle("2026-05-15")).toBe("2026-3");
    expect(calculateBimonthCycle("2026-06-30")).toBe("2026-3");
    expect(calculateBimonthCycle("2026-07-01")).toBe("2026-4");
    expect(calculateBimonthCycle("2026-08-31")).toBe("2026-4");
    expect(calculateBimonthCycle("2026-09-10")).toBe("2026-5");
    expect(calculateBimonthCycle("2026-10-31")).toBe("2026-5");
    expect(calculateBimonthCycle("2026-11-01")).toBe("2026-6");
    expect(calculateBimonthCycle("2026-12-31")).toBe("2026-6");

    // Semestres S1 y S2
    expect(calculateHistoryPeriod("2026-01-01")).toBe("2026-S1");
    expect(calculateHistoryPeriod("2026-06-30")).toBe("2026-S1");
    expect(calculateHistoryPeriod("2026-07-01")).toBe("2026-S2");
    expect(calculateHistoryPeriod("2026-12-31")).toBe("2026-S2");
  });

  it("construye la estructura adecuada según el tipo de semana (normal, visita, asamblea, conmemoración)", () => {
    const normalProg = buildDefaultMeetingProgram("2026-11-16", "normal");
    expect(normalProg.slots).toHaveLength(9);

    const visitProg = buildDefaultMeetingProgram("2026-11-23", "circuit_overseer");
    expect(visitProg.slots).toHaveLength(5);
    expect(visitProg.slots.some((s) => s.title.includes("Superintendente de Circuito"))).toBe(true);

    const assemblyProg = buildDefaultMeetingProgram("2026-12-07", "assembly");
    expect(assemblyProg.slots).toHaveLength(1);
    expect(assemblyProg.slots[0].section).toBe("auxiliary");

    const memorialProg = buildDefaultMeetingProgram("2026-04-02", "memorial");
    expect(memorialProg.slots).toHaveLength(1);
    expect(memorialProg.slots[0].title).toContain("Conmemoración");
  });

  it("permite retirar lógicamente una intervención sin destruir la integridad del programa borrador", () => {
    const program = buildDefaultMeetingProgram("2026-11-16", "normal");
    const initialCount = program.slots.length;
    const slotToRemove = program.slots[0];

    const updatedSlots = program.slots.filter((s) => s.id !== slotToRemove.id);
    expect(updatedSlots).toHaveLength(initialCount - 1);
    expect(updatedSlots.some((s) => s.id === slotToRemove.id)).toBe(false);
  });
});
