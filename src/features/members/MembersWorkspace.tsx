"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle, Archive, ArrowDownUp, Check, ChevronRight,
  CircleHelp, Clock3, History, ListChecks,
  LockKeyhole, LogOut, Plus, Search, ShieldCheck,
  Users, X,
} from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { isNeonConfigured } from "@/lib/neon/env";
import {
  createMember, getMemberHistory, listMembers, MembershipRequiredError, updateMember,
} from "./members-repository";
import {
  CATEGORY_LABELS, CATEGORY_OPTIONS, DEMO_HISTORY, DEMO_MEMBERS,
} from "./demo-data";
import type {
  AssignmentHistoryEntry, DirectoryMember, HistoryCategory,
  MemberAppointment, MemberGender,
} from "./demo-data";
const LEGACY_STORAGE_KEY = "s140-directory-demo-v1";
type ActiveFilter = "active" | "all" | "inactive";
type CategoryFilter = "all" | HistoryCategory;
type WorkspaceMode = "loading" | "demo" | "login" | "connected" | "membership" | "error";
type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;

function fullName(member: DirectoryMember) {
  return `${member.firstName} ${member.lastName}`.trim();
}
function initials(member: DirectoryMember) {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toLocaleUpperCase("es");
}
function appointmentLabel(appointment: MemberAppointment) {
  if (appointment === "elder") return "Anciano";
  if (appointment === "ministerial_servant") return "Siervo ministerial";
  return "Publicador(a)";
}
function baptismLabel(isBaptized: boolean | null) {
  if (isBaptized === true) return "Bautizado/a";
  if (isBaptized === false) return "No bautizado/a";
  return "Desconocido / Pendiente";
}
function formatDate(value?: string) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
function sortLatest(entries: AssignmentHistoryEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function MembersWorkspace() {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [client, setClient] = useState<NeonBrowserClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [historyCategory, setHistoryCategory] = useState<CategoryFilter>("all");
  const [historyEntries, setHistoryEntries] = useState<AssignmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      // Elimina la clave heredada: versiones anteriores pudieron guardar aquí nombres reales.
      // La demostración actual solo vive en memoria y no persiste datos personales en el navegador.
      try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* almacenamiento bloqueado */ }

      if (!isNeonConfigured()) {
        if (cancelled) return;
        if (process.env.NODE_ENV === "production") {
          setPageError("La conexión con Neon no está configurada. No se habilitará el modo de demostración en producción.");
          setMode("error");
        } else {
          setMembers(DEMO_MEMBERS);
          setSelectedMemberId(DEMO_MEMBERS.find((member) => member.isActive)?.id ?? DEMO_MEMBERS[0]?.id ?? "");
          setMode("demo");
        }
        setIsReady(true);
        return;
      }

      try {
        const neon = createNeonBrowserClient();
        if (cancelled) return;
        setClient(neon);
        const { data, error } = await neon.auth.getSession();
        if (error) throw new Error("No se pudo verificar la sesión. Vuelve a iniciar sesión.");
        const user = data.session?.user;
        if (!user) {
          if (!cancelled) setMode("login");
          return;
        }
        const result = await listMembers(neon, user.id);
        if (cancelled) return;
        setUserId(user.id);
        setMembers(result.members);
        setSelectedMemberId(result.members.find((member) => member.isActive)?.id ?? result.members[0]?.id ?? "");
        setMode("connected");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof MembershipRequiredError) {
          setMode("membership");
        } else {
          setPageError(error instanceof Error ? error.message : "No se pudo conectar con Neon.");
          setMode("error");
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, []);

  const activeMembers = members.filter((member) => member.isActive);
  const selectedMember = members.find((member) => member.id === selectedMemberId)
    ?? activeMembers[0] ?? members[0];

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return members.filter((member) => {
      if (activeFilter === "active" && !member.isActive) return false;
      if (activeFilter === "inactive" && member.isActive) return false;
      if (!query) return true;
      return [member.firstName, member.lastName, fullName(member), appointmentLabel(member.appointment), member.additionalRoles ?? ""]
        .some((value) => value.toLocaleLowerCase("es").includes(query));
    }).sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  }, [members, search, activeFilter]);

  useEffect(() => {
    if (!selectedMember || mode === "loading" || mode === "login" || mode === "membership" || mode === "error") {
      setHistoryEntries([]);
      return;
    }

    if (mode === "demo") {
      setHistoryEntries(sortLatest(DEMO_HISTORY.filter((item) => item.memberId === selectedMember.id)));
      setHistoryError("");
      setHistoryLoading(false);
      return;
    }

    if (mode !== "connected" || !client || !userId) return;

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");
    void getMemberHistory(client, userId, selectedMember.id)
      .then((entries) => { if (!cancelled) setHistoryEntries(entries); })
      .catch((error) => {
        if (cancelled) return;
        setHistoryEntries([]);
        setHistoryError(error instanceof Error ? error.message : "No se pudo cargar el historial.");
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });

    return () => { cancelled = true; };
  }, [selectedMember?.id, mode, client, userId]);

  const allSelectedHistory = useMemo(() => sortLatest(historyEntries), [historyEntries]);
  const memberHistory = useMemo(
    () => historyCategory === "all" ? allSelectedHistory : allSelectedHistory.filter((entry) => entry.category === historyCategory),
    [allSelectedHistory, historyCategory],
  );
  const latestOverall = allSelectedHistory[0];
  const latestInCategory = historyCategory === "all"
    ? latestOverall
    : allSelectedHistory.find((entry) => entry.category === historyCategory);

  const elderCount = activeMembers.filter((member) => member.appointment === "elder").length;
  const servantCount = activeMembers.filter((member) => member.appointment === "ministerial_servant").length;
  const pioneerCount = activeMembers.filter((member) => member.isRegularPioneer).length;
  const inactiveCount = members.length - activeMembers.length;

