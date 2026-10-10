"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createNeonBrowserClient } from "@/lib/neon/client";

type BootstrapState = "checking" | "available" | "closed" | "error";

export default function RegisterPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function checkBootstrap() {
      try {
        const neon = createNeonBrowserClient();
        const { data, error: statusError } = await neon.rpc("is_admin_configured", {});
        if (statusError) throw new Error("No se pudo comprobar el primer acceso.");
        if (!cancelled) setBootstrap(data === true ? "closed" : data === false ? "available" : "error");
      } catch {
        if (!cancelled) setBootstrap("error");
      }
    }
    void checkBootstrap();
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrap !== "available") return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
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
        setError(signUpError?.message || "No se pudo crear la cuenta inicial. Comprueba el correo e inténtalo otra vez.");
        return;
      }
      setBootstrap("closed");
      setMessage("Cuenta de identidad creada. Todavía no tienes acceso a los datos de la plataforma. Comparte con el administrador supremo el correo usado para asignar el único rol administrador.");
    } catch {
      setError("No se pudo crear la cuenta inicial. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">VM</span>
          <div><p className="font-semibold">Vida y Ministerio</p><p className="text-sm text-slate-500">Configuración inicial</p></div>
        </div>
        {bootstrap === "checking" && <div><h1 className="text-2xl font-bold">Verificando configuración</h1><p className="mt-2 text-sm text-slate-600">Comprobando si el administrador supremo ya está configurado.</p></div>}
        {bootstrap === "error" && <div><h1 className="text-2xl font-bold">No se pudo verificar</h1><p className="mt-2 text-sm text-slate-600">Por seguridad, no se habilitará el registro mientras no pueda comprobarse el estado.</p></div>}
        {bootstrap === "closed" && !message && <div><h1 className="text-2xl font-bold">Registro cerrado</h1><p className="mt-2 text-sm text-slate-600">La plataforma ya tiene su administrador supremo. Solo él puede crear o habilitar cuentas. Solicita acceso al administrador.</p></div>}
        {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {bootstrap === "available" && <div><h1 className="text-2xl font-bold tracking-tight">Crear cuenta inicial</h1><p className="mt-2 text-sm text-slate-600">Este registro solo estará abierto hasta que se configure el administrador supremo. Esta cuenta no obtiene permisos automáticamente.</p>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium">Nombre completo<input name="name" required autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="block text-sm font-medium">Correo electrónico<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="block text-sm font-medium">Contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="block text-sm font-medium">Confirmar contraseña<input name="confirmation" type="password" required minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50" type="submit">{busy ? "Creando cuenta…" : "Crear cuenta inicial"}</button>
          </form>
        </div>}
        <p className="text-sm text-slate-600"><a className="font-semibold text-blue-700 underline" href="/">Volver al inicio de sesión</a></p>
      </section>
    </main>
  );
}
