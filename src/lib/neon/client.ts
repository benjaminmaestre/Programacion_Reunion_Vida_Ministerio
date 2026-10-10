"use client";

import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import { getNeonPublicConfig, type NeonPublicConfig } from "./env";

let pendingAccessToken: Promise<string> | null = null;

/**
 * Ask our same-origin server for the signed Neon Auth JWT.
 *
 * The session token returned by Better Auth is not itself the JWT PostgreSQL
 * needs for auth.uid(). Fetching the JWT through the server also avoids relying
 * on a cached SDK session token when the application has been idle.
 */
async function getServerIssuedAccessToken(): Promise<string> {
  if (!pendingAccessToken) {
    pendingAccessToken = (async () => {
      const response = await fetch(
        new URL("/api/session-token", window.location.origin),
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const payload: unknown = await response.json().catch(() => null);
      const token =
        typeof payload === "object" && payload !== null && "token" in payload
          ? (payload as { token?: unknown }).token
          : null;

      if (!response.ok || typeof token !== "string" || token.length === 0) {
        throw new Error("No se pudo validar tu sesión. Inicia sesión nuevamente.");
      }

      return token;
    })();
  }

  const request = pendingAccessToken;
  try {
    return await request;
  } finally {
    if (pendingAccessToken === request) pendingAccessToken = null;
  }
}

/**
 * The SDK's built-in token can be hydrated from the Better Auth session-cookie
 * cache. Override the Authorization header at the final Data API fetch boundary
 * with a JWT explicitly issued for this request's browser session.
 */
const dataApiFetch: typeof fetch = async (input, init) => {
  if (typeof window === "undefined") {
    return fetch(input, init);
  }

  const accessToken = await getServerIssuedAccessToken();
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, { ...init, headers });
};

function buildNeonClient(config: NeonPublicConfig) {
  const authUrl = typeof window === "undefined"
    ? config.authUrl
    : new URL("/api/auth", window.location.origin).toString();

  return createClient({
    auth: {
      url: authUrl,
      adapter: SupabaseAuthAdapter(),
      // Las consultas protegidas siguen autorizándose mediante el JWT del usuario
      // y las políticas RLS. No se conceden permisos adicionales a sesiones anónimas.
      allowAnonymous: true,
    },
    dataApi: {
      url: config.dataApiUrl,
      options: {
        global: {
          fetch: dataApiFetch,
        },
      },
    },
  });
}

/**
 * Crea un cliente para el ciclo de vida de la sección actual.
 * Cada sección obtiene su propia instancia para no reutilizar estado de autenticación
 * en memoria de una sección anterior.
 */
export function createNeonBrowserClient() {
  const config = getNeonPublicConfig();
  if (!config) {
    throw new Error("La aplicación no está configurada. Contacta al administrador.");
  }

  return buildNeonClient(config);
}
