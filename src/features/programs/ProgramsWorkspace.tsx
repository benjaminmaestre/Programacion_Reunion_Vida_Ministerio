"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, Download, LockKeyhole, Plus, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { isNeonConfigured } from "@/lib/neon/env";
import { getCurrentAppUser, listMembers, MembershipRequiredError } from "../members/members-repository";
import type { DirectoryMember } from "../members/demo-data";
import { DEMO_MEMBERS } from "../members/demo-data";
import { DEMO_PROGRAMS } from "./programs-demo-data";
import type { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";
import { getMeetingProgramsFromNeon, saveMeetingProgramToNeon } from "./programs-repository";
import { validateProgramForPublication } from "./program-validation";
import { buildDefaultMeetingProgram } from "./program-builder";
import type { WeekType } from "@/types/domain";

type WorkspaceMode = "loading" | "demo" | "login" | "connected" | "membership" | "error";
type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;
const PAIRED_ASSIGNMENTS = new Set(["conversation", "revisit", "disciples", "explain_beliefs"]);

function verifyProgramRoundTrip(expected: MeetingProgramDetail, actual: MeetingProgramDetail | undefined) {
  if (!actual) throw new Error("Neon no devolvió la reunión después de guardarla.");
  if (actual.meetingDate !== expected.meetingDate || actual.weekType !== expected.weekType) {
    throw new Error("La reunión recuperada no coincide con la fecha o el tipo de semana.");
  }
  if (!actual.bimonthCycle || !actual.historyPeriod) {
    throw new Error("La reunión se guardó sin recuperar sus relaciones de ciclo bimestral y período semestral.");
  }
  if ((expected.bimonthCycle && actual.bimonthCycle !== expected.bimonthCycle)
    || (expected.historyPeriod && actual.historyPeriod !== expected.historyPeriod)) {
    throw new Error("La reunión recuperada no coincide con los ciclos o períodos solicitados.");
  }
  if (actual.slots.length !== expected.slots.length) {
    throw new Error("La reunión se recuperó con una cantidad de intervenciones diferente.");
  }
  for (const expectedSlot of expected.slots) {
    const actualSlot = actual.slots.find((slot) => slot.id === expectedSlot.id);
    if (!actualSlot
      || actualSlot.title !== expectedSlot.title
      || actualSlot.assignmentType !== expectedSlot.assignmentType
      || (actualSlot.primaryParticipantId ?? "") !== (expectedSlot.primaryParticipantId ?? "")
      || (actualSlot.assistantParticipantId ?? "") !== (expectedSlot.assistantParticipantId ?? "")) {
      throw new Error("La reunión recuperada contiene una intervención distinta a la enviada a Neon.");
    }
  }
  if ((actual.status === "published") !== (expected.status === "published")) {
    throw new Error("El estado recuperado no coincide con el estado solicitado.");
  }
}

export const ProgramsWorkspace: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [client, setClient] = useState<NeonBrowserClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canConfirmEligibility, setCanConfirmEligibility] = useState(false);
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

  // Modal para crear un programa nuevo
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newWeekType, setNewWeekType] = useState<WeekType>("normal");

  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;

  async function loadConnectedData(neon: NeonBrowserClient, activeUserId: string) {
    const [appUser, directory, savedPrograms] = await Promise.all([
      getCurrentAppUser(neon, activeUserId),
      listMembers(neon, activeUserId),
      getMeetingProgramsFromNeon(neon),
    ]);
    setUserId(activeUserId);
    setCanManage(["administrator", "elder", "coordinator"].includes(appUser.role));
    setCanConfirmEligibility(["administrator", "elder"].includes(appUser.role));
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
      if (!isNeonConfigured()) {
        if (process.env.NODE_ENV === "production") {
          if (!cancelled) {
            setPageError("Neon no está configurado. La demostración está deshabilitada en producción.");
            setMode("error");
          }
        } else if (!cancelled) {
          setPrograms(DEMO_PROGRAMS);
          setMembers(DEMO_MEMBERS);
          setSelectedProgramId(DEMO_PROGRAMS[0]?.id ?? null);
          setCanManage(true);
          setCanConfirmEligibility(true);
          setMode("demo");
        }
        return;
      }

      try {
        const neon = createNeonBrowserClient();
        if (cancelled) return;
        setClient(neon);
        const { data, error } = await neon.auth.getUser();
        if (error) throw new Error("No se pudo verificar la sesión.");
        if (!data.user) {
          setMode("login");
          return;
        }
        await loadConnectedData(neon, data.user.id);
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
      ...(resetReview ? {
        leadershipReviewConfirmed: false,
        leadershipReviewConfirmedBy: undefined,
        leadershipReviewConfirmedAt: undefined,
      } : {}),
      updatedAt: new Date().toISOString(),
      slots: selectedProgram.slots.map((slot) => slot.id === slotId
        ? { ...slot, ...changes, ...(resetReview ? { eligibilityConfirmed: false, eligibilityConfirmedBy: undefined, eligibilityConfirmedAt: undefined } : {}) }
        : slot),
    };
    updateProgram(updatedProgram);
    setFeedback("");
    setPageError("");
  }

  function handleRemoveSlot(slotId: string) {
    if (!selectedProgram || (mode === "connected" && selectedProgram.status === "published")) return;
    const slot = selectedProgram.slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (!confirm(`¿Deseas retirar la intervención "${slot.title}" de este borrador?`)) return;

    const updatedProgram: MeetingProgramDetail = {
      ...selectedProgram,
      updatedAt: new Date().toISOString(),
      slots: selectedProgram.slots.filter((s) => s.id !== slotId),
    };
    updateProgram(updatedProgram);
    setFeedback(`Intervención "${slot.title}" retirada del borrador.`);
  }

  async function handleCreateNewProgram(event: React.FormEvent) {
    event.preventDefault();
    if (!newMeetingDate || saving) return;
    setPageError("");
    setFeedback("");

    if (programs.some((p) => p.meetingDate === newMeetingDate)) {
      setPageError(`Ya existe un programa registrado para la fecha ${newMeetingDate}.`);
      return;
    }

    const newProgram = buildDefaultMeetingProgram(newMeetingDate, newWeekType);

    if (mode === "connected" && client && userId) {
      if (!canManage) {
        setPageError("Tu rol no permite crear programas.");
        return;
      }
      setSaving(true);
      try {
        await saveMeetingProgramToNeon(client, userId, newProgram);
        const freshPrograms = await getMeetingProgramsFromNeon(client);
        verifyProgramRoundTrip(newProgram, freshPrograms.find((program) => program.id === newProgram.id));
        setPrograms(freshPrograms);
        setSelectedProgramId(newProgram.id);
        setIsNewProgramModalOpen(false);
        setNewMeetingDate("");
        setFeedback(`Nuevo programa borrador creado y guardado en Neon para el ${newMeetingDate}.`);
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "No se pudo crear la reunión en Neon.");
      } finally {
        setSaving(false);
      }
    } else {
      setPrograms((current) => [newProgram, ...current]);
      setSelectedProgramId(newProgram.id);
      setIsNewProgramModalOpen(false);
      setNewMeetingDate("");
      setFeedback(`Nuevo programa borrador creado en memoria para el ${newMeetingDate}.`);
    }
  }

  async function handleSave(status: "draft" | "published") {
    if (!selectedProgram || saving) return;
    setPageError("");
    setFeedback("");

    if (mode === "demo") {
      if (status === "published") {
        setPageError("El modo demo no permite publicar programas. Conecta Neon y usa una cuenta autorizada.");
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
      await saveMeetingProgramToNeon(client, userId, nextProgram);
      const freshPrograms = await getMeetingProgramsFromNeon(client);
      verifyProgramRoundTrip(nextProgram, freshPrograms.find((program) => program.id === nextProgram.id));
      setPrograms(freshPrograms);
      setSelectedProgramId(nextProgram.id);
      setFeedback(status === "published" ? "Programa publicado y recuperado de Neon." : "Borrador guardado y verificado en Neon.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo guardar el programa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateS140() {
    if (!selectedProgram || generating || mode !== "connected" || !client || !userId) {
      setPageError("La generación del S-140 requiere una sesión conectada a Neon.");
      return;
    }
    setGenerating(true);
    setPageError("");
    setFeedback("");
    try {
      if (selectedProgram.status === "draft" && canManage) {
        await saveMeetingProgramToNeon(client, userId, selectedProgram);
      }
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("La sesión de Neon ha expirado. Inicia sesión de nuevo.");
      }
      const response = await fetch(`/api/programs/${encodeURIComponent(selectedProgram.id)}/s140`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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
      setFeedback("Documento S-140 generado desde los datos guardados en Neon.");
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

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Calendar className="h-7 w-7 text-blue-600" />Programación Vida y Ministerio</h1>
          <p className="mt-1 text-sm text-slate-500">Títulos editables, participantes, revisión S-38-S y guardado verificado.</p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setIsNewProgramModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              type="button"
            >
              <Plus className="h-4 w-4" /> Crear programa
            </button>
          )}
          <span className={mode === "demo" ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"}>
            {mode === "demo" ? "DEMO · SOLO MEMORIA" : "CONECTADO A SUPABASE"}
          </span>
        </div>
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

          {!selectedProgram ? (
            <div className="rounded-xl border p-8 text-center text-slate-500 space-y-3">
              <p>No hay reuniones para mostrar.</p>
              {canManage && (
                <button
                  onClick={() => setIsNewProgramModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  type="button"
                >
                  <Plus className="h-4 w-4" /> Crear primera reunión
                </button>
              )}
            </div>
          ) : (
            <>
              {readOnly && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{selectedProgram.status === "published" ? "Programa publicado: vista de solo lectura para proteger el historial." : "Tu rol tiene permisos de consulta. El programa está en modo de solo lectura."}</div>}
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
                <label className="text-sm">Presidente de la reunión
                  <select value={selectedProgram.chairmanId ?? ""} disabled={!!readOnly} onChange={(event) => { updateProgram({ ...selectedProgram, chairmanId: event.target.value || undefined, leadershipReviewConfirmed: false, leadershipReviewConfirmedBy: undefined, leadershipReviewConfirmedAt: undefined, updatedAt: new Date().toISOString() }); setFeedback(""); }} className="mt-1 w-full rounded-lg border bg-white p-2 disabled:bg-slate-100">
                    <option value="">Seleccionar presidente…</option>
                    {members.filter((member) => member.isActive).map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.appointment === "elder" ? "Anciano" : member.appointment === "ministerial_servant" ? "Siervo ministerial" : "Publicador"}</option>)}
                  </select>
                </label>
                <label className="text-sm">Consejero auxiliar (opcional)
                  <select value={selectedProgram.auxiliaryCounselorId ?? ""} disabled={!!readOnly} onChange={(event) => { updateProgram({ ...selectedProgram, auxiliaryCounselorId: event.target.value || undefined, leadershipReviewConfirmed: false, leadershipReviewConfirmedBy: undefined, leadershipReviewConfirmedAt: undefined, updatedAt: new Date().toISOString() }); setFeedback(""); }} className="mt-1 w-full rounded-lg border bg-white p-2 disabled:bg-slate-100">
                    <option value="">Sin consejero auxiliar</option>
                    {members.filter((member) => member.isActive && member.appointment === "elder").map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
                  </select>
                </label>
                {selectedProgram.weekType === "circuit_overseer" && (
                  <label className="text-sm md:col-span-2">Título real del discurso del Superintendente de Circuito
                    <input
                      value={selectedProgram.circuitOverseerTalkTitle ?? ""}
                      disabled={!!readOnly}
                      onChange={(event) => {
                        updateProgram({
                          ...selectedProgram,
                          circuitOverseerTalkTitle: event.target.value,
                          leadershipReviewConfirmed: false,
                          leadershipReviewConfirmedBy: undefined,
                          leadershipReviewConfirmedAt: undefined,
                          updatedAt: new Date().toISOString(),
                        });
                        setFeedback("");
                      }}
                      placeholder="Escribe el título asignado del discurso de servicio"
                      className="mt-1 w-full rounded-lg border bg-white p-2 disabled:bg-slate-100"
                    />
                  </label>
                )}
                <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm md:col-span-2">
                  <input type="checkbox" checked={selectedProgram.leadershipReviewConfirmed === true} disabled={!!readOnly || (mode === "connected" && !canConfirmEligibility)} onChange={(event) => { updateProgram({ ...selectedProgram, leadershipReviewConfirmed: event.target.checked, leadershipReviewConfirmedBy: event.target.checked ? userId ?? undefined : undefined, leadershipReviewConfirmedAt: event.target.checked ? selectedProgram.leadershipReviewConfirmedAt : undefined, updatedAt: new Date().toISOString() }); setFeedback(""); }} className="mt-1" />
                  <span><strong>Presidencia y Consejería revisadas</strong><span className="block text-xs text-slate-600">Solo un anciano o administrador debe confirmar la elegibilidad antes de publicar. Cambiar el presidente o consejero invalida esta revisión.</span></span>
                </label>
              </div>
              <div className="overflow-hidden rounded-xl border divide-y">
                {selectedProgram.slots.map((slot) => (
                  <article key={slot.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{slot.durationMinutes} min</span>
                      <input aria-label={`Título de ${slot.orderIndex}`} value={slot.title} disabled={!!readOnly} onChange={(event) => updateSlot(slot.id, { title: event.target.value }, true)} className="min-w-0 flex-1 rounded-lg border p-2 font-semibold disabled:bg-slate-100" />
                      <span className="text-xs text-slate-500">{slot.assignmentType ?? "Tipo sin definir"}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Retirar intervención de este borrador"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
                      <input type="checkbox" checked={slot.eligibilityConfirmed === true} disabled={!!readOnly || (mode === "connected" && !canConfirmEligibility)} onChange={(event) => updateSlot(slot.id, { eligibilityConfirmed: event.target.checked, eligibilityConfirmedBy: event.target.checked ? userId ?? undefined : undefined })} className="mt-1" />
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

      {/* Modal Crear Programa */}
      {isNewProgramModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">Crear nueva reunión</h2>
              <button type="button" onClick={() => setIsNewProgramModalOpen(false)} className="rounded p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProgram} className="space-y-4">
              <label className="block text-sm font-medium">
                Fecha de la reunión *
                <input
                  type="date"
                  required
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2 text-sm"
                />
              </label>

              <label className="block text-sm font-medium">
                Tipo de semana
                <select
                  value={newWeekType}
                  onChange={(e) => setNewWeekType(e.target.value as WeekType)}
                  className="mt-1 w-full rounded-lg border p-2 text-sm bg-white"
                >
                  <option value="normal">Normal (Reunión ordinaria)</option>
                  <option value="circuit_overseer">Visita del Superintendente de Circuito</option>
                  <option value="assembly">Asamblea de Circuito / Regional</option>
                  <option value="memorial">Conmemoración</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewProgramModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Crear programa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
