import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./env";

/**
 * Cliente por solicitud para Server Components, Route Handlers y Server Actions.
 * La cookie puede ser de solo lectura durante un render; en ese caso proxy.ts gestiona
 * la renovación de la sesión.
 */
export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase no está configurado. Revisa las variables NEXT_PUBLIC_SUPABASE_*.");
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components no siempre pueden escribir cookies durante el render.
          // El proxy de sesión las actualiza antes del render cuando corresponde.
        }
      },
    },
  });
}
