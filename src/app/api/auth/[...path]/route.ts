import { NextResponse } from "next/server";
import { createClient } from "@neondatabase/neon-js";
import { auth } from "@/lib/neon/auth-server";

const handlers = auth.handler();

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;

export async function POST(request: Request) {
  const path = new URL(request.url).pathname.toLowerCase().replace(/\/+$/, "");
  // Bootstrap único: el registro de identidad solo funciona antes de configurar al administrador supremo.
  if (/(^|\/)(sign-up|signup)(\/|$)/.test(path)) {
    const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim();
    if (!dataApiUrl) {
      return NextResponse.json({ message: "No se pudo verificar el estado de configuración." }, { status: 503 });
    }
    try {
      const neon = createClient({ dataApi: { url: dataApiUrl } });
      const { data, error } = await neon.rpc("is_admin_configured", {});
      // Si no se puede comprobar el estado, se deniega por seguridad.
      if (error || data !== false) {
        return NextResponse.json(
          { message: "El registro está cerrado. Solicita una cuenta al administrador supremo." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ message: "No se pudo verificar el estado de configuración." }, { status: 503 });
    }
  }
  return handlers.POST(request);
}
