import { NextResponse } from "next/server";
import { auth } from "@/lib/neon/auth-server";

const handlers = auth.handler();

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;

export async function POST(request: Request) {
  const path = new URL(request.url).pathname.toLowerCase().replace(/\/+$/, "");
  // Se bloquea el registro público; la creación de cuentas pasa por admin/create-user.
  if (/(^|\/)(sign-up|signup)(\/|$)/.test(path)) {
    return NextResponse.json(
      { message: "El registro público está deshabilitado. Solicita una cuenta al administrador supremo." },
      { status: 403 },
    );
  }
  return handlers.POST(request);
}
