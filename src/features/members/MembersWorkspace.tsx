"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle, Archive, ArrowDownUp, Award, Check, ChevronRight,
  CircleHelp, Clock3, History, ListChecks,
  KeyRound, LockKeyhole, Plus, Search, ShieldCheck,
  Users, X,
} from "lucide-react";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { PasswordChangeDialog } from "@/features/auth/PasswordChangeDialog";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { getActiveMeetingGuide } from "@/features/programs/meeting-guide-repository";
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
type DirectoryCardFilter = "all_active" | "elder" | "ministerial_servant" | "pioneer" | "inactive";
type CategoryFilter = "all" | HistoryCategory;
type WorkspaceMode = "loading" | "demo" | "login" | "connected" | "guide_required" | "membership" | "error";
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

type SignOutHandler = () => Promise<void>;

export function MembersWorkspace({
  onRegisterSignOut,
}: {
  onRegisterSignOut: (handler: SignOutHandler | null) => void;
}) {
  const signOutActionRef = useRef<SignOutHandler | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [client, setClient] = useState<NeonBrowserClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<DirectoryCardFilter>("all_active");
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
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
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
          setPageError("No se pudo establecer la conexión con el servicio. Inténtalo de nuevo más tarde.");
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

        // Gate directory queries until an official bimonthly EPUB has been accepted.
        const activeGuide = await getActiveMeetingGuide(neon);
        if (!activeGuide) {
          if (!cancelled) setMode("guide_required");
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
          setPageError("No se pudo cargar el directorio. Inténtalo de nuevo.");
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

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return members.filter((member) => {
      // Direct Search
      if (query && ![member.firstName, member.lastName, fullName(member), appointmentLabel(member.appointment), member.additionalRoles ?? ""]
        .some((value) => value.toLocaleLowerCase("es").includes(query))) {
        return false;
      }

      // Card Filter
      if (cardFilter === "all_active") return member.isActive;
      if (cardFilter === "elder") return member.appointment === "elder";
      if (cardFilter === "ministerial_servant") return member.appointment === "ministerial_servant";
      if (cardFilter === "pioneer") return member.isRegularPioneer;
      if (cardFilter === "inactive") return !member.isActive;

      return true;
    }).sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  }, [members, search, cardFilter]);

  const selectedMember = members.find((member) => member.id === selectedMemberId)
    ?? filteredMembers[0] ?? activeMembers[0] ?? members[0];

  useEffect(() => {
    if (!selectedMember || mode === "loading" || mode === "login" || mode === "guide_required" || mode === "membership" || mode === "error") {
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

  const elderCount = members.filter((member) => member.appointment === "elder").length;
  const servantCount = members.filter((member) => member.appointment === "ministerial_servant").length;
  const pioneerCount = members.filter((member) => member.isRegularPioneer).length;
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
    const isBaptized = form.has("isBaptizedCheck") ? true : (baptizedValue === "true" ? true : baptizedValue === "false" ? false : null);
    const appointmentVal = String(form.get("appointment") || "none");
    const isRegularPioneer = appointmentVal === "pioneer" || form.has("isRegularPioneer");
    const appointment = (appointmentVal === "pioneer" ? "none" : appointmentVal) as MemberAppointment;
    const spiritualStatus = String(form.get("spiritualStatus") || "active") as "active" | "inactive" | "removed";
    const isActive = spiritualStatus === "active";

    const input = {
      firstName,
      lastName,
      gender: (form.get("gender") === "female" ? "female" : "male") as MemberGender,
      appointment,
      isRegularPioneer,
      isPublisher: form.has("isPublisher"),
      isSchoolEnrolled: form.has("isSchoolEnrolled"),
      spiritualStatus,
      additionalRoles: String(form.get("additionalRoles") ?? "").trim() || undefined,
      isActive,
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
        setLoginError("No se pudo completar el inicio de sesión. Verifica tus credenciales e inténtalo de nuevo.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
      setPageError("No se pudo cerrar sesión. Inténtalo de nuevo.");
      return;
    }
    setUserId(null);
    setMembers([]);
    setSelectedMemberId("");
    setHistoryEntries([]);
    setMode("login");
  }

  signOutActionRef.current = signOut;
  useEffect(() => {
    if (!client) {
      onRegisterSignOut(null);
      return;
    }
    const sidebarAction: SignOutHandler = async () => {
      await signOutActionRef.current?.();
    };
    onRegisterSignOut(sidebarAction);
    return () => onRegisterSignOut(null);
  }, [client, onRegisterSignOut]);

  if (mode === "loading" || !isReady) {
    return <GatePage title="Preparando el directorio" description="Verificando configuración y acceso." icon={<Users size={22} />} />;
  }
  if (mode === "login") {
    return (
      <LoginScreen
        onSubmit={handleSignIn}
        loading={isSigningIn}
        error={loginError}
        description="Accede con tu cuenta autorizada para consultar y administrar el directorio de la congregación."
      />
    );
  }
  if (mode === "guide_required") {
    return <GatePage
      title="Primero carga la guía bimestral"
      description="El directorio de participantes permanece bloqueado hasta que se cargue y valide la guía EPUB correspondiente a esos dos meses. Ve a Programas para cargar la guía oficial."
      icon={<AlertTriangle size={22} />}
    />;
  }
  if (mode === "membership") {
    return <GatePage
      title="Falta configurar tu acceso"
      description="Tu cuenta inició sesión, pero no tiene acceso asignado a esta plataforma. Solo el administrador supremo puede crear o habilitar cuentas."
      icon={<LockKeyhole size={22} />}
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
              {demoMode && <span className="demo-pill"><span className="demo-dot" /> MODO DEMOSTRACIÓN</span>}
              <button className="button button-primary" onClick={openNewMemberForm} type="button"><Plus size={16} /> Nuevo hermano/a</button>
            </div>
          </div>

          {demoMode && (
            <div className="demo-banner" role="note"><AlertTriangle size={17} /><div><strong>Entorno de demostración: nombres ficticios</strong><p>Los nombres son ficticios. Los cambios de esta sesión son temporales y no se guardan en el navegador. La importación oficial permanecerá deshabilitada hasta contar con un flujo administrativo seguro.</p></div></div>
          )}

          {pageError && <div className="inline-alert" role="alert"><AlertTriangle size={15} />{pageError}<button type="button" className="icon-button" onClick={() => setPageError("")} aria-label="Cerrar aviso"><X size={14} /></button></div>}

          <section className="stats-grid" aria-label="Resumen del directorio">
            <StatCard
              icon={<Check size={16} />}
              label="Registros activos"
              value={activeMembers.length}
              caption={`De un total de ${members.length} personas`}
              isSelected={cardFilter === "all_active"}
              onClick={() => setCardFilter("all_active")}
            />
            <StatCard
              icon={<ShieldCheck size={16} />}
              label="Ancianos"
              value={elderCount}
              caption={`${elderCount} ancianos habilitados`}
              isSelected={cardFilter === "elder"}
              onClick={() => setCardFilter((prev) => (prev === "elder" ? "all_active" : "elder"))}
            />
            <StatCard
              icon={<Users size={16} />}
              label="Siervos ministeriales"
              value={servantCount}
              caption={`${servantCount} siervos ministeriales`}
              isSelected={cardFilter === "ministerial_servant"}
              onClick={() => setCardFilter((prev) => (prev === "ministerial_servant" ? "all_active" : "ministerial_servant"))}
            />
            <StatCard
              icon={<Award size={16} />}
              label="Precursores"
              value={pioneerCount}
              caption={`${pioneerCount} precursores regulares`}
              isSelected={cardFilter === "pioneer"}
              onClick={() => setCardFilter((prev) => (prev === "pioneer" ? "all_active" : "pioneer"))}
            />
            <StatCard
              icon={<Archive size={16} />}
              label="Inactivos"
              value={inactiveCount}
              caption={`${inactiveCount} registros inactivos`}
              isSelected={cardFilter === "inactive"}
              onClick={() => setCardFilter((prev) => (prev === "inactive" ? "all_active" : "inactive"))}
            />
          </section>

          <section className="workspace-grid" id="directorio">
            <div className="panel">
              <div className="panel-header"><div><h2 className="panel-title">Personas</h2><p className="panel-subtitle">Selecciona una card o usa la búsqueda para filtrar los integrantes.</p></div><span className="panel-count">{filteredMembers.length} resultados</span></div>
              <div className="panel-content">
                <div className="search-row">
                  <label className="search-field"><Search size={16} aria-hidden="true" /><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, nombramiento o rol..." aria-label="Buscar personas" /></label>
                  <button className="button" type="button" onClick={() => { setSearch(""); setCardFilter("all_active"); }} title="Restablecer búsqueda y filtros"><ArrowDownUp size={14} /> Limpiar</button>
                </div>
                <div className="filter-row" role="group" aria-label="Filtrar por categoría">
                  <button type="button" className={`filter-chip ${cardFilter === "all_active" ? "active" : ""}`} onClick={() => setCardFilter("all_active")}>Activos</button>
                  <button type="button" className={`filter-chip ${cardFilter === "elder" ? "active" : ""}`} onClick={() => setCardFilter("elder")}>Ancianos</button>
                  <button type="button" className={`filter-chip ${cardFilter === "ministerial_servant" ? "active" : ""}`} onClick={() => setCardFilter("ministerial_servant")}>SM</button>
                  <button type="button" className={`filter-chip ${cardFilter === "pioneer" ? "active" : ""}`} onClick={() => setCardFilter("pioneer")}>Precursores</button>
                  <button type="button" className={`filter-chip ${cardFilter === "inactive" ? "active" : ""}`} onClick={() => setCardFilter("inactive")}>Inactivos</button>
                </div>
                <div className="member-list">
                  {filteredMembers.length === 0 ? <div className="empty-state"><strong>No hay resultados</strong>Prueba con otro nombre o cambia el filtro.</div> : filteredMembers.map((member) => (
                    <div className={`member-row ${selectedMember?.id === member.id ? "selected" : ""}`} key={member.id} style={{ display: "flex", alignItems: "center", width: "100%" }}>
                      <button type="button" onClick={() => setSelectedMemberId(member.id)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textAlign: "left", background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}>
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
                        <span className={`member-status ${member.isActive ? "" : "inactive"}`}>{member.spiritualStatus === "removed" ? "Sacado / Desasociado" : member.isActive ? "Activo" : "Inactivo"}</span>
                      </button>
                      <button type="button" className="button" style={{ marginLeft: 8, padding: "4px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); openEditMemberForm(member); }}>
                        Editar
                      </button>
                    </div>
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
                      {historyLoading ? <div className="empty-state">Consultando el historial…</div> : latestOverall ? (
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
                    <div className="helper-note"><CircleHelp size={15} /><span>{demoMode ? "Los nombres e historiales son ficticios. No corresponden a datos reales." : "El historial muestra los registros del período semestral operativo activo."}</span></div>
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
              <div className="form-field"><label className="field-label" htmlFor="appointment">Nombramiento</label><select id="appointment" className="select-field" name="appointment" defaultValue={editingMember?.isRegularPioneer ? "pioneer" : (editingMember?.appointment ?? "none")}><option value="none">Ninguno</option><option value="elder">Anciano</option><option value="ministerial_servant">Siervo ministerial</option><option value="pioneer">Precursor regular</option></select></div>
              <div className="form-field"><label className="field-label" htmlFor="spiritualStatus">Estado en la congregación</label><select id="spiritualStatus" className="select-field" name="spiritualStatus" defaultValue={editingMember?.spiritualStatus ?? (editingMember?.isActive === false ? "inactive" : "active")}><option value="active">Activo (Disponible para asignaciones)</option><option value="inactive">Inactivo</option><option value="removed">Sacado de la congregación / Desasociado</option></select></div>
              <div className="form-field"><label className="field-label" htmlFor="additionalRoles">Responsabilidades adicionales (p.ej. Secretario)</label><input id="additionalRoles" className="field" name="additionalRoles" maxLength={100} defaultValue={editingMember?.additionalRoles ?? ""} placeholder="Ej. Secretario, auxiliar de territorio" /></div>
              <div className="form-field"><label className="field-label" htmlFor="phone">Teléfono (opcional)</label><input id="phone" className="field" name="phone" type="tel" maxLength={30} defaultValue={editingMember?.phone ?? ""} /></div>
              <div className="form-field"><label className="field-label" htmlFor="email">Correo (opcional)</label><input id="email" className="field" name="email" type="email" maxLength={150} defaultValue={editingMember?.email ?? ""} /></div>
              <div className="form-field full"><label className="field-label" htmlFor="notes">Notas administrativas (opcional)</label><textarea id="notes" className="field" name="notes" maxLength={500} rows={2} defaultValue={editingMember?.notes ?? ""} /></div>
              <div className="form-field full" style={{ display: "grid", gap: 8 }}>
                <label className="check-row"><input type="checkbox" name="isBaptizedCheck" defaultChecked={editingMember?.isBaptized === true} /> Bautizado/a</label>
                <label className="check-row"><input type="checkbox" name="isPublisher" defaultChecked={editingMember?.isPublisher ?? true} /> Publicador/a</label>
                <label className="check-row"><input type="checkbox" name="isSchoolEnrolled" defaultChecked={editingMember?.isSchoolEnrolled ?? true} /> Matriculado/a en la reunión Vida y Ministerio Cristianos</label>
              </div>
              <div className="form-field full"><p className="small-note">Las autorizaciones y competencias para asignaciones se validan automáticamente con el motor S-38-S.</p></div>
              {formError && <div className="form-field full"><div className="inline-alert" role="alert"><AlertTriangle size={15} />{formError}</div></div>}
            </div>
            <div className="modal-footer"><button type="button" className="button" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancelar</button><button type="submit" className="button button-primary" disabled={isSaving}><Check size={15} />{isSaving ? "Guardando…" : editingMember ? "Guardar cambios" : "Añadir al directorio"}</button></div>
          </form>
        </section>
      </div>}


      {isPasswordDialogOpen && client && mode === "connected" && (
        <PasswordChangeDialog
          client={client}
          onClose={() => setIsPasswordDialogOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  caption,
  isSelected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  caption: string;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <article
      className={`stat-card ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
    >
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-caption">{caption}</span>
    </article>
  );
}

function GatePage({ title, description, icon, action }: { title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return <main className="gate-page"><section className="gate-panel"><div className="gate-brand"><span className="brand-mark">VM</span><span>Vida y Ministerio</span></div><div className="gate-icon">{icon}</div><h1 className="gate-title">{title}</h1><p className="gate-description">{description}</p>{action && <div className="gate-actions">{action}</div>}<p className="gate-footnote">Sistema de gestión de asignaciones · Acceso restringido</p></section></main>;
}


