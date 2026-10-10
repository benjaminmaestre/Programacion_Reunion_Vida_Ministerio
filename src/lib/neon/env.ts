export interface NeonPublicConfig {
  authUrl: string;
  dataApiUrl: string;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Public endpoints only; database passwords and server secrets never belong in NEXT_PUBLIC_* variables. */
export function getNeonPublicConfig(): NeonPublicConfig | null {
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim();
  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim();
  if (!authUrl || !dataApiUrl) return null;
  if (!isSafeHttpsUrl(authUrl) || !isSafeHttpsUrl(dataApiUrl)) return null;
  return { authUrl, dataApiUrl };
}

export function isNeonConfigured(): boolean {
  return getNeonPublicConfig() !== null;
}
