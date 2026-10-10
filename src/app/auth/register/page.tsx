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
    <main className="gate-page">
      <section className="gate-panel">
        <div className="gate-brand">
          <span className="brand-mark">VM</span>
          <span>Vida y Ministerio</span>
        </div>

        {bootstrap === "checking" && (
          <div>
            <h1 className="gate-title">Verificando configuración</h1>
            <p className="gate-description">Comprobando si el administrador supremo ya está configurado.</p>
          </div>
        )}
        {bootstrap === "error" && (
          <div>
            <h1 className="gate-title">No se pudo verificar</h1>
            <p className="gate-description">Por seguridad, no se habilitará el registro mientras no pueda comprobarse el estado.</p>
          </div>
        )}
        {bootstrap === "closed" && !message && (
          <div>
            <h1 className="gate-title">Registro cerrado</h1>
            <p className="gate-description">La plataforma ya tiene su administrador supremo. Solo él puede crear o habilitar cuentas. Solicita acceso al administrador.</p>
          </div>
        )}
        {message && <p role="status" className="alert-ok">{message}</p>}
        {bootstrap === "available" && (
          <div>
            <h1 className="gate-title">Crear cuenta inicial</h1>
            <p className="gate-description">Este registro solo estará abierto hasta que se configure el administrador supremo. Esta cuenta no obtiene permisos automáticamente.</p>
            <form className="gate-form" onSubmit={submit}>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-name">Nombre completo</label>
                <input id="reg-name" name="name" required autoComplete="name" className="field" />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-email">Correo electrónico</label>
                <input id="reg-email" name="email" type="email" required autoComplete="email" className="field" />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-password">Contraseña</label>
                <input id="reg-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-confirm">Confirmar contraseña</label>
                <input id="reg-confirm" name="confirmation" type="password" required minLength={8} autoComplete="new-password" className="field" />
              </div>
              {error && <p role="alert" className="inline-alert">{error}</p>}
              <button disabled={busy} className="button button-primary gate-submit" type="submit">
                {busy ? "Creando cuenta…" : "Crear cuenta inicial"}
              </button>
            </form>
          </div>
        )}
        <p className="gate-footnote">
          <a className="button button-quiet" style={{ padding: 0, fontSize: 13, textDecoration: "underline" }} href="/">Volver al inicio de sesión</a>
        </p>
      </section>
    </main>
  );
}
