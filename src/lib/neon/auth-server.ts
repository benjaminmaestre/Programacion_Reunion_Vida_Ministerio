import { createNeonAuth } from "@neondatabase/neon-js/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL || "https://placeholder.neon.tech";
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || "placeholder-secret-must-be-at-least-32-chars-long";

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret },
});
