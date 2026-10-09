import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Cliente de navegador compartido. La clave publicable no sustituye las políticas RLS.
 * Crear este cliente solo en Client Components.
 */
export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  browserClient ??= createBrowserClient(config.url, config.publishableKey);
  return browserClient;
}