function openNewMemberForm() {
    setEditingMember(null);
    setFormError("");
    setIsFormOpen(true);
  }
  function openEditMemberForm(member: DirectoryMember) {
    setEditingMember(member);
    setFormError("");
    setIsFormOpen(true);
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    if (!firstName || !lastName) {
      setFormError("Nombre y apellido son obligatorios.");
      return;
    }

    const baptizedValue = form.get("isBaptized");
    const isBaptized = baptizedValue === "true" ? true : baptizedValue === "false" ? false : null;

    const input = {
      firstName,
      lastName,
      gender: (form.get("gender") === "female" ? "female" : "male") as MemberGender,
      appointment: (form.get("appointment") as MemberAppointment) || "none",
      isRegularPioneer: form.has("isRegularPioneer"),
      additionalRoles: String(form.get("additionalRoles") ?? "").trim() || undefined,
      isActive: form.has("isActive"),
      isBaptized,
      phone: String(form.get("phone") ?? "").trim() || undefined,
      email: String(form.get("email") ?? "").trim() || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined,
    };

    setIsSaving(true);
    setFormError("");
    try {
      let saved: DirectoryMember;
      if (mode === "connected" && client && userId) {
        saved = editingMember
          ? await updateMember(client, userId, editingMember.id, input)
          : await createMember(client, userId, input);
      } else if (mode === "demo") {
        saved = { ...input, id: editingMember?.id ?? `local-${crypto.randomUUID()}` };
      } else {
        setFormError("No hay una conexión válida para guardar cambios.");
        return;
      }

      setMembers((current) => editingMember
        ? current.map((item) => item.id === editingMember.id ? saved : item)
        : [saved, ...current]);
      setSelectedMemberId(saved.id);
      setHistoryCategory("all");
      setIsFormOpen(false);
      setEditingMember(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setIsSigningIn(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setLoginError("No se pudo iniciar sesión. Comprueba el correo y la contraseña.");
        return;
      }
      const result = await listMembers(client, data.user.id);
      setUserId(data.user.id);
      setMembers(result.members);
      setSelectedMemberId(result.members.find((member) => member.isActive)?.id ?? result.members[0]?.id ?? "");
      setMode("connected");
    } catch (error) {
      if (error instanceof MembershipRequiredError) {
        setUserId(null);
        setMode("membership");
      } else {
        setLoginError(error instanceof Error ? error.message : "No se pudo conectar con la base de datos.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    setUserId(null);
    setMembers([]);
    setSelectedMemberId("");
    setHistoryEntries([]);
    setMode("login");
  }

  if (mode === "loading" || !isReady) {
    return <GatePage title="Preparando el directorio" description="Verificando configuración y acceso." icon={<Users size={22} />} />;
  }
  if (mode === "login") {
    return <LoginGate onSubmit={handleSignIn} loading={isSigningIn} error={loginError} />;
  }
  if (mode === "membership") {
    return <GatePage
      title="Falta configurar tu acceso"
      description="Tu cuenta inició sesión, pero no tiene acceso asignado a esta plataforma. Solo el administrador supremo puede crear o habilitar cuentas."
      icon={<LockKeyhole size={22} />}
      action={client ? <button className="button" onClick={() => void client.auth.signOut().then(() => setMode("login"))} type="button"><LogOut size={15} /> Cerrar sesión</button> : undefined}
    />;
  }
  if (mode === "error") {
    return <GatePage title="No se pudo abrir el directorio" description={pageError || "Verifica la configuración y vuelve a intentarlo."} icon={<AlertTriangle size={22} />} action={<button className="button" onClick={() => window.location.reload()} type="button">Volver a intentar</button>} />;
  }

  const demoMode = mode === "demo";

  return (
    <div className="workspace-wrap">
      <div className="main-area">
        <div className="workspace">
          <div className="page-heading">
            <div><p className="eyebrow">Administración de personas</p><h1 className="page-title">Directorio de la congregación</h1><p className="page-description">Consulta a los hermanos y hermanas, mantén los datos actualizados y revisa las participaciones antes de preparar una asignación.</p></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={demoMode ? "demo-pill" : "status-pill"}><span className="demo-dot" /> {demoMode ? "MODO DEMOSTRACIÓN" : "CONECTADO A NEON"}</span>
              {!demoMode && <button className="button" type="button" onClick={() => void signOut()}><LogOut size={14} /> Salir</button>}
              <button className="button button-primary" onClick={openNewMemberForm} type="button"><Plus size={16} /> Nuevo hermano/a</button>
            </div>
          </div>

          {demoMode ? (
            <div className="demo-banner" role="note"><AlertTriangle size={17} /><div><strong>Entorno de demostración: nombres ficticios</strong><p>Los nombres son ficticios. Los cambios de esta sesión son temporales y no se guardan en el navegador. La importación oficial permanecerá deshabilitada hasta contar con un flujo administrativo seguro.</p></div></div>
          ) : (
            <div className="connected-banner" role="status"><ShieldCheck size={17} /><div><strong>Sesión autenticada</strong><p>Las operaciones se ejecutan con tu sesión de Neon. La base de datos aplica las políticas de acceso y el rol que te fue asignado.</p></div></div>
          )}

          {pageError && <div className="inline-alert" role="alert"><AlertTriangle size={15} />{pageError}<button type="button" className="icon-button" onClick={() => setPageError("")} aria-label="Cerrar aviso"><X size={14} /></button></div>}

          <section className="stats-grid" aria-label="Resumen del directorio">
            <StatCard icon={<Users size={16} />} label="Personas registradas" value={members.length} caption="Incluye activos e inactivos" />
            <StatCard icon={<Check size={16} />} label="Registros activos" value={activeMembers.length} caption="Disponibles para consulta" />
            <StatCard icon={<ShieldCheck size={16} />} label="Ancianos / SM" value={elderCount + servantCount} caption={`${elderCount} ancianos · ${servantCount} siervos ministeriales`} />
            <StatCard icon={<Archive size={16} />} label="Precursores / Inactivos" value={pioneerCount} caption={`${pioneerCount} precursores · ${inactiveCount} inactivos`} />
          </section>

          <section className="workspace-grid" id="directorio">
            <div className="panel">
              <div className="panel-header"><div><h2 className="panel-title">Personas</h2><p className="panel-subtitle">Selecciona un registro para consultar su historial.</p></div><span className="panel-count">{filteredMembers.length} resultados</span></div>
              <div className="panel-content">
                <div className="search-row">
                  <label className="search-field"><Search size={16} aria-hidden="true" /><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, nombramiento o rol..." aria-label="Buscar personas" /></label>
                  <button className="button" type="button" onClick={() => { setSearch(""); setActiveFilter("active"); }} title="Restablecer búsqueda y filtros"><ArrowDownUp size={14} /> Limpiar</button>
                </div>
                <div className="filter-row" role="group" aria-label="Filtrar por estado">
                  <button type="button" className={`filter-chip ${activeFilter === "active" ? "active" : ""}`} onClick={() => setActiveFilter("active")}>Activos</button>
                  <button type="button" className={`filter-chip ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>Todos</button>
                  <button type="button" className={`filter-chip ${activeFilter === "inactive" ? "active" : ""}`} onClick={() => setActiveFilter("inactive")}>Inactivos</button>
                </div>
                <div className="member-list">
                  {filteredMembers.length === 0 ? <div className="empty-state"><strong>No hay resultados</strong>Prueba con otro nombre o cambia el filtro.</div> : filteredMembers.map((member) => (
                    <button className={`member-row ${selectedMember?.id === member.id ? "selected" : ""}`} type="button" key={member.id} onClick={() => setSelectedMemberId(member.id)} aria-pressed={selectedMember?.id === member.id}>
                      <span className={`member-avatar ${member.gender === "female" ? "female" : ""}`}>{initials(member)}</span>
                      <span className="member-main">
                        <span className="member-name">
                          {fullName(member)}
                          {member.isRegularPioneer && <span className="status-pill" style={{ marginLeft: 6, fontSize: "0.7em" }}>PR</span>}
                          {member.additionalRoles && <span className="demo-pill" style={{ marginLeft: 6, fontSize: "0.7em" }}>{member.additionalRoles}</span>}
                        </span>
                        <span className="member-meta">
                          <span>{appointmentLabel(member.appointment)}</span>
                          <span>·</span>
                          <span>{baptismLabel(member.isBaptized)}</span>
                        </span>
                      </span>
                      <span className={`member-status ${member.isActive ? "" : "inactive"}`}>{member.isActive ? "Activo" : "Inactivo"}</span>
                      <ChevronRight size={15} className="member-row-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel" aria-label="Historial contextual del participante">
              <div className="panel-header"><div><h2 className="panel-title">Historial de asignaciones</h2><p className="panel-subtitle">Consulta previa a la planificación de una intervención.</p></div><span className={demoMode ? "demo-pill" : "status-pill"}><span className="demo-dot" />{demoMode ? "Historial demo" : "Historial real"}</span></div>
              <div className="panel-content">
                <div className="history-select-block">
                  <label className="field-label" htmlFor="history-member">Seleccionar hermano/a</label>
                  <select id="history-member" className="select-field" value={selectedMember?.id ?? ""} onChange={(event) => setSelectedMemberId(event.target.value)}>
                    {members.filter((member) => member.isActive).sort((a, b) => fullName(a).localeCompare(fullName(b), "es")).map((member) => <option key={member.id} value={member.id}>{fullName(member)}</option>)}
                    {selectedMember && !selectedMember.isActive && <option value={selectedMember.id}>{fullName(selectedMember)} (inactivo)</option>}
                  </select>
                </div>
                {selectedMember ? (
                  <>
                    <div className="history-person">
                      <span className={`member-avatar ${selectedMember.gender === "female" ? "female" : ""}`}>{initials(selectedMember)}</span>
                      <div className="history-person-meta">
                        <h3 className="history-name">{fullName(selectedMember)}</h3>
                        <p className="history-role">
                          {appointmentLabel(selectedMember.appointment)}
                          {selectedMember.isRegularPioneer ? " · Precursor(a) regular" : ""}
                          {selectedMember.additionalRoles ? ` · ${selectedMember.additionalRoles}` : ""}
                          {` · ${baptismLabel(selectedMember.isBaptized)}`}
                        </p>
                      </div>
                      <button type="button" className="button" onClick={() => openEditMemberForm(selectedMember)}>Editar</button>
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><Clock3 size={14} /> Última asignación registrada</h3>
                      {historyLoading ? <div className="empty-state">Consultando la base de datos…</div> : latestOverall ? (
                        <div className="latest-card"><span className="latest-label">Participación más reciente · cualquier categoría</span><p className="latest-title">{latestOverall.assignment}</p><span className="latest-date">{formatDate(latestOverall.date)}</span><div className="latest-details"><div className="latest-detail"><span>Función</span><strong>{latestOverall.participation}</strong></div><div className="latest-detail"><span>Categoría</span><strong>{CATEGORY_LABELS[latestOverall.category]}</strong></div><div className="latest-detail"><span>{latestOverall.participation === "Ayudante" ? "Titular / compañero" : "Ayudante / compañero"}</span><strong>{latestOverall.companionName ?? "No registrado"}</strong></div></div></div>
                      ) : <div className="empty-state"><strong>Sin historial disponible</strong>Cuando la persona tenga participaciones registradas, aparecerán aquí.</div>}
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><ListChecks size={14} /> Revisar por categoría</h3>
                      <label className="field-label" htmlFor="history-category" style={{ marginBottom: 6 }}>Tipo de asignación que estás preparando</label>
                      <select id="history-category" className="select-field" value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value as CategoryFilter)}>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><History size={14} />{historyCategory === "all" ? " Participaciones recientes" : ` Historial: ${CATEGORY_LABELS[historyCategory]}`}</h3>
                      {historyError && <div className="inline-alert" role="alert"><AlertTriangle size={14} />{historyError}</div>}
                      {historyCategory !== "all" && latestInCategory && <div className="latest-card" style={{ marginBottom: 12 }}><span className="latest-label">Última de esta categoría</span><p className="latest-title">{latestInCategory.assignment}</p><span className="latest-date">{formatDate(latestInCategory.date)}</span><div className="latest-details"><div className="latest-detail"><span>Función</span><strong>{latestInCategory.participation}</strong></div><div className="latest-detail"><span>Ayudante / compañero</span><strong>{latestInCategory.companionName ?? "No registrado"}</strong></div></div></div>}
                      {historyLoading ? <div className="empty-state">Actualizando historial…</div> : memberHistory.length ? <div className="history-list">{memberHistory.slice(0, 5).map((entry) => <div className="history-entry" key={entry.id}><div className="timeline-track"><span className="timeline-dot" /></div><div><p className="history-entry-title">{entry.assignment}</p><p className="history-entry-detail">{entry.participation}{entry.companionName ? ` · ${entry.companionName}` : ""}</p><span className="history-entry-date">{formatDate(entry.date)}</span></div></div>)}</div> : <div className="empty-state"><strong>No hay registros para esta categoría</strong>{demoMode ? "No hay participaciones de ejemplo asociadas a esta categoría." : "No se encontraron participaciones en el período semestral activo."}</div>}
                    </div>
                    <div className="helper-note"><CircleHelp size={15} /><span>{demoMode ? "Los nombres e historiales son ficticios. No corresponden a datos reales." : "El historial real se consulta en la base de datos y se limita al período semestral operativo activo."}</span></div>
                  </>
                ) : <div className="empty-state"><strong>Selecciona una persona</strong>El historial contextual aparecerá aquí.</div>}
              </div>
            </div>
          </section>
          <footer className="screen-footer"><span>Gestión de asignaciones · Directorio</span><span>{demoMode ? "Memoria temporal de demostración" : "PostgreSQL protegido por RLS"}</span></footer>
      </div>
    </div>

      {/* Modal de Formulario de Persona */}
      {isFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
          <div className="modal-header"><div><h2 className="modal-title" id="member-form-title">{editingMember ? "Editar registro" : "Nuevo hermano/a"}</h2><p className="modal-description">Completa los datos del directorio. Los campos marcados son obligatorios.</p></div><button type="button" className="icon-button" onClick={() => setIsFormOpen(false)} aria-label="Cerrar formulario"><X size={17} /></button></div>
          <form onSubmit={saveMember}>
            <div className="form-grid">
              <div className="form-field"><label className="field-label" htmlFor="firstName">Nombre *</label><input id="firstName" className="field" name="firstName" required maxLength={100} defaultValue={editingMember?.firstName ?? ""} autoFocus /></div>
              <div className="form-field"><label className="field-label" htmlFor="lastName">Apellido *</label><input id="lastName" className="field" name="lastName" required maxLength={100} defaultValue={editingMember?.lastName ?? ""} /></div>
              <div className="form-field"><label className="field-label" htmlFor="gender">Sexo</label><select id="gender" className="select-field" name="gender" defaultValue={editingMember?.gender ?? "male"}><option value="male">Varón</option><option value="female">Mujer</option></select></div>
              <div className="form-field"><label className="field-label" htmlFor="appointment">Nombramiento</label><select id="appointment" className="select-field" name="appointment" defaultValue={editingMember?.appointment ?? "none"}><option value="none">No aplica / Publicador</option><option value="ministerial_servant">Siervo ministerial</option><option value="elder">Anciano</option></select></div>
              <div className="form-field"><label className="field-label" htmlFor="additionalRoles">Responsabilidades adicionales (p.ej. Secretario)</label><input id="additionalRoles" className="field" name="additionalRoles" maxLength={100} defaultValue={editingMember?.additionalRoles ?? ""} placeholder="Ej. Secretario, auxiliar de territorio" /></div>
              <div className="form-field"><label className="field-label" htmlFor="isBaptized">Estado de bautismo</label><select id="isBaptized" className="select-field" name="isBaptized" defaultValue={editingMember?.isBaptized === true ? "true" : editingMember?.isBaptized === false ? "false" : "unknown"}><option value="unknown">Desconocido / Pendiente de confirmar</option><option value="true">Bautizado/a</option><option value="false">No bautizado/a</option></select></div>
              <div className="form-field"><label className="field-label" htmlFor="phone">Teléfono (opcional)</label><input id="phone" className="field" name="phone" type="tel" maxLength={30} defaultValue={editingMember?.phone ?? ""} /></div>
              <div className="form-field"><label className="field-label" htmlFor="email">Correo (opcional)</label><input id="email" className="field" name="email" type="email" maxLength={150} defaultValue={editingMember?.email ?? ""} /></div>
              <div className="form-field full"><label className="field-label" htmlFor="notes">Notas administrativas (opcional)</label><textarea id="notes" className="field" name="notes" maxLength={500} rows={2} defaultValue={editingMember?.notes ?? ""} /></div>
              <div className="form-field full">
                <label className="check-row"><input type="checkbox" name="isRegularPioneer" defaultChecked={editingMember?.isRegularPioneer ?? false} /> Precursor(a) regular</label>
                <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={editingMember?.isActive ?? true} /> Registro activo (disponible para asignaciones)</label>
              </div>
              <div className="form-field full"><p className="small-note">Las autorizaciones y competencias para asignaciones se validan automáticamente con el motor S-38-S.</p></div>
              {formError && <div className="form-field full"><div className="inline-alert" role="alert"><AlertTriangle size={15} />{formError}</div></div>}
            </div>
            <div className="modal-footer"><button type="button" className="button" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancelar</button><button type="submit" className="button button-primary" disabled={isSaving}><Check size={15} />{isSaving ? "Guardando…" : editingMember ? "Guardar cambios" : "Añadir al directorio"}</button></div>
          </form>
        </section>
      </div>}


    </div>
  );
}

function StatCard({ icon, label, value, caption }: { icon: ReactNode; label: string; value: number; caption: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-caption">{caption}</span></article>;
}

function GatePage({ title, description, icon, action }: { title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return <main className="gate-page"><section className="gate-panel"><div className="gate-brand"><span className="brand-mark">VM</span><span>Vida y Ministerio</span></div><div className="gate-icon">{icon}</div><h1 className="gate-title">{title}</h1><p className="gate-description">{description}</p>{action && <div className="gate-actions">{action}</div>}<p className="gate-footnote">Sistema de gestión de asignaciones · Acceso restringido</p></section></main>;
}

function LoginGate({ onSubmit, loading, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; error: string }) {
  return <main className="gate-page"><section className="gate-panel">
    <div className="gate-brand"><span className="brand-mark">VM</span><span>Vida y Ministerio</span></div>
    <div className="gate-icon"><LockKeyhole size={22} /></div>
    <h1 className="gate-title">Iniciar sesión</h1>
    <p className="gate-description">Accede con tu cuenta autorizada para consultar y administrar el directorio de la congregación.</p>
    <form className="gate-form" onSubmit={onSubmit}>
      <div className="form-field"><label className="field-label" htmlFor="login-email">Correo electrónico</label><input id="login-email" className="field" name="email" type="email" autoComplete="username" required /></div>
      <div className="form-field"><label className="field-label" htmlFor="login-password">Contraseña</label><input id="login-password" className="field" name="password" type="password" autoComplete="current-password" required /></div>
      {error && <div className="inline-alert" role="alert"><AlertTriangle size={15} />{error}</div>}
      <button className="button button-primary gate-submit" disabled={loading} type="submit"><LockKeyhole size={15} />{loading ? "Verificando…" : "Entrar"}</button>
    </form>
    <p className="gate-footnote">¿Primer acceso? <a className="font-semibold text-blue-700 underline" href="/auth/register">Configurar cuenta inicial</a>. Después, solo el administrador supremo podrá crear cuentas.</p>
  </section></main>;
}
