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

/**
 * Crea un cliente para el ciclo de vida de la sección actual.
 *
 * No se comparte una instancia global entre secciones: el cliente Neon mantiene
 * estado de autenticación/token en memoria y puede conservar un contexto obsoleto
 * después de varios minutos de inactividad. Al montar otra sección se crea una
 * instancia nueva y getSession() vuelve a hidratar la sesión desde el proxy
 * del mismo origen antes de ejecutar consultas protegidas.
 */
export function createNeonBrowserClient() {
  const config = getNeonPublicConfig();
  if (!config) {
    throw new Error("Neon no está configurado. Revisa NEXT_PUBLIC_NEON_AUTH_URL y NEXT_PUBLIC_NEON_DATA_API_URL.");
  }

  return buildNeonClient(config);
}
