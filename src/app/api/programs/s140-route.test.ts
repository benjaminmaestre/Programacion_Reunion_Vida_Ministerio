import { describe, expect, it, vi } from "vitest";
import { S140DocxGenerator } from "../../../features/printing/s140-docx-generator";
import { POST } from "./[programId]/s140/route";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

describe("Generación del documento S-140 DOCX y Route Handler", () => {
  it("genera un buffer DOCX válido omitiendo intervenciones retiradas lógicamente", () => {
    const activeSlots = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        section: "treasures" as const,
        title: "Levítico 17:1-16 — La santidad de la sangre",
        assignment_type: "treasures_talk",
        primary_participant_id: "p-1",
        assistant_participant_id: null,
        order_index: 1,
        is_deleted: false,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        section: "treasures" as const,
        title: "Intervención retirada",
        assignment_type: "gems",
        primary_participant_id: "p-2",
        assistant_participant_id: null,
        order_index: 2,
        is_deleted: true, // Debe omitirse
      },
    ];

    const slotsToPrint = activeSlots.filter((slot) => !slot.is_deleted);
    expect(slotsToPrint).toHaveLength(1);
    expect(slotsToPrint[0].title).toBe("Levítico 17:1-16 — La santidad de la sangre");

    const docxBuffer = S140DocxGenerator.generateDocx({
      weekDate: "2026-11-02",
      chairman: "David Morales",
      auxiliaryCounselor: "Félix Pérez",
      treasuresTalkTitle: slotsToPrint[0].title,
      treasuresTalkSpeaker: "David Morales",
      gemsSpeaker: "",
      bibleReader: "",
      ministersParts: [],
      livingParts: [],
      congregationStudyConductor: "",
      congregationStudyReader: "",
    });

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(100);
    const bytes = new Uint8Array(docxBuffer);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    const findZipSignature = (signature: number[]) => {
      for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - signature.length; i++) {
        if (signature.every((byte, offset) => bytes[i + offset] === byte)) return i;
      }
      return -1;
    };
    expect(findZipSignature([0x50, 0x4b, 0x01, 0x02])).toBeGreaterThan(-1);
    expect(findZipSignature([0x50, 0x4b, 0x05, 0x06])).toBeGreaterThan(-1);
    expect(generatorSpy).toHaveBeenCalledOnce();
    const generated = generatorSpy.mock.calls[0][0];
    expect(generated.treasuresTalkTitle).toBe("Tesoros de la Biblia");
    expect(generated.gemsSpeaker).toBe("");
    expect(JSON.stringify(generated)).not.toContain("NO DEBE APARECER");
    generatorSpy.mockRestore();
  });

  it("devuelve 503 si Supabase no está configurado", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const request = new Request("http://localhost/api/programs/prog-1/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "prog-1" }) });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error).toContain("Supabase no está configurado");
  });

  it("devuelve 401 si no hay usuario autenticado", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new Request("http://localhost/api/programs/prog-1/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "prog-1" }) });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toContain("Inicia sesión");
  });

  it("devuelve 403 si el usuario no tiene acceso activo en app_users", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new Request("http://localhost/api/programs/prog-1/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "prog-1" }) });

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("No tienes acceso activo");
  });

  it("devuelve 404 si el programa no existe", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === "app_users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "user-123", is_active: true }, error: null }),
          };
        }
        if (table === "meeting_programs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new Request("http://localhost/api/programs/prog-missing/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "prog-missing" }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toContain("No se encontró el programa");
  });

  it("devuelve 500 ante un error en la consulta de intervenciones", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === "app_users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "user-123", is_active: true }, error: null }),
          };
        }
        if (table === "meeting_programs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p-1", meeting_date: "2026-11-02" }, error: null }),
          };
        }
        if (table === "assignment_slots") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: new Error("DB Error") }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new Request("http://localhost/api/programs/p-1/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "p-1" }) });

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain("No se pudieron cargar las intervenciones");
  });

  it("devuelve 200 y un contenedor DOCX válido (PK magic bytes) excluyendo intervenciones retiradas", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === "app_users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "user-123", is_active: true }, error: null }),
          };
        }
        if (table === "meeting_programs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "prog-valid",
                meeting_date: "2026-11-02",
                chairman_id: "m-1",
                auxiliary_counselor_id: "m-2",
              },
              error: null,
            }),
          };
        }
        if (table === "assignment_slots") {
          const rows = [
            {
              id: "s-1",
              section: "treasures",
              title: "Tesoros de la Biblia",
              assignment_type: "treasures_talk",
              primary_participant_id: "m-1",
              assistant_participant_id: null,
              order_index: 1,
              is_deleted: false,
            },
            {
              id: "s-2",
              section: "treasures",
              title: "NO DEBE APARECER: intervención retirada",
              assignment_type: "gems",
              primary_participant_id: "m-2",
              assistant_participant_id: null,
              order_index: 2,
              is_deleted: true,
            },
          ];
          const query: any = {
            filters: [] as Array<{ field: string; value: unknown }>,
            select() { return this; },
            eq(field: string, value: unknown) { this.filters.push({ field, value }); return this; },
            order(field: string) {
              const filtered = rows
                .filter((row) => this.filters.every((filter) => (row as any)[filter.field] === filter.value))
                .sort((a, b) => Number((a as any)[field]) - Number((b as any)[field]));
              return Promise.resolve({ data: filtered, error: null });
            },
          };
          return query;
        }
        if (table === "members") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: "m-1", first_name: "David", last_name: "Morales", is_active: true },
                { id: "m-2", first_name: "Félix", last_name: "Pérez", is_active: true },
              ],
              error: null,
            }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof createServerClient>);

    const generatorSpy = vi.spyOn(S140DocxGenerator, "generateDocx");
    const request = new Request("http://localhost/api/programs/prog-valid/s140", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ programId: "prog-valid" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(response.headers.get("Content-Disposition")).toContain('filename="S-140-2026-11-02.docx"');
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);

    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});
