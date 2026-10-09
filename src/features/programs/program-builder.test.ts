import { describe, expect, it } from "vitest";
import { buildDefaultMeetingProgram, calculateBimonthCycle, calculateHistoryPeriod } from "./program-builder";

describe("Constructor de programas e inicialización de ciclo/período", () => {
  it("calcula correctamente el ciclo bimestral y el período semestral para una fecha dada", () => {
    expect(calculateBimonthCycle("2026-11-02")).toBe("2026-6");
    expect(calculateBimonthCycle("2026-01-15")).toBe("2026-1");
    expect(calculateBimonthCycle("2026-06-30")).toBe("2026-3");

    expect(calculateHistoryPeriod("2026-03-10")).toBe("2026-S1");
    expect(calculateHistoryPeriod("2026-11-02")).toBe("2026-S2");
  });

  it("construye un programa borrador inicial con 9 intervenciones estándar", () => {
    const program = buildDefaultMeetingProgram("2026-11-16", "normal");

    expect(program.meetingDate).toBe("2026-11-16");
    expect(program.weekType).toBe("normal");
    expect(program.bimonthCycle).toBe("2026-6");
    expect(program.historyPeriod).toBe("2026-S2");
    expect(program.status).toBe("draft");
    expect(program.slots).toHaveLength(9);

    const sections = program.slots.map((s) => s.section);
    expect(sections).toContain("treasures");
    expect(sections).toContain("ministers");
    expect(sections).toContain("living");
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
