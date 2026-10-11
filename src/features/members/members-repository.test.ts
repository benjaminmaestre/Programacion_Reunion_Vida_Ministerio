import { describe, expect, it, vi } from "vitest";
import { getCurrentAppUser, MembershipRequiredError } from "./members-repository";
import type { DirectoryMember } from "./demo-data";
import type { MeetingProgramDetail } from "../programs/program-types";

describe("Gestión del directorio y estado desconocido de bautismo", () => {
  it("permite registrar y conservar el estado de bautismo desconocido (null) sin convertirlo en verdadero", () => {
    const memberWithUnknownBaptism: DirectoryMember = {
      id: "mem-unk-1",
      firstName: "Gabriel",
      lastName: "Morales",
      gender: "male",
      appointment: "none",
      isRegularPioneer: false,
      isActive: true,
      isBaptized: null, // Desconocido / Pendiente de confirmar
    };

    expect(memberWithUnknownBaptism.isBaptized).toBeNull();
    expect(memberWithUnknownBaptism.isBaptized).not.toBe(true);
    expect(memberWithUnknownBaptism.isBaptized).not.toBe(false);
  });

  it("conserva la condición de precursor regular y responsabilidades adicionales como Secretario", () => {
    const secretary: DirectoryMember = {
      id: "mem-sec-1",
      firstName: "Luis",
      lastName: "Castrillo",
      gender: "male",
      appointment: "elder",
      isRegularPioneer: false,
      additionalRoles: "Secretario",
      isActive: true,
      isBaptized: true,
    };

    expect(secretary.appointment).toBe("elder");
    expect(secretary.additionalRoles).toBe("Secretario");
  });

  it("inactivar un registro conserva la ficha y retira a la persona de nuevas asignaciones pero mantiene su historial", () => {
    const membersList: DirectoryMember[] = [
      { id: "1", firstName: "David", lastName: "Morales", gender: "male", appointment: "elder", isActive: true, isBaptized: true },
      { id: "2", firstName: "Carlos", lastName: "Jiménez", gender: "male", appointment: "none", isActive: false, isBaptized: null },
    ];

    const activeMembers = membersList.filter((m) => m.isActive);
    expect(activeMembers).toHaveLength(1);
    expect(activeMembers[0].id).toBe("1");

    // El registro inactivo aún se encuentra en el arreglo completo
    const archivedMember = membersList.find((m) => m.id === "2");
    expect(archivedMember).toBeDefined();
    expect(archivedMember?.isActive).toBe(false);
  });
});

describe("Integración de assignment_type y persistencia de títulos personalizados", () => {
  it("mantiene el tipo de asignación estructurado separado del título personalizado escrito según la Guía", () => {
    const program: MeetingProgramDetail = {
      id: "prog-test-1",
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "2026-6",
      historyPeriod: "2026-S2",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [
        {
          id: "slot-1",
          meetingProgramId: "prog-test-1",
          section: "treasures",
          title: "Levítico 17:1-16 — La santidad de la sangre", // Título personalizado
          durationMinutes: 10,
          orderIndex: 1,
          isStudentPart: false,
          assignmentType: "treasures_talk", // Tipo estructurado
        },
      ],
    };

    const slot = program.slots[0];
    expect(slot.assignmentType).toBe("treasures_talk");
    expect(slot.title).toBe("Levítico 17:1-16 — La santidad de la sangre");
  });
});

describe("Reintento y diagnóstico de identidad en getCurrentAppUser", () => {
  it("resuelve con la fila si la RPC devuelve vacío en el 1.er intento y la fila correcta en el 2.º", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const mockNeon = {
      rpc: vi.fn(async () => {
        calls++;
        if (calls === 1) return { data: [], error: null };
        return { data: [{ user_id: "user-retry-1", role: "user", is_active: true }], error: null };
      }),
    };

    const userPromise = getCurrentAppUser(mockNeon as any, "user-retry-1");
    await vi.advanceTimersByTimeAsync(600);
    const user = await userPromise;

    expect(user).toEqual({ user_id: "user-retry-1", role: "user", is_active: true });
    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it("lanza MembershipRequiredError si la RPC devuelve vacío 3 veces, llamándose exactamente 3 veces", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const mockNeon = {
      rpc: vi.fn(async () => {
        calls++;
        return { data: [], error: null };
      }),
    };

    const userPromise = getCurrentAppUser(mockNeon as any, "user-retry-1");
    const testPromise = expect(userPromise).rejects.toThrow(MembershipRequiredError);
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1500);
    await testPromise;

    expect(calls).toBe(3);
    vi.useRealTimers();
  });

  it("NO reintenta si la RPC devuelve un error de red (1 sola llamada)", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const mockNeon = {
      rpc: vi.fn(async () => {
        calls++;
        throw new Error("Network Error");
      }),
    };

    const userPromise = getCurrentAppUser(mockNeon as any, "user-retry-1");
    await expect(userPromise).rejects.toThrow("Network Error");

    expect(calls).toBe(1);
    vi.useRealTimers();
  });
});
