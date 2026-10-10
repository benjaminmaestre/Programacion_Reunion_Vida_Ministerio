import { NextResponse } from "next/server";
import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import { auth } from "@/lib/neon/auth-server";

const handlers = auth.handler();

// Managed Neon Auth returns the JWT for the Data API in Set-Auth-Jwt.
 // The session-cookie fast path may omit that header, leaving the client with the
 // opaque Better Auth session token. Disable only that cache for get-session.
export async function GET(request: Request, context: AuthRouteContext) {
  const url = new URL(request.url);
  if (url.pathname.toLowerCase().split("/").includes("get-session")) {
    url.searchParams.set("disableCookieCache", "true");
    const requestWithoutSessionCache = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
      signal: request.signal,
    });
    return handlers.GET(requestWithoutSessionCache, context);
  }
  return handlers.GET(request, context);
}
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;

type AuthRouteContext = { params: Promise<{ path: string[] }> };

export async function POST(request: Request, context: AuthRouteContext) {
  const pathSegments = new URL(request.url).pathname.toLowerCase().split("/").filter(Boolean);
  const isSignUp = pathSegments.some((segment) => segment === "sign-up" || segment === "signup");

  // Bootstrap único: el registro solo funciona antes de configurar al administrador supremo.
  if (isSignUp) {
    const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim();
    const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim();

    if (!dataApiUrl || !authUrl) {
      return NextResponse.json(
        { message: "No se pudo verificar el estado de configuración." },
        { status: 503 },
      );
    }

    try {
      const neon = createClient({
        auth: {
          url: authUrl,
          adapter: SupabaseAuthAdapter(),
          // Necesario para comprobar is_admin_configured antes de que exista una sesión.
          // Los permisos efectivos siguen restringidos en PostgreSQL.
          allowAnonymous: true,
        },
        dataApi: { url: dataApiUrl },
      });
      const { data, error } = await neon.rpc("is_admin_configured", {});

      // Si no se puede comprobar el estado, se deniega por seguridad.
      if (error || data !== false) {
        return NextResponse.json(
          { message: "El registro está cerrado. Solicita una cuenta al administrador supremo." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: "No se pudo verificar el estado de configuración." },
        { status: 503 },
      );
    }
  }

  return handlers.POST(request, context);
}
