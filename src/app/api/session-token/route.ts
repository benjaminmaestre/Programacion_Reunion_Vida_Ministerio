import { NextResponse } from "next/server";
import { auth } from "@/lib/neon/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Returns the signed Neon Auth JWT for the current cookie-backed session.
 * The opaque Better Auth session token must never be used as a Data API JWT.
 */
export async function GET() {
  try {
    const { data, error } = await auth.token();
    const token = data?.token;

    if (error || typeof token !== "string" || token.length === 0) {
      return NextResponse.json(
        { error: "No se pudo validar tu sesión. Inicia sesión nuevamente." },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
            Pragma: "no-cache",
            Vary: "Cookie",
          },
        },
      );
    }

    return NextResponse.json(
      { token },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Pragma: "no-cache",
          Vary: "Cookie",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo validar tu sesión. Inicia sesión nuevamente." },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Pragma: "no-cache",
          Vary: "Cookie",
        },
      },
    );
  }
}
