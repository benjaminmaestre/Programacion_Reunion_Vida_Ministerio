import { createNeonAuth } from "@neondatabase/neon-js/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) throw new Error("Falta NEON_AUTH_BASE_URL en el entorno de Neon.");
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error("NEON_AUTH_COOKIE_SECRET debe tener al menos 32 caracteres.");
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret },
});
