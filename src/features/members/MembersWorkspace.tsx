"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRound,
  X,
} from "lucide-react";
import {
  AssignmentHistoryEntry,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  DEMO_HISTORY,
  DEMO_MEMBERS,
  DirectoryMember,
  HistoryCategory,
  MemberAppointment,
  MemberGender,
} from "./demo-data";

const STORAGE_KEY = "s140-directory-demo-v1";
type ActiveFilter = "active" | "all" | "inactive";
type CategoryFilter = "all" | HistoryCategory;

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

function formatDate(value?: string) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function sortLatest(entries: AssignmentHistoryEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function MembersWorkspace() {
  const [members, setMembers] = useState<DirectoryMember[]>(DEMO_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(DEMO_MEMBERS[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [historyCategory, setHistoryCategory] = useState<CategoryFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMembers(parsed as DirectoryMember[]);
          const preferred = (parsed as DirectoryMember[]).find((member) => member.isActive);
          if (preferred) setSelectedMemberId(preferred.id);
        }
      }
    } catch {
      // Un archivo local corrupto no debe impedir que el directorio de demostración abra.
      setMembers(DEMO_MEMBERS);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch {
      // La aplicación sigue siendo utilizable; el aviso de modo demo explica el alcance del guardado.
    }
  }, [members, isReady]);

  const activeMembers = members.filter((member) => member.isActive);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? activeMembers[0] ?? members[0];

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return members
      .filter((member) => {
        if (activeFilter === "active" && !member.isActive) return false;
        if (activeFilter === "inactive" && member.isActive) return false;
        if (!query) return true;
        return [member.firstName, member.lastName, fullName(member), appointmentLabel(member.appointment)]
          .some((value) => value.toLocaleLowerCase("es").includes(query));
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  }, [members, search, activeFilter]);

  const memberHistory = useMemo(() => {
    if (!selectedMember) return [];
    const all = sortLatest(DEMO_HISTORY.filter((item) => item.memberId === selectedMember.id));
    return historyCategory === "all" ? all : all.filter((item) => item.category === historyCategory);
  }, [selectedMember, historyCategory]);

  const allSelectedHistory = useMemo(
    () => selectedMember ? sortLatest(DEMO_HISTORY.filter((item) => item.memberId === selectedMember.id)) : [],
    [selectedMember],
  );

  const latestOverall = allSelectedHistory[0];
  const latestInCategory = historyCategory === "all"
    ? latestOverall
    : allSelectedHistory.find((item) => item.category === historyCategory);

  const elderCount = activeMembers.filter((member) => member.appointment === "elder").length;
  const servantCount = activeMembers.filter((member) => member.appointment === "ministerial_servant").length;
  const inactiveCount = members.length - activeMembers.length;

  function openNewMemberForm() {
    setEditingMember(null);
    setIsFormOpen(true);
  }

  function openEditMemberForm(member: DirectoryMember) {
    setEditingMember(member);
    setIsFormOpen(true);
  }

  function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    if (!firstName || !lastName) return;

    const member: DirectoryMember = {
      id: editingMember?.id ?? `local-${crypto.randomUUID()}`,
      firstName,
      lastName,
      gender: (form.get("gender") === "female" ? "female" : "male") as MemberGender,
      appointment: (form.get("appointment") as MemberAppointment) || "none",
      isActive: form.has("isActive"),
      isBaptized: form.has("isBaptized"),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      email: String(form.get("email") ?? "").trim() || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined,
    };

    setMembers((current) => {
      if (editingMember) return current.map((item) => item.id === editingMember.id ? member : item);
      return [member, ...current];
    });
    setSelectedMemberId(member.id);
    setIsFormOpen(false);
    setEditingMember(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">VM</div>
          <div>
            <p className="brand-title">Vida y Ministerio</p>
            <span className="brand-subtitle">Gestión de asignaciones</span>
          </div>
        </div>

        <div>
          <p className="nav-label">Espacio de trabajo</p>
          <nav className="nav-list">
            <button className="nav-item" type="button" disabled title="Módulo pendiente de implementación">
              <LayoutDashboard size={17} /> Inicio <span className="nav-status">Próximo</span>
            </button>
            <button className="nav-item active" type="button" aria-current="page">
              <Users size={17} /> Directorio
            </button>
            <button className="nav-item" type="button" disabled title="Módulo pendiente de implementación">
              <CalendarDays size={17} /> Programas <span className="nav-status">Próximo</span>
            </button>
            <button className="nav-item" type="button" disabled title="Módulo pendiente de implementación">
              <History size={17} /> Historial <span className="nav-status">Próximo</span>
            </button>
            <button className="nav-item" type="button" disabled title="Módulo pendiente de implementación">
              <FileText size={17} /> Impresión <span className="nav-status">Próximo</span>
            </button>
          </nav>
        </div>

        <div>
          <p className="nav-label">Sistema</p>
          <div className="nav-list">
            <button className="nav-item" type="button" disabled title="Configuración pendiente">
              <SlidersHorizontal size={17} /> Configuración
            </button>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <strong><ShieldCheck size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 5 }} />Privacidad primero</strong>
            La versión conectada deberá limitar los datos según los permisos asignados.
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Gestión de la reunión <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px" }} /> <strong>Directorio</strong></div>
          <div className="topbar-actions">
            <span className="demo-pill"><span className="demo-dot" /> MODO DEMOSTRACIÓN</span>
            <div className="profile-avatar" title="Usuario de demostración">AD</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Administración de personas</p>
              <h1 className="page-title">Directorio de la congregación</h1>
              <p className="page-description">Consulta el registro de hermanos y hermanas, mantén sus datos actualizados y revisa las participaciones antes de preparar una asignación.</p>
            </div>
            <button className="button button-primary" onClick={openNewMemberForm} type="button">
              <Plus size={16} /> Nuevo hermano/a
            </button>
          </div>

          <div className="demo-banner" role="note">
            <AlertTriangle size={17} />
            <div>
              <strong>Entorno de demostración: datos ficticios</strong>
              <p>Los cambios de este prototipo se guardan únicamente en el almacenamiento local de este navegador. Aún no hay conexión activa con Supabase ni sincronización entre usuarios.</p>
            </div>
          </div>

          <section className="stats-grid" aria-label="Resumen del directorio">
            <StatCard icon={<Users size={16} />} label="Personas registradas" value={members.length} caption="Incluye registros activos e inactivos" />
            <StatCard icon={<Check size={16} />} label="Registros activos" value={activeMembers.length} caption="Disponibles para consulta" />
            <StatCard icon={<ShieldCheck size={16} />} label="Ancianos" value={elderCount} caption="Nombramiento registrado en el demo" />
            <StatCard icon={<Archive size={16} />} label="Inactivos" value={inactiveCount} caption={`${servantCount} siervos ministeriales activos`} />
          </section>

          <section className="workspace-grid" id="directorio">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Personas</h2>
                  <p className="panel-subtitle">Selecciona un registro para consultar su historial.</p>
                </div>
                <span className="panel-count">{filteredMembers.length} resultados</span>
              </div>
              <div className="panel-content">
                <div className="search-row">
                  <label className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o nombramiento..." aria-label="Buscar personas" />
                  </label>
                  <button className="button" type="button" onClick={() => { setSearch(""); setActiveFilter("active"); }} title="Restablecer búsqueda y filtros">
                    <ArrowDownUp size={14} /> Limpiar
                  </button>
                </div>

                <div className="filter-row" role="group" aria-label="Filtrar por estado">
                  <button type="button" className={`filter-chip ${activeFilter === "active" ? "active" : ""}`} onClick={() => setActiveFilter("active")}>Activos</button>
                  <button type="button" className={`filter-chip ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>Todos</button>
                  <button type="button" className={`filter-chip ${activeFilter === "inactive" ? "active" : ""}`} onClick={() => setActiveFilter("inactive")}>Inactivos</button>
                </div>

                <div className="member-list">
                  {filteredMembers.length === 0 ? (
                    <div className="empty-state"><strong>No hay resultados</strong>Prueba con otro nombre o cambia el filtro.</div>
                  ) : filteredMembers.map((member) => (
                    <button
                      className={`member-row ${selectedMember?.id === member.id ? "selected" : ""}`}
                      type="button"
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      aria-pressed={selectedMember?.id === member.id}
                    >
                      <span className={`member-avatar ${member.gender === "female" ? "female" : ""}`}>{initials(member)}</span>
                      <span className="member-main">
                        <span className="member-name">{fullName(member)}</span>
                        <span className="member-meta">
                          <span>{appointmentLabel(member.appointment)}</span>
                          <span>·</span>
                          <span>{member.isBaptized ? "Bautizado/a" : "No bautizado/a"}</span>
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
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Historial de asignaciones</h2>
                  <p className="panel-subtitle">Consulta previa a la planificación de una intervención.</p>
                </div>
                <span className="status-pill"><span className="demo-dot" /> Semestre actual · Demo</span>
              </div>
              <div className="panel-content">
                <div className="history-select-block">
                  <label className="field-label" htmlFor="history-member">Seleccionar hermano/a</label>
                  <select id="history-member" className="select-field" value={selectedMember?.id ?? ""} onChange={(event) => setSelectedMemberId(event.target.value)}>
                    {members.filter((member) => member.isActive).sort((a, b) => fullName(a).localeCompare(fullName(b), "es")).map((member) => (
                      <option key={member.id} value={member.id}>{fullName(member)}</option>
                    ))}
                    {selectedMember && !selectedMember.isActive && <option value={selectedMember.id}>{fullName(selectedMember)} (inactivo)</option>}
                  </select>
                </div>

                {selectedMember ? (
                  <>
                    <div className="history-person">
                      <span className={`member-avatar ${selectedMember.gender === "female" ? "female" : ""}`}>{initials(selectedMember)}</span>
                      <div className="history-person-meta">
                        <h3 className="history-name">{fullName(selectedMember)}</h3>
                        <p className="history-role">{appointmentLabel(selectedMember.appointment)} · {selectedMember.isActive ? "Registro activo" : "Registro inactivo"}</p>
                      </div>
                      <button type="button" className="button" onClick={() => openEditMemberForm(selectedMember)}>Editar</button>
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><Clock3 size={14} /> Última asignación registrada</h3>
                      {latestOverall ? (
                        <div className="latest-card">
                          <span className="latest-label">Participación más reciente · cualquier categoría</span>
                          <p className="latest-title">{latestOverall.assignment}</p>
                          <span className="latest-date">{formatDate(latestOverall.date)}</span>
                          <div className="latest-details">
                            <div className="latest-detail"><span>Función</span><strong>{latestOverall.participation}</strong></div>
                            <div className="latest-detail"><span>Categoría</span><strong>{CATEGORY_LABELS[latestOverall.category]}</strong></div>
                            <div className="latest-detail"><span>{latestOverall.participation === "Ayudante" ? "Titular / compañero" : "Ayudante / compañero"}</span><strong>{latestOverall.companionName ?? "No registrado"}</strong></div>
                          </div>
                        </div>
                      ) : (
                        <div className="empty-state"><strong>Sin historial disponible</strong>No hay participaciones de ejemplo asociadas a este registro.</div>
                      )}
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><ListChecks size={14} /> Revisar por categoría</h3>
                      <label className="field-label" htmlFor="history-category" style={{ marginBottom: 6 }}>Tipo de asignación que estás preparando</label>
                      <select id="history-category" className="select-field" value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value as CategoryFilter)}>
                        {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>

                    <div className="history-block">
                      <h3 className="history-block-heading"><History size={14} /> {historyCategory === "all" ? "Participaciones recientes" : `Historial: ${CATEGORY_LABELS[historyCategory]}`}</h3>
                      {latestInCategory && historyCategory !== "all" && (
                        <div className="latest-card" style={{ marginBottom: 12 }}>
                          <span className="latest-label">Última de esta categoría</span>
                          <p className="latest-title">{latestInCategory.assignment}</p>
                          <span className="latest-date">{formatDate(latestInCategory.date)}</span>
                          <div className="latest-details">
                            <div className="latest-detail"><span>Función</span><strong>{latestInCategory.participation}</strong></div>
                            <div className="latest-detail"><span>Ayudante / compañero</span><strong>{latestInCategory.companionName ?? "No registrado"}</strong></div>
                          </div>
                        </div>
                      )}
                      {memberHistory.length ? (
                        <div className="history-list">
                          {memberHistory.slice(0, 5).map((entry) => (
                            <div className="history-entry" key={entry.id}>
                              <div className="timeline-track"><span className="timeline-dot" /></div>
                              <div>
                                <p className="history-entry-title">{entry.assignment}</p>
                                <p className="history-entry-detail">{entry.participation}{entry.companionName ? ` · ${entry.companionName}` : ""}</p>
                                <span className="history-entry-date">{formatDate(entry.date)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state"><strong>No hay registros para esta categoría</strong>En la versión conectada, aquí aparecerán las asignaciones almacenadas en la base de datos.</div>
                      )}
                    </div>

                    <div className="helper-note">
                      <CircleHelp size={15} />
                      <span>Esta vista demuestra el comportamiento esperado. Los registros del historial son ilustrativos y no se modifican al editar el directorio.</span>
                    </div>
                  </>
                ) : (
                  <div className="empty-state"><strong>Selecciona una persona</strong>El historial contextual aparecerá aquí.</div>
                )}
              </div>
            </div>
          </section>

          <footer className="screen-footer">
            <span>Gestión de asignaciones · Prototipo de interfaz</span>
            <span>Directorio local de demostración · {isReady ? "Inicializado" : "Cargando..."}</span>
          </footer>
        </div>
      </main>

      {isFormOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="member-form-title">{editingMember ? "Editar registro" : "Nuevo hermano/a"}</h2>
                <p className="modal-description">Completa los datos básicos del directorio. Los campos marcados son obligatorios.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsFormOpen(false)} aria-label="Cerrar formulario"><X size={17} /></button>
            </div>

            <form onSubmit={saveMember}>
              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label" htmlFor="firstName">Nombre *</label>
                  <input id="firstName" className="field" name="firstName" required maxLength={100} defaultValue={editingMember?.firstName ?? ""} autoFocus />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="lastName">Apellido *</label>
                  <input id="lastName" className="field" name="lastName" required maxLength={100} defaultValue={editingMember?.lastName ?? ""} />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="gender">Sexo</label>
                  <select id="gender" className="select-field" name="gender" defaultValue={editingMember?.gender ?? "male"}>
                    <option value="male">Varón</option>
                    <option value="female">Mujer</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="appointment">Nombramiento</label>
                  <select id="appointment" className="select-field" name="appointment" defaultValue={editingMember?.appointment ?? "none"}>
                    <option value="none">No aplica / no registrado</option>
                    <option value="ministerial_servant">Siervo ministerial</option>
                    <option value="elder">Anciano</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="phone">Teléfono (opcional)</label>
                  <input id="phone" className="field" name="phone" type="tel" maxLength={30} defaultValue={editingMember?.phone ?? ""} />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="email">Correo (opcional)</label>
                  <input id="email" className="field" name="email" type="email" maxLength={150} defaultValue={editingMember?.email ?? ""} />
                </div>
                <div className="form-field full">
                  <label className="field-label" htmlFor="notes">Notas administrativas (opcional)</label>
                  <textarea id="notes" className="field" name="notes" maxLength={500} rows={2} defaultValue={editingMember?.notes ?? ""} />
                </div>
                <div className="form-field full">
                  <label className="check-row"><input type="checkbox" name="isBaptized" defaultChecked={editingMember?.isBaptized ?? true} /> Bautizado/a</label>
                  <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={editingMember?.isActive ?? true} /> Registro activo</label>
                </div>
                <div className="form-field full">
                  <p className="small-note">Las autorizaciones para intervenciones y las competencias no se deducen automáticamente de estos datos. Se gestionarán en un módulo específico con acceso autorizado.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button" onClick={() => setIsFormOpen(false)}>Cancelar</button>
                <button type="submit" className="button button-primary"><Check size={15} /> {editingMember ? "Guardar cambios" : "Añadir al directorio"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: number; caption: string }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-caption">{caption}</span>
    </article>
  );
}
