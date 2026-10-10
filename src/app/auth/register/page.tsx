"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createNeonBrowserClient } from "@/lib/neon/client";

export default function RegisterPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (!name || !email) {
      setError("Escribe tu nombre y correo electrónico.");
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setBusy(false);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }

    try {
      const neon = createNeonBrowserClient();
      const { data, error: signUpError } = await neon.auth.signUp({
        email,
        password,
        options: { data: { displayName: name } },
      });
      if (signUpError || !data.user) {
        setError(signUpError?.message || "No se pudo crear la cuenta. Comprueba el correo e inténtalo otra vez.");
        return;
      }
      setMessage("Cuenta creada. Verificaremos tu acceso a la congregación.");
      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo crear la cuenta. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">VM</span>
          <div><p className="font-semibold">Vida y Ministerio</p><p className="text-sm text-slate-500">Crear cuenta Neon</p></div>
        </div>
        <div><h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1><p className="mt-2 text-sm text-slate-600">Usa tu correo personal. Crear una cuenta no concede automáticamente acceso al directorio ni permisos de administración.</p></div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">Nombre completo<input name="name" required autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <label className="block text-sm font-medium">Correo electrónico<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <label className="block text-sm font-medium">Contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <label className="block text-sm font-medium">Confirmar contraseña<input name="confirmation" type="password" required minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50" type="submit">{busy ? "Creando cuenta…" : "Crear cuenta"}</button>
        </form>
        <p className="text-sm text-slate-600">¿Ya tienes cuenta? <a className="font-semibold text-blue-700 underline" href="/">Volver a iniciar sesión</a>.</p>
      </section>
    </main>
  );
}
