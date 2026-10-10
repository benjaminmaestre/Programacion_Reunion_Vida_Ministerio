"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle, CircleOff, KeyRound, LockKeyhole, ShieldCheck, UserPlus, Users } from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { getCurrentAppUser, MembershipRequiredError } from "@/features/members/members-repository";
import { PasswordChangeDialog } from "@/features/auth/PasswordChangeDialog";

type AccessState = "loading" | "login" | "forbidden" | "ready" | "error";
type AdminUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: "administrator" | "user";
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [access, setAccess] = useState<AccessState>("loading");
  const [client, setClient] = useState<ReturnType<typeof createNeonBrowserClient> | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const loadUsers = useCallback(async (neon: ReturnType<typeof createNeonBrowserClient>) => {
    const { data, error: listError } = await neon.rpc("admin_list_app_users", {});
    if (listError) throw new Error("No se pudo cargar el listado de cuentas.");
    setUsers((data ?? []) as AdminUser[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const neon = createNeonBrowserClient();
        const { data, error: sessionError } = await neon.auth.getSession();
        if (sessionError) throw new Error("No se pudo verificar tu sesión.");
        const user = data.session?.user;
        if (!user) {
          if (!cancelled) setAccess("login");
          return;
        }

        const appUser = await getCurrentAppUser(neon, user.id);
        if (appUser.role !== "administrator") {
          if (!cancelled) setAccess("forbidden");
          return;
        }
        await loadUsers(neon);
        if (!cancelled) {
          setClient(neon);
          setAccess("ready");
        }
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof MembershipRequiredError) setAccess("forbidden");
        else {
          setError(caught instanceof Error ? caught.message : "No se pudo abrir la administración.");
          setAccess("error");
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedName || !normalizedEmail || password.length < 8) {
        throw new Error("Completa el nombre, un correo válido y una contraseña inicial de al menos 8 caracteres.");
      }

      const response = await fetch("/api/auth/admin/create-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = responseBody?.message ?? responseBody?.error?.message ?? responseBody?.error;
        throw new Error(typeof detail === "string" ? detail : "Neon Auth rechazó la creación de la cuenta. Verifica tus permisos y el correo.");
      }

      const createdUser = responseBody?.user ?? responseBody?.data?.user ?? responseBody?.data ?? responseBody;
      const newUserId = createdUser?.id;
      if (typeof newUserId !== "string" || !newUserId) {
        throw new Error("Neon creó una respuesta sin un identificador de cuenta válido. Revisa Neon Auth antes de repetir la operación.");
      }

      const { error: insertError } = await client.from("app_users").insert({
        user_id: newUserId,
        display_name: normalizedName,
        role: "user",
        is_active: true,
      });
      if (insertError) {
        throw new Error("La cuenta de autenticación existe, pero no se pudo habilitar en la plataforma. No repitas la creación: contacta al administrador para completar la asociación.");
      }

      setName("");
      setEmail("");
      setPassword("");
      setNotice(`Cuenta creada y habilitada para ${normalizedEmail}. Se asignó el rol Usuario; no tiene permisos para crear otras cuentas.`);
      await loadUsers(client);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAccess(user: AdminUser) {
    if (!client || user.role !== "user" || changingId) return;
    setChangingId(user.user_id);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await client.from("app_users")
        .update({ is_active: !user.is_active })
        .eq("user_id", user.user_id);
      if (updateError) throw new Error("No se pudo cambiar el acceso de esa cuenta.");
      await loadUsers(client);
      setNotice(user.is_active ? `Se deshabilitó el acceso de ${user.email ?? user.display_name ?? "la cuenta"}.` : `Se habilitó el acceso de ${user.email ?? user.display_name ?? "la cuenta"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar el acceso.");
    } finally {
      setChangingId("");
    }
  }

  if (access === "loading") {
    return <main className="workspace"><p style={{ color: "var(--color-text-muted)" }}>Verificando permisos administrativos…</p></main>;
  }
  if (access === "login") {
    return (
      <main className="gate-page">
        <section className="gate-panel">
          <div className="gate-icon"><LockKeyhole size={22} /></div>
          <h1 className="gate-title">Inicia sesión</h1>
          <p className="gate-description">Solo el administrador puede crear o habilitar cuentas.</p>
          <a className="button button-primary" style={{ textDecoration: "none", width: "100%", justifyContent: "center" }} href="/">Volver al inicio de sesión</a>
        </section>
      </main>
    );
  }
  if (access === "forbidden") {
    return (
      <main className="workspace">
        <div className="mx-auto max-w-xl space-y-6">
          <header className="page-head" style={{ marginBottom: 24 }}>
            <div>
              <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" style={{ marginBottom: 12 }}>
                <ArrowLeft size={16} /> Volver a la aplicación
              </a>
              <p className="eyebrow" style={{ marginTop: 8 }}>Gestión de cuenta</p>
              <h1>Mi Perfil</h1>
              <p>Aquí puedes gestionar la seguridad de tu cuenta de acceso a la plataforma.</p>
            </div>
          </header>

          <section className="panel" style={{ padding: 24 }}>
            <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 14, marginBottom: 20 }}>
              <h2 className="panel-title" style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={18} /> Seguridad y Credenciales
              </h2>
              <p className="panel-subtitle">Solo el Administrador del sistema puede gestionar o crear cuentas de otros usuarios.</p>
            </div>
            {client && (
              <button type="button" className="button button-primary" onClick={() => setIsPasswordDialogOpen(true)} style={{ width: "100%", justifyContent: "center" }}>
                <KeyRound size={16} /> Cambiar mi contraseña
              </button>
            )}
          </section>
        </div>
        {isPasswordDialogOpen && client && (
          <PasswordChangeDialog
            client={client}
            onClose={() => setIsPasswordDialogOpen(false)}
          />
        )}
      </main>
    );
  }
  if (access === "error") {
    return (
      <main className="gate-page">
        <section className="gate-panel">
          <h1 className="gate-title">No se pudo abrir la administración</h1>
          <p role="alert" className="inline-alert" style={{ marginTop: 12 }}>{error}</p>
          <a className="button button-primary" style={{ textDecoration: "none", width: "100%", justifyContent: "center", marginTop: 16 }} href="/">Volver</a>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="page-head" style={{ marginBottom: 24 }}>
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" style={{ marginBottom: 12 }}>
              <ArrowLeft size={16} /> Volver a la aplicación
            </a>
            <p className="eyebrow" style={{ marginTop: 8 }}>Administración exclusiva</p>
            <h1>Cuentas de acceso</h1>
            <p>Aquí se crean las cuentas que pueden iniciar sesión. Los usuarios normales pueden gestionar participantes y programaciones, pero no pueden dar acceso a otras personas.</p>
          </div>
          <div className="head-actions">
            {client && <button type="button" className="button" onClick={() => setIsPasswordDialogOpen(true)}>
              <KeyRound size={15} /> Cambiar contraseña
            </button>}
            <span className="status-pill" style={{ padding: "8px 12px", fontSize: 12 }}>
              <Users size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              <strong>{users.length}</strong> cuentas registradas
            </span>
          </div>
        </header>

        <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 14, marginBottom: 20 }}>
            <h2 className="panel-title" style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={18} /> Crear usuario
            </h2>
            <p className="panel-subtitle">Se creará una cuenta en Neon Auth y se asignará el rol <strong>Usuario</strong>. La contraseña inicial debe comunicarse por un canal seguro.</p>
          </div>
          <form onSubmit={createUser} className="form-grid" style={{ padding: 0 }}>
            <div className="form-field">
              <label className="field-label" htmlFor="user-name">Nombre completo</label>
              <input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="field" />
            </div>
            <div className="form-field">
              <label className="field-label" htmlFor="user-email">Correo electrónico</label>
              <input id="user-email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" autoComplete="email" className="field" />
            </div>
            <div className="form-field full">
              <label className="field-label" htmlFor="user-password">Contraseña inicial (mínimo 8 caracteres)</label>
              <input id="user-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} type="password" autoComplete="new-password" className="field" />
            </div>
            {error && <div className="form-field full"><p role="alert" className="inline-alert">{error}</p></div>}
            {notice && <div className="form-field full"><p role="status" className="alert-ok">{notice}</p></div>}
            <div className="form-field full" style={{ marginTop: 8 }}>
              <button type="submit" disabled={busy} className="button button-primary">
                <UserPlus size={16} />{busy ? "Creando cuenta…" : "Crear cuenta de usuario"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" style={{ fontSize: 16 }}>Usuarios de la plataforma</h2>
              <p className="panel-subtitle">Deshabilitar una cuenta revoca el acceso a los datos de la aplicación aunque la persona conserve sus credenciales de autenticación.</p>
            </div>
          </div>
          {users.length === 0 ? (
            <div className="empty-state">Todavía no hay cuentas autorizadas.</div>
          ) : (
            <div className="member-list" style={{ padding: 16 }}>
              {users.map((user) => (
                <article key={user.user_id} className="member-row" style={{ justifyContent: "space-between", padding: 16 }}>
                  <div className="member-main">
                    <p className="member-name">{user.display_name || user.email || "Usuario"}</p>
                    <p className="member-meta" style={{ marginTop: 2 }}>{user.email || user.user_id}</p>
                    <p className="member-meta" style={{ marginTop: 4 }}>
                      {user.role === "administrator" ? "Administrador" : "Usuario"} · creado {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(user.created_at))}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className={user.is_active ? "status-pill" : "demo-pill"}>
                      {user.is_active ? <CheckCircle size={13} /> : <CircleOff size={13} />}
                      {user.is_active ? "Activo" : "Deshabilitado"}
                    </span>
                    {user.role === "user" && (
                      <button type="button" disabled={changingId === user.user_id || Boolean(changingId)} onClick={() => void toggleAccess(user)} className="button">
                        {changingId === user.user_id ? "Guardando…" : user.is_active ? "Deshabilitar" : "Habilitar"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {isPasswordDialogOpen && client && (
        <PasswordChangeDialog
          client={client}
          onClose={() => setIsPasswordDialogOpen(false)}
        />
      )}
    </main>
  );
}
