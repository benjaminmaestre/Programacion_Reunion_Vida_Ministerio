"use client";

import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import { getNeonPublicConfig, type NeonPublicConfig } from "./env";

function buildNeonClient(config: NeonPublicConfig) {
  const authUrl = typeof window === "undefined"
    ? config.authUrl
    : new URL("/api/auth", window.location.origin).toString();

  return createClient({
    auth: {
      url: authUrl,
      adapter: SupabaseAuthAdapter(),
      // Habilita solo el token anónimo para las comprobaciones previas al inicio de sesión.
      // PostgreSQL sigue limitando las operaciones anónimas mediante GRANT y RLS.
      allowAnonymous: true,
    },
    dataApi: {
      url: config.dataApiUrl,
    },
  });
}

let browserClient: ReturnType<typeof buildNeonClient> | undefined;

/**
 * Cliente browser para Neon Data API + Neon Auth.
 * La sesión usa el proxy del mismo origen /api/auth (evita depender de cookies de terceros).
 * El Data API siempre valida el JWT y aplica los GRANT/RLS de PostgreSQL.
 */
export function createNeonBrowserClient() {
  const config = getNeonPublicConfig();
  if (!config) {
    throw new Error("Neon no está configurado. Revisa NEXT_PUBLIC_NEON_AUTH_URL y NEXT_PUBLIC_NEON_DATA_API_URL.");
  }

  browserClient ??= buildNeonClient(config);
  return browserClient;
}
