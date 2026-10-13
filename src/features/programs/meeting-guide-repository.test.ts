import { describe, expect, it, vi } from "vitest";
import type { createNeonBrowserClient } from "@/lib/neon/client";
import { deleteActiveMeetingGuide } from "./meeting-guide-repository";

type NeonClient = ReturnType<typeof createNeonBrowserClient>;

function makeClient(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>): NeonClient {
  return { rpc: rpcImpl } as unknown as NeonClient;
}

describe("repositorio de guías: eliminación de la guía activa", () => {
  it("llama a la RPC delete_active_meeting_guide sin argumentos", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = makeClient(rpc);

    await deleteActiveMeetingGuide(client);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("delete_active_meeting_guide", {});
  });

  it("avisa que falta aplicar la migración cuando la RPC no existe", async () => {
    const client = makeClient(async () => ({
      data: null,
      error: { code: "PGRST202", message: "could not find the function" },
    }));

    await expect(deleteActiveMeetingGuide(client)).rejects.toThrow("migración 015");
  });

  it("propaga el mensaje de error de la base de datos", async () => {
    const client = makeClient(async () => ({
      data: null,
      error: { message: "Acceso denegado: tu rol no permite eliminar la guía." },
    }));

    await expect(deleteActiveMeetingGuide(client)).rejects.toThrow("no permite eliminar la guía");
  });
});
