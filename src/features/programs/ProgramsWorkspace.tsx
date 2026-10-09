"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, Download, LockKeyhole, Save, ShieldAlert } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentAppUser, listMembers, MembershipRequiredError } from "../members/members-repository";
import type { DirectoryMember } from "../members/demo-data";
import { DEMO_MEMBERS } from "../members/demo-data";
import { DEMO_PROGRAMS } from "./programs-demo-data";
import type { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";
import { getMeetingProgramsFromSupabase, saveMeetingProgramToSupabase } from "./programs-repository";
import { validateProgramForPublication } from "./program-validation";

type WorkspaceMode = "loading" | "demo" | "login" | "connected" | "membership" | "error";
type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
const PAIRED_ASSIGNMENTS = new Set(["conversation", "revisit", "disciples", "explain_beliefs"]);

export const ProgramsWorkspace: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [client, setClient] = useState<SupabaseBrowserClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [programs, setPrograms] = useState<MeetingProgramDetail[]>([]);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bimonthly" | "editor">("editor");
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;

  async function loadConnectedData(supabase: SupabaseBrowserClient, activeUserId: string) {
    const [appUser, directory, savedPrograms] = await Promise.all([
      getCurrentAppUser(supabase, activeUserId),
      listMembers(supabase, activeUserId),
      getMeetingProgramsFromSupabase(supabase),
    ]);
    setUserId(activeUserId);
    setCanManage(["administrator", "elder", "coordinator"].includes(appUser.role));
    setMembers(directory.members);
    setPrograms(savedPrograms);
    setSelectedProgramId((current) => savedPrograms.some((program) => program.id === current)
      ? current
      : savedPrograms[0]?.id ?? null);
    setMode("connected");
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      // La demostración solo existe en desarrollo; nunca se presenta como persistencia real.
      if (!isSupabaseConfigured()) {
        if (process.env.NODE_ENV === "production") {
          if (!cancelled) {
            setPageError("Supabase no está configurado. La demostración está deshabilitada en producción.");
            setMode("error");
          }
        } else if (!cancelled) {
          setPrograms(DEMO_PROGRAMS);
          setMembers(DEMO_MEMBERS);
          setSelectedProgramId(DEMO_PROGRAMS[0]?.id ?? null);
          setCanManage(true);
          setMode("demo");
        }
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        if (cancelled) return;
        setClient(supabase);
        const { data, error } = await supabase.auth.getUser();
        if (error) throw new Error("No se pudo verificar la sesión.");
        if (!data.user) {
          setMode("login");
          return;
        }
        await loadConnectedData(supabase, data.user.id);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof MembershipRequiredError) setMode("membership");
        else {
          setPageError(error instanceof Error ? error.message : "No se pudieron cargar los programas.");
          setMode("error");
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  function updateProgram(nextProgram: MeetingProgramDetail) {
    setPrograms((current) => current.map((program) => program.id === nextProgram.id ? nextProgram : program));
  }

  function updateSlot(slotId: string, changes: Partial<AssignmentSlotDetail>, resetReview = false) {
    if (!selectedProgram || (mode === "connected" && selectedProgram.status === "published")) return;
    const updatedProgram: MeetingProgramDetail = {
      ...selectedProgram,
      updatedAt: new Date().toISOString(),
      slots: selectedProgram.slots.map((slot) => slot.id === slotId
        ? { ...slot, ...changes, ...(resetReview ? { eligibilityConfirmed: false, eligibilityConfirmedBy: undefined } : {}) }
        : slot),
    };
    updateProgram(updatedProgram);
    setFeedback("");
    setPageError("");
  }

  async function handleSave(status: "draft" | "published") {
    if (!selectedProgram) return;
    setPageError("");
    setFeedback("");

    if (mode === "demo") {
      if (status === "published") {
        setPageError("El modo demo no permite publicar programas. Conecta Supabase y usa una cuenta autorizada.");
        return;
      }
      updateProgram({ ...selectedProgram, status: "draft", updatedAt: new Date().toISOString() });
      setFeedback("Cambio temporal en modo demo. No se guardó en una base de datos.");
      return;
    }

    if (mode !== "connected" || !client || !userId) {
      setPageError("No hay una sesión válida. Inicia sesión para guardar cambios.");
      return;
    }
    if (!canManage) {
      setPageError("Tu rol permite consultar, pero no modificar ni publicar programas.");
      return;
    }
    if (selectedProgram.status === "published") {
      setPageError("Este programa está publicado y es de solo lectura para proteger el historial.");
      return;
    }

    if (status === "published") {
      const validation = validateProgramForPublication(selectedProgram, members);
      if (!validation.isValid) {
        setPageError("No se puede publicar. Corrige estos puntos:\n• " + validation.errors.slice(0, 8).join("\n• "));
        return;
      }
    }

    setSaving(true);
    try {
      const nextProgram = { ...selectedProgram, status, updatedAt: new Date().toISOString() };
      await saveMeetingProgramToSupabase(client, userId, nextProgram);
      const freshPrograms = await getMeetingProgramsFromSupabase(client);
      setPrograms(freshPrograms);
      setSelectedProgramId(nextProgram.id);
      setFeedback(status === "published" ? "Programa publicado y recuperado de Supabase." : "Borrador guardado y verificado en Supabase.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo guardar el programa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateS140() {
    if (!selectedProgram || mode !== "connected" || !client || !userId) {
      setPageError("La generación del S-140 requiere una sesión conectada a Supabase.");
      return;
    }
    setGenerating(true);
    setPageError("");
    setFeedback("");
    try {
      // Si el borrador es editable, guardar primero para que el documento use los títulos actuales.
      if (selectedProgram.status === "draft" && canManage) {
        await saveMeetingProgramToSupabase(client, userId, selectedProgram);
      }
      const response = await fetch(`/api/programs/${encodeURIComponent(selectedProgram.id)}/s140`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "No se pudo generar el S-140.");
      }
      const file = await response.blob();
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `S-140-${selectedProgram.meetingDate}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setFeedback("Documento S-140 generado desde los datos guardados en Supabase.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo generar el S-140.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setSigningIn(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      if (error || !data.user) {
        setLoginError("No se pudo iniciar sesión. Comprueba tus credenciales.");
        return;
      }
      await loadConnectedData(client, data.user.id);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo cargar la sesión.");
    } finally {
      setSigningIn(false);
    }
  }

  if (mode === "loading") return <main className="p-8"><p>Cargando programas…</p></main>;
  if (mode === "login") return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSignIn} className="w-full max-w-md space-y-4 rounded-xl border p-6 shadow-sm">
        <LockKeyhole className="h-8 w-8" />
        <h1 className="text-xl font-bold">Iniciar sesión</h1>
        <p className="text-sm text-slate-600">Accede con una cuenta autorizada para consultar y editar los programas reales.</p>
        <label className="block text-sm">Correo<input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded border p-2" /></label>
        <label className="block text-sm">Contraseña<input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border p-2" /></label>
        {loginError && <p role="alert" className="text-sm text-red-700">{loginError}</p>}
        <button disabled={signingIn} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{signingIn ? "Ingresando…" : "Entrar"}</button>
      </form>
    </main>
  );
  if (mode === "membership") return <main className="p-8"><h1 className="text-xl font-bold">Acceso no configurado</h1><p>Solicita al administrador una membresía activa para esta aplicación.</p></main>;
  if (mode === "error") return <main className="p-8"><h1 className="text-xl font-bold">No se pudieron cargar los programas</h1><p role="alert" className="mt-3 text-red-700">{pageError}</p></main>;

  const readOnly = mode === "connected" && (selectedProgram?.status === "published" || !canManage);
  const cycleLabels = [...new Set(programs.map((program) => program.bimonthCycle))];
  const selectedCycle = selectedProgram?.bimonthCycle ?? cycleLabels[0];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Calendar className="h-7 w-7 text-blue-600" />Programación Vida y Ministerio</h1>
          <p className="mt-1 text-sm text-slate-500">Títulos editables, participantes, revisión S-38-S y guardado verificado.</p>
        </div>
        <span className={mode === "demo" ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"}>
          {mode === "demo" ? "DEMO · SOLO MEMORIA" : "CONECTADO A SUPABASE"}
        </span>
      </header>

      {mode === "demo" && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
        Modo de desarrollo con datos ficticios. Los cambios son temporales; publicar y persistir en base de datos está deshabilitado.
      </div>}
      {pageError && <div role="alert" className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{pageError}</div>}
      {feedback && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{feedback}</div>}

      <nav className="flex gap-2" aria-label="Vistas de programación">
        <button onClick={() => setActiveTab("editor")} className={`rounded-lg px-4 py-2 text-sm ${activeTab === "editor" ? "bg-slate-900 text-white" : "border"}`}>Editor de programa</button>
        <button onClick={() => setActiveTab("bimonthly")} className={`rounded-lg px-4 py-2 text-sm ${activeTab === "bimonthly" ? "bg-slate-900 text-white" : "border"}`}>Resumen bimestral</button>
      </nav>

      {activeTab === "bimonthly" ? (
        <section className="rounded-xl border p-4">
          <h2 className="text-lg font-semibold">Resumen de ciclos</h2>
          {programs.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay programas en la base de datos todavía.</p> : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {cycleLabels.map((cycle) => {
                const items = programs.filter((program) => program.bimonthCycle === cycle);
                return <article key={cycle} className="rounded-lg border p-4">
                  <h3 className="font-semibold">{cycle}</h3>
                  <p className="mt-1 text-sm text-slate-600">{items.length} reuniones · {items.filter((item) => item.status === "published").length} publicadas · {items.filter((item) => item.status === "draft").length} borradores</p>
                </article>;
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium">Reunión
              <select value={selectedProgramId ?? ""} onChange={(event) => { setSelectedProgramId(event.target.value || null); setPageError(""); setFeedback(""); }} className="mt-1 w-full rounded-lg border bg-white p-2 text-slate-900">
                <option value="">Seleccionar reunión…</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.meetingDate} · {program.status === "published" ? "Publicada" : "Borrador"}</option>)}
              </select>
            </label>
            {selectedProgram && <div className="text-sm text-slate-500">Ciclo {selectedProgram.bimonthCycle} · {selectedProgram.weekType}</div>}
          </div>

          {!selectedProgram ? <div className="rounded-xl border p-8 text-center text-slate-500">No hay reuniones para mostrar. Crea los programas iniciales cuando esté definido el flujo de planificación.</div> : (
            <>
              {readOnly && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{selectedProgram.status === "published" ? "Programa publicado: vista de solo lectura para proteger el historial." : "Tu rol tiene permisos de consulta. El programa está en modo de solo lectura."}</div>}
              <div className="overflow-hidden rounded-xl border divide-y">
                {selectedProgram.slots.map((slot) => (
                  <article key={slot.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{slot.durationMinutes} min</span>
                      <input aria-label={`Título de ${slot.orderIndex}`} value={slot.title} disabled={!!readOnly} onChange={(event) => updateSlot(slot.id, { title: event.target.value }, true)} className="min-w-0 flex-1 rounded-lg border p-2 font-semibold disabled:bg-slate-100" />
                      <span className="text-xs text-slate-500">{slot.assignmentType ?? "Tipo sin definir"}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm">Titular
                        <select aria-label={`Titular de ${slot.title}`} value={slot.primaryParticipantId ?? ""} disabled={!!readOnly} onChange={(event) => updateSlot(slot.id, { primaryParticipantId: event.target.value || undefined }, true)} className="mt-1 w-full rounded-lg border bg-white p-2 disabled:bg-slate-100">
                          <option value="">Seleccionar titular…</option>
                          {members.filter((member) => member.isActive).map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
                        </select>
                      </label>
                      {(PAIRED_ASSIGNMENTS.has(slot.assignmentType ?? "") || slot.assistantParticipantId) && <label className="text-sm">Ayudante
                        <select aria-label={`Ayudante de ${slot.title}`} value={slot.assistantParticipantId ?? ""} disabled={!!readOnly} onChange={(event) => updateSlot(slot.id, { assistantParticipantId: event.target.value || undefined }, true)} className="mt-1 w-full rounded-lg border bg-white p-2 disabled:bg-slate-100">
                          <option value="">Seleccionar ayudante…</option>
                          {members.filter((member) => member.isActive).map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
                        </select>
                      </label>}
                    </div>
                    <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                      <input type="checkbox" checked={slot.eligibilityConfirmed === true} disabled={!!readOnly || (mode === "connected" && !canManage)} onChange={(event) => updateSlot(slot.id, { eligibilityConfirmed: event.target.checked, eligibilityConfirmedBy: event.target.checked ? userId ?? undefined : undefined })} className="mt-1" />
                      <span><strong>Revisión humana S-38-S confirmada</strong><span className="block text-xs text-slate-600">Marca solo después de verificar la elegibilidad y las condiciones de la asignación. Cambiar título o participantes invalida esta confirmación.</span></span>
                    </label>
                    {slot.eligibilityConfirmed && <p className="text-xs text-emerald-700"><CheckCircle className="mr-1 inline h-3.5 w-3.5" />Revisión marcada{slot.eligibilityConfirmedBy ? ` por ${slot.eligibilityConfirmedBy}` : " en la sesión demo"}.</p>}
                  </article>
                ))}
              </div>
              {selectedProgram.slots.length === 0 && <p className="rounded-xl border p-5 text-sm text-slate-500">Este programa no tiene intervenciones cargadas.</p>}

              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                {canManage && !readOnly && <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => void handleSave("draft")} disabled={saving || (mode !== "connected" && mode !== "demo")} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Guardando…" : "Guardar borrador"}</button>
                  <button type="button" onClick={() => void handleSave("published")} disabled={saving || mode !== "connected"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle className="h-4 w-4" />Validar y publicar</button>
                </div>}
                <button type="button" onClick={() => void handleGenerateS140()} disabled={generating || mode !== "connected"} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><Download className="h-4 w-4" />{generating ? "Generando S-140…" : "Generar S-140"}</button>
              </div>
              {!canManage && mode === "connected" && <p className="text-sm text-amber-700"><ShieldAlert className="mr-1 inline h-4 w-4" />Tu rol no permite editar ni publicar programas.</p>}
            </>
          )}
        </section>
      )}
    </main>
  );
};
