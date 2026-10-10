"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle, CircleOff, LockKeyhole, ShieldCheck, UserPlus, Users } from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { getCurrentAppUser, MembershipRequiredError } from "@/features/members/members-repository";

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

      // El endpoint administrativo de Neon Auth comprueba su rol admin del lado servidor.
      // No se permite que un registro público cree filas de acceso en public.app_users.
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
    return <main className="min-h-screen bg-slate-50 p-8 text-slate-700">Verificando permisos administrativos…</main>;
  }
  if (access === "login") {
    return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-6"><LockKeyhole className="mb-3 h-7 w-7 text-slate-600" /><h1 className="text-xl font-bold">Inicia sesión</h1><p className="mt-2 text-sm text-slate-600">Solo el administrador supremo puede crear o habilitar cuentas.</p><a className="mt-4 inline-block font-semibold text-blue-700 underline" href="/">Volver al inicio de sesión</a></section></main>;
  }
  if (access === "forbidden") {
    return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-6"><ShieldCheck className="mb-3 h-7 w-7 text-amber-600" /><h1 className="text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-600">La administración de cuentas está reservada al administrador supremo. Tu rol no permite crear usuarios ni conceder acceso a la plataforma.</p><a className="mt-4 inline-block font-semibold text-blue-700 underline" href="/">Volver a la aplicación</a></section></main>;
  }
  if (access === "error") {
    return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">No se pudo abrir la administración</h1><p role="alert" className="mt-2 text-sm text-red-700">{error}</p><a className="mt-4 inline-block font-semibold text-blue-700 underline" href="/">Volver</a></section></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Volver a la aplicación</a><p className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-700"><ShieldCheck className="h-4 w-4" /> Administración exclusiva</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Cuentas de acceso</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Aquí se crean las cuentas que pueden iniciar sesión. Los usuarios normales pueden gestionar participantes y programaciones, pero no pueden dar acceso a otras personas.</p></div>
          <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm"><Users className="h-5 w-5 text-slate-500" /><span><strong>{users.length}</strong> cuentas registradas</span></div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="h-5 w-5" /> Crear usuario</h2>
          <p className="mt-1 text-sm text-slate-600">Se creará una cuenta en Neon Auth y se asignará el rol <strong>Usuario</strong>. La contraseña inicial debe comunicarse por un canal seguro.</p>
          <form onSubmit={createUser} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">Nombre completo<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="block text-sm font-medium">Correo electrónico<input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            <label className="block text-sm font-medium md:col-span-2">Contraseña inicial (mínimo 8 caracteres)<input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 md:col-span-2">{notice}</p>}
            <div className="md:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />{busy ? "Creando cuenta…" : "Crear cuenta de usuario"}</button></div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Usuarios de la plataforma</h2><p className="mt-1 text-sm text-slate-600">Deshabilitar una cuenta revoca el acceso a los datos de la aplicación aunque la persona conserve sus credenciales de autenticación.</p></div>
          {users.length === 0 ? <p className="p-5 text-sm text-slate-500">Todavía no hay cuentas autorizadas.</p> : <div className="divide-y">{users.map((user) => <article key={user.user_id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0"><p className="truncate font-semibold">{user.display_name || user.email || "Usuario"}</p><p className="mt-0.5 break-all text-sm text-slate-600">{user.email || user.user_id}</p><p className="mt-1 text-xs text-slate-500">{user.role === "administrator" ? "Administrador supremo" : "Usuario"} · creado {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(user.created_at))}</p></div>
            <div className="flex items-center gap-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? <CheckCircle className="h-3.5 w-3.5" /> : <CircleOff className="h-3.5 w-3.5" />}{user.is_active ? "Activo" : "Deshabilitado"}</span>{user.role === "user" && <button type="button" disabled={changingId === user.user_id || Boolean(changingId)} onClick={() => void toggleAccess(user)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">{changingId === user.user_id ? "Guardando…" : user.is_active ? "Deshabilitar" : "Habilitar"}</button>}</div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}
