"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, CircleHelp, Clock, Download, FileText, FolderOpen, KeyRound, Plus, Save, ShieldAlert, Trash2, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createNeonBrowserClient } from "@/lib/neon/client";
import { PasswordChangeDialog } from "@/features/auth/PasswordChangeDialog";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { isNeonConfigured } from "@/lib/neon/env";
import { getCurrentAppUser, getMemberHistory, listMembers, MembershipRequiredError } from "../members/members-repository";
import type { AssignmentHistoryEntry, DirectoryMember } from "../members/demo-data";
import { CATEGORY_LABELS, DEMO_HISTORY, DEMO_MEMBERS } from "../members/demo-data";
import { DEMO_PROGRAMS } from "./programs-demo-data";
import type { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";
import { getMeetingProgramsFromNeon, saveMeetingProgramToNeon } from "./programs-repository";
import { validateProgramForPublication } from "./program-validation";
import { buildDefaultMeetingProgram, calculateBimonthCycle, formatBimonthCycleLabel } from "./program-builder";
import { applyMeetingGuideTitles, getMeetingGuidePeriodLabel, parseMeetingGuideEpub, type MeetingGuideWeek } from "./meeting-guide-importer";
import { activateActiveMeetingGuide, beginActiveMeetingGuideReplacement, getActiveMeetingGuide, replaceActiveMeetingGuide, type ActiveMeetingGuide } from "./meeting-guide-repository";
import { findExistingAssignment, type PendingDuplicateAssignment } from "./duplicate-assignment";
import { isActiveAppointedBrother, slotRequiresAppointedBrother, validateAssignmentRoleRestrictions } from "./assignment-eligibility";
import type { Section, WeekType } from "@/types/domain";

type WorkspaceMode = "loading" | "demo" | "login" | "connected" | "guide_required" | "membership" | "error";
type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;
const PAIRED_ASSIGNMENTS = new Set(["conversation", "revisit", "disciples", "explain_beliefs"]);

const SECTIONS: { id: Section; label: string }[] = [
  { id: "treasures", label: "Tesoros de la Biblia" },
  { id: "ministers", label: "Seamos mejores maestros" },
  { id: "living", label: "Nuestra vida cristiana" },
  { id: "auxiliary", label: "Otras partes" },
];
const WEEK_LABELS: Record<WeekType, string> = {
  normal: "Semana normal", circuit_overseer: "Visita del superintendente de circuito",
  assembly: "Asamblea", memorial: "Conmemoración",
};
const CYCLE_WEEKS = 8;
function longDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
function shortDate(value: string) {
  const d = new Date(`${value}T12:00:00Z`);
  return { day: d.getUTCDate(), month: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(d).replace(".", "") };
}
function addDays(value: string, days: number) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function Gate({ children }: { children: React.ReactNode }) {
  return <div className="gate-page" style={{ minHeight: "100vh" }}><section className="gate-panel">{children}</section></div>;
}

function GuideFilePicker({
  inputId,
  filename,
  disabled,
  onChange,
}: {
  inputId: string;
  filename: string;
  disabled: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isSelected = Boolean(filename);
  return (
    <div className="guide-file-picker">
      <input
        id={inputId}
        className="guide-upload-input"
        type="file"
        accept=".epub,application/epub+zip"
        onChange={onChange}
        disabled={disabled}
        aria-label="Seleccionar archivo EPUB de la guía de actividades"
      />
      <label
        htmlFor={inputId}
        className={`guide-upload ${isSelected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <span className="guide-upload-icon" aria-hidden="true">
          {isSelected ? <CheckCircle size={22} /> : <FolderOpen size={22} />}
        </span>
        <span className="guide-upload-copy">
          <strong>{isSelected ? "Archivo seleccionado" : "Seleccionar guía de actividades"}</strong>
          <span>
            {isSelected
              ? "El archivo se leyó correctamente. Revisa el período y las asignaciones."
              : "Formato EPUB · Haz clic aquí para buscar el archivo en tu equipo."}
          </span>
          {isSelected && (
            <span className="guide-upload-filename">
              <FileText size={14} aria-hidden="true" />
              <span>{filename}</span>
            </span>
          )}
        </span>
        <span className="guide-upload-action">{isSelected ? "Cambiar archivo" : "Buscar archivo"}</span>
      </label>
    </div>
  );
}

function findInactiveAssignedIds(program: MeetingProgramDetail, members: DirectoryMember[]): string[] {
  const activeIds = new Set(members.filter((member) => member.isActive).map((member) => member.id));
  const assignedIds = [program.chairmanId, program.auxiliaryCounselorId,
    ...program.slots.flatMap((slot) => [slot.primaryParticipantId, slot.assistantParticipantId])];
  return [...new Set(assignedIds.filter((id): id is string => Boolean(id) && !activeIds.has(id as string)))];
}

function verifyProgramRoundTrip(expected: MeetingProgramDetail, actual: MeetingProgramDetail | undefined) {
  if (!actual) throw new Error("No se pudo confirmar el guardado de la reunión.");
  if (actual.meetingDate !== expected.meetingDate || actual.weekType !== expected.weekType) {
    throw new Error("La reunión recuperada no coincide con la fecha o el tipo de semana.");
  }
  if (!actual.bimonthCycle || !actual.historyPeriod) {
    throw new Error("La reunión se guardó sin recuperar sus relaciones de ciclo bimestral y período semestral.");
  }
  if (expected.weeklyBibleReading && actual.weeklyBibleReading !== expected.weeklyBibleReading) {
    throw new Error("No se pudo verificar la lectura bíblica semanal de la guía.");
  }
  if (expected.openingSongNumber !== actual.openingSongNumber
    || expected.livingSongNumber !== actual.livingSongNumber
    || expected.closingSongNumber !== actual.closingSongNumber) {
    throw new Error("No se pudieron verificar los números de canción de la guía.");
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
      || actualSlot.durationMinutes !== expectedSlot.durationMinutes
      || (actualSlot.primaryParticipantId ?? "") !== (expectedSlot.primaryParticipantId ?? "")
      || (actualSlot.assistantParticipantId ?? "") !== (expectedSlot.assistantParticipantId ?? "")) {
      throw new Error("La reunión guardada no coincide con los cambios realizados.");
    }
  }
  if ((actual.status === "published") !== (expected.status === "published")) {
    throw new Error("El estado recuperado no coincide con el estado solicitado.");
  }
}

type SignOutHandler = () => Promise<void>;
type ProgramsWorkspaceProps = {
  onRegisterSignOut: (handler: SignOutHandler | null) => void;
};

export const ProgramsWorkspace: React.FC<ProgramsWorkspaceProps> = ({ onRegisterSignOut }) => {
  const signOutActionRef = React.useRef<SignOutHandler | null>(null);
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
  const [signingOut, setSigningOut] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeGuide, setActiveGuide] = useState<ActiveMeetingGuide | null>(null);

  // Estado para día y hora preferidos de la reunión de entre semana (Lunes a Viernes)
  const [meetingDayOffset, setMeetingDayOffset] = useState<number>(3); // 3 = Jueves (Lunes + 3 días)
  const [meetingHour, setMeetingHour] = useState<string>("19");
  const [meetingMinute, setMeetingMinute] = useState<string>("00");

  // Estado para previsualización de historial de los últimos 3 meses y modal de advertencia flotante
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicateAssignment | null>(null);

  // Modal para crear un programa nuevo
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newWeekType, setNewWeekType] = useState<WeekType>("normal");
  const [isGuideImportModalOpen, setIsGuideImportModalOpen] = useState(false);
  const [guideFileName, setGuideFileName] = useState("");
  const [guidePeriodLabel, setGuidePeriodLabel] = useState("");
  const [guideWeeks, setGuideWeeks] = useState<MeetingGuideWeek[]>([]);
  const [guideError, setGuideError] = useState("");
  const [guideImporting, setGuideImporting] = useState(false);

  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;

  async function loadConnectedData(neon: NeonBrowserClient, activeUserId: string) {
    const appUser = await getCurrentAppUser(neon, activeUserId);
    setUserId(activeUserId);
    setCanManage(["administrator", "user"].includes(appUser.role));
    setCanConfirmEligibility(["administrator", "user"].includes(appUser.role));

    // Never load participants/programs until a valid bimonthly EPUB is active.
    const guide = await getActiveMeetingGuide(neon);
    setActiveGuide(guide);
    if (!guide) {
      setMembers([]);
      setPrograms([]);
      setSelectedProgramId(null);
      setMode("guide_required");
      return;
    }

    const [directory, savedPrograms] = await Promise.all([
      listMembers(neon, activeUserId),
      getMeetingProgramsFromNeon(neon),
    ]);
    setMembers(directory.members);
    setPrograms(savedPrograms);
    const firstGuideProgram = guide.weeks
      .map((week) => savedPrograms.find((program) => program.meetingDate === week.startDate))
      .find((program) => program !== undefined);
    setSelectedProgramId((current) => savedPrograms.some((program) => program.id === current)
      ? current
      : firstGuideProgram?.id ?? savedPrograms[0]?.id ?? null);
    setMode("connected");
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!isNeonConfigured()) {
        if (process.env.NODE_ENV === "production") {
          if (!cancelled) {
            setPageError("No se pudo establecer la conexión con el servicio. Inténtalo de nuevo más tarde.");
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
        const { data, error } = await neon.auth.getSession();
        if (error) throw new Error("No se pudo verificar la sesión.");
        const user = data.session?.user;
        if (!user) {
          setMode("login");
          return;
        }
        await loadConnectedData(neon, user.id);
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

  useEffect(() => {
    let active = true;
    if (!previewMemberId) {
      setPreviewHistory([]);
      return;
    }
    setPreviewLoading(true);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoffDate = threeMonthsAgo.toISOString().slice(0, 10);

    if (mode === "connected" && client && userId) {
      getMemberHistory(client, userId, previewMemberId)
        .then((history) => {
          if (!active) return;
          setPreviewHistory(history.filter((h) => h.date >= cutoffDate));
        })
        .catch(() => {
          if (!active) return;
          setPreviewHistory([]);
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    } else {
      const demoMatches = DEMO_HISTORY.filter((h) => h.memberId === previewMemberId && h.date >= cutoffDate);
      setPreviewHistory(demoMatches);
      setPreviewLoading(false);
    }

    return () => { active = false; };
  }, [previewMemberId, mode, client, userId]);

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
        setFeedback(`Borrador del programa creado exitosamente para el ${newMeetingDate}.`);
      } catch (err) {
        setPageError("No se pudo crear el programa. Verifica los datos e inténtalo de nuevo.");
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

  async function handleBeginGuideReplacement() {
    if (!client || !userId || !canManage || guideImporting) return;
    setGuideImporting(true);
    setPageError("");
    setGuideError("");
    try {
      await beginActiveMeetingGuideReplacement(client);
      setActiveGuide(null);
      setMembers([]);
      setPrograms([]);
      setSelectedProgramId(null);
      setGuideWeeks([]);
      setGuideFileName("");
      setGuidePeriodLabel("");
      setIsGuideImportModalOpen(false);
      setFeedback("");
      setMode("guide_required");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo iniciar el nuevo ciclo bimestral.");
    } finally {
      setGuideImporting(false);
    }
  }

  async function handleGuideFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setGuideError("");
    setGuideWeeks([]);
    setGuideFileName("");
    setGuidePeriodLabel("");
    if (!file.name.toLowerCase().endsWith(".epub")) {
      setGuideError("Selecciona la guía original en formato EPUB.");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseMeetingGuideEpub(bytes, file.name);
      const periodLabel = getMeetingGuidePeriodLabel(bytes, file.name);
      if (parsed.some((week) => week.assignments.length === 0)) {
        throw new Error("La guía tiene semanas sin una estructura de asignaciones válida.");
      }
      setGuideFileName(file.name);
      setGuidePeriodLabel(periodLabel);
      setGuideWeeks(parsed);
    } catch (error) {
      setGuideError(error instanceof Error ? error.message : "No se pudo leer la guía.");
    }
  }

  async function handleApplyGuideImport() {
    if (guideImporting || guideWeeks.length === 0) return;
    if (!client || !userId || !canManage) {
      setGuideError("Necesitas una sesión autorizada para reemplazar la guía bimestral.");
      return;
    }

    const previousMode = mode;
    setGuideImporting(true);
    setGuideError("");
    setPageError("");
    setMembers([]);
    setPrograms([]);
    setSelectedProgramId(null);
    setMode("loading");

    let guideWasReplaced = false;
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let publishedCount = 0;
    let currentWeekLabel = "";
    const expectedPrograms: MeetingProgramDetail[] = [];

    try {
      const orderedWeeks = [...guideWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const newGuide = await replaceActiveMeetingGuide(client, {
        fileName: guideFileName,
        periodLabel: guidePeriodLabel,
        periodStart: orderedWeeks[0].startDate,
        periodEnd: orderedWeeks[orderedWeeks.length - 1].endDate,
        weeks: orderedWeeks,
      });
      guideWasReplaced = true;
      setActiveGuide(newGuide);

      // The guide is persisted before program lookup or participant loading.
      const existingPrograms = await getMeetingProgramsFromNeon(client);
      const byDate = new Map(existingPrograms.map((program) => [program.meetingDate, program]));

      for (const week of orderedWeeks) {
        currentWeekLabel = week.label;
        const existing = byDate.get(week.startDate);
        if (existing?.status === "published") {
          publishedCount += 1;
          continue;
        }

        const baseProgram = existing ?? buildDefaultMeetingProgram(week.startDate, "normal");
        const nextProgram = applyMeetingGuideTitles(baseProgram, week);
        const programChanged = !existing
          || existing.slots.length !== nextProgram.slots.length
          || existing.weeklyBibleReading !== nextProgram.weeklyBibleReading
          || existing.openingSongNumber !== nextProgram.openingSongNumber
          || existing.livingSongNumber !== nextProgram.livingSongNumber
          || existing.closingSongNumber !== nextProgram.closingSongNumber
          || nextProgram.slots.some((slot) => {
            const previous = existing.slots.find((item) => item.id === slot.id);
            return !previous
              || previous.section !== slot.section
              || previous.title !== slot.title
              || previous.assignmentType !== slot.assignmentType
              || previous.durationMinutes !== slot.durationMinutes
              || previous.isStudentPart !== slot.isStudentPart
              || (previous.primaryParticipantId ?? "") !== (slot.primaryParticipantId ?? "")
              || (previous.assistantParticipantId ?? "") !== (slot.assistantParticipantId ?? "");
          });

        if (!programChanged) {
          unchangedCount += 1;
          continue;
        }

        await saveMeetingProgramToNeon(client, userId, nextProgram);
        expectedPrograms.push(nextProgram);
        byDate.set(week.startDate, nextProgram);
        if (existing) updatedCount += 1;
        else createdCount += 1;
      }

      const refreshed = await getMeetingProgramsFromNeon(client);
      for (const expected of expectedPrograms) {
        verifyProgramRoundTrip(expected, refreshed.find((program) => program.id === expected.id));
      }
      await activateActiveMeetingGuide(client);
      await loadConnectedData(client, userId);
      setIsGuideImportModalOpen(false);
      setGuideWeeks([]);
      setGuideFileName("");
      setGuidePeriodLabel("");
      setFeedback(
        `Guía ${newGuide.periodLabel} activada: ${createdCount} borradores creados, ${updatedCount} actualizados, ${unchangedCount} sin cambios y ${publishedCount} publicados protegidos. La guía anterior fue reemplazada.`,
      );
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "No se pudo guardar la estructura semanal.";
      if (guideWasReplaced || previousMode === "connected") {
        try {
          await loadConnectedData(client, userId);
        } catch {
          setMembers([]);
          setPrograms([]);
          setSelectedProgramId(null);
          setMode("error");
          setPageError("No se pudo completar la carga de la programación tras procesar la guía.");
        }
      } else {
        setMembers([]);
        setPrograms([]);
        setSelectedProgramId(null);
        setMode("guide_required");
      }
      setGuideError(
        guideWasReplaced
          ? `La guía nueva quedó guardada pero sigue bloqueada; no se habilitarán participantes hasta completar la preparación de sus semanas. Detenido en ${currentWeekLabel || "una semana"}: ${errorText}`
          : `No se reemplazó la guía anterior. ${errorText}`,
      );
    } finally {
      setGuideImporting(false);
    }
  }

  async function handleSave(status: "draft" | "published") {
    if (!selectedProgram || saving) return;
    setPageError("");
    setFeedback("");

    if (mode === "demo") {
      if (status === "published") {
        setPageError("La vista de demostración no permite publicar programas. Inicia sesión con una cuenta autorizada.");
        return;
      }
      updateProgram({ ...selectedProgram, status: "draft", updatedAt: new Date().toISOString() });
      setFeedback("Cambio temporal aplicado en la vista de demostración; no se guardó permanentemente.");
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
    if (findInactiveAssignedIds(selectedProgram, members).length > 0) {
      setPageError("No se puede guardar: hay participantes inactivos asignados. Reemplaza esas asignaciones por personas activas.");
      return;
    }

    const roleErrors = validateAssignmentRoleRestrictions(selectedProgram, members);
    if (roleErrors.length > 0) {
      setPageError("No se puede guardar el programa. Corrige estas restricciones:\n• " + roleErrors.slice(0, 8).join("\n• "));
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
      setFeedback(status === "published" ? "Programa publicado exitosamente." : "Borrador guardado exitosamente.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo guardar el programa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateS140() {
    if (!selectedProgram || generating || mode !== "connected" || !client || !userId) {
      setPageError("Para generar el S-140, inicia sesión con una cuenta autorizada.");
      return;
    }

    const programsToGenerate = programs
      .filter((program) => selectedProgram.planningCycleId
        ? program.planningCycleId === selectedProgram.planningCycleId
        : program.id === selectedProgram.id)
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));

    for (const program of programsToGenerate) {
      if (findInactiveAssignedIds(program, members).length > 0) {
        setPageError("No se puede generar el S-140 del " + program.meetingDate
          + ": hay participantes inactivos asignados. Reemplaza esas asignaciones por personas activas.");
        return;
      }
      const roleErrors = validateAssignmentRoleRestrictions(program, members);
      if (roleErrors.length > 0) {
        setPageError("No se puede generar el S-140 del " + program.meetingDate
          + ". Corrige estas restricciones:\\n• " + roleErrors.slice(0, 8).join("\\n• "));
        return;
      }
    }

    setGenerating(true);
    setPageError("");
    setFeedback("");
    try {
      // Guardar todos los borradores del ciclo evita emitir el S-140 con asignaciones
      // que sigan únicamente en el estado local del navegador.
      if (canManage) {
        for (const program of programsToGenerate) {
          if (program.status === "draft") {
            await saveMeetingProgramToNeon(client, userId, program);
          }
        }
      }

      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
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
      anchor.download = `S-140-${(selectedProgram.bimonthCycle || selectedProgram.meetingDate).replace(/[^a-zA-Z0-9_-]/g, "")}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setFeedback(`S-140 generado exitosamente: ${programsToGenerate.length} reuniones, con dos por página.`);
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

  async function handleSignOut() {
    if (!client || signingOut) return;
    setSigningOut(true);
    setPageError("");
    setFeedback("");
    try {
      const { error } = await client.auth.signOut();
      if (error) throw new Error("No se pudo cerrar sesión. Inténtalo de nuevo.");
      setUserId(null);
      setCanManage(false);
      setCanConfirmEligibility(false);
      setActiveGuide(null);
      setMembers([]);
      setPrograms([]);
      setSelectedProgramId(null);
      setPreviewMemberId(null);
      setPreviewHistory([]);
      setLoginError("");
      setMode("login");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "No se pudo cerrar sesión.");
    } finally {
      setSigningOut(false);
    }
  }

  signOutActionRef.current = handleSignOut;
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

  if (mode === "loading") return <Gate><p>Cargando programas…</p></Gate>;
  if (mode === "login") return (
    <LoginScreen
      onSubmit={handleSignIn}
      loading={signingIn}
      error={loginError}
      description="Accede con tu cuenta autorizada para consultar y preparar los programas semanales."
    />
  );
  if (mode === "guide_required") return (
    <Gate>
      <div className="gate-brand"><span className="brand-mark">RVM</span><span>Reunión Vida y Ministerio Cristianos</span></div>
      <div className="gate-icon"><Upload size={22} /></div>
      <h1 className="gate-title">Carga la guía de actividades</h1>
      <p className="gate-description">Selecciona la guía de actividades en formato EPUB para el bimestre. Sus semanas, asignaciones, títulos y duraciones se utilizarán para crear los programas y preparar el formulario S-140.</p>
      <div className="form-field" style={{ marginTop: 18 }}>
        <p className="field-label" style={{ margin: "0 0 8px" }}>Guía de actividades (.epub)</p>
        <GuideFilePicker
          inputId="required-meeting-guide"
          filename={guideFileName}
          disabled={guideImporting}
          onChange={(event) => void handleGuideFileSelected(event)}
        />
      </div>
      {guidePeriodLabel && <p className="guide-period-note"><CheckCircle size={14} /> Período detectado: <strong>{guidePeriodLabel}</strong></p>}
      {guideError && <div className="inline-alert pre" role="alert" style={{ marginTop: 12 }}><AlertTriangle size={15} />{guideError}</div>}
      {guideWeeks.length > 0 && (
        <div className="guide-weeks-preview">
          {guideWeeks.map((week) => (
            <article key={week.startDate} className="guide-week-preview">
              <div className="guide-week-heading">
                <strong>{week.label}</strong>
                <span>{week.assignments.length} asignaciones</span>
              </div>
              <p className="guide-week-reading">{week.weeklyBibleReading}</p>
              <div className="guide-preview-assignments">
                {week.assignments.map((item) => (
                  <div key={item.number} className="guide-preview-assignment">
                    <span className="guide-preview-assignment-title">
                      <span className="guide-preview-number">{item.number}.</span>
                      {item.title}{item.scriptureRange ? ` (${item.scriptureRange})` : ""}
                    </span>
                    <span className="guide-preview-duration">{item.durationMinutes} min</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className="button button-primary gate-submit" onClick={() => void handleApplyGuideImport()} disabled={guideImporting || guideWeeks.length === 0 || !canManage}>
        <Upload size={15} /> {guideImporting ? "Activando guía…" : "Guardar guía y generar estructura"}
      </button>
    </Gate>
  );

  if (mode === "membership") return (
    <Gate>
      <div className="gate-icon"><AlertTriangle size={22} /></div>
      <h1 className="gate-title">Falta configurar tu acceso</h1>
      <p className="gate-description">Tu cuenta no pertenece aún a la congregación activa. Contacta al administrador para vincularla.</p>
    </Gate>
  );
  if (mode === "error") return (
    <Gate>
      <div className="gate-icon"><AlertTriangle size={22} /></div>
      <h1 className="gate-title">No se pudieron cargar los programas</h1>
      <p className="gate-description">{pageError || "Ocurrió un error inesperado al conectar con el servidor."}</p>
    </Gate>
  );

  const readOnly = !!(mode === "connected" && (selectedProgram?.status === "published" || !canManage));
  const cycleLabels = [...new Set(programs.map((p) => p.bimonthCycle))];
  const activeMembers = members.filter((m) => m.isActive);
  // Las oraciones solo pueden asignarse a varones activos; el género ya existe en el directorio.
  const activeMaleMembers = activeMembers.filter((m) => m.gender === "male");
  const slots = selectedProgram ? [...selectedProgram.slots].sort((x, y) => x.orderIndex - y.orderIndex) : [];
  const offsets: Record<string, number> = {};
  let elapsed = 0;
  for (const slot of slots) { offsets[slot.id] = elapsed; elapsed += slot.durationMinutes; }
  const assigned = slots.filter((s) => s.primaryParticipantId).length;
  const reviewed = slots.filter((s) => s.eligibilityConfirmed).length;
  const resetLeadership = { leadershipReviewConfirmed: false, leadershipReviewConfirmedBy: undefined, leadershipReviewConfirmedAt: undefined };
  const people = (opts: DirectoryMember[]) => opts.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>);
  const peopleForSlot = (slot: AssignmentSlotDetail) => {
    const eligibleMembers = slotRequiresAppointedBrother(slot)
      ? activeMembers.filter(isActiveAppointedBrother)
      : activeMembers;
    return people(eligibleMembers);
  };

  // El resumen refleja exactamente las semanas presentes en la guía bimestral activa.
  const cycleKey = activeGuide
    ? calculateBimonthCycle(activeGuide.weeks[0].startDate)
    : selectedProgram?.bimonthCycle ?? programs[0]?.bimonthCycle;
  const cyclePrograms = programs.filter((p) => p.bimonthCycle === cycleKey).sort((x, y) => x.meetingDate.localeCompare(y.meetingDate));
  const cycleDates = new Set(cyclePrograms.map((p) => p.meetingDate));
  if (cyclePrograms[0]) for (let i = 0; i < CYCLE_WEEKS; i++) cycleDates.add(addDays(cyclePrograms[0].meetingDate, i * 7));
  const cycleWeeks = activeGuide
    ? activeGuide.weeks.map((week) => ({ date: week.startDate, program: cyclePrograms.find((p) => p.meetingDate === week.startDate) }))
    : [...cycleDates].sort().map((date) => ({ date, program: cyclePrograms.find((p) => p.meetingDate === date) }));
  const scheduledCount = cycleWeeks.filter((w) => w.program).length;
  const publishedCount = cyclePrograms.filter((p) => p.status === "published").length;

  const meter = (label: string, value: number) => (
    <div className="meter"><div><span>{label}</span><span>{value} de {slots.length}</span></div><p><i style={{ width: `${slots.length ? (value / slots.length) * 100 : 0}%` }} /></p></div>
  );


  function applyAssignment(
    targetRole: "chairman" | "auxiliary" | "opening_prayer" | "closing_prayer" | "primary" | "assistant",
    memberId: string | undefined,
    slotId?: string
  ) {
    if (!selectedProgram) return;

    if (targetRole === "chairman") {
      updateProgram({ ...selectedProgram, chairmanId: memberId, ...resetLeadership });
    } else if (targetRole === "auxiliary") {
      updateProgram({ ...selectedProgram, auxiliaryCounselorId: memberId, ...resetLeadership });
    } else if (targetRole === "opening_prayer") {
      updateProgram({ ...selectedProgram, openingPrayerParticipantId: memberId, ...resetLeadership });
    } else if (targetRole === "closing_prayer") {
      updateProgram({ ...selectedProgram, closingPrayerParticipantId: memberId, ...resetLeadership });
    } else if (targetRole === "primary" && slotId) {
      updateSlot(slotId, { primaryParticipantId: memberId }, true);
    } else if (targetRole === "assistant" && slotId) {
      updateSlot(slotId, { assistantParticipantId: memberId }, true);
    }

    setPreviewMemberId(memberId ?? null);
  }

  function handleParticipantSelect(
    targetRole: "chairman" | "auxiliary" | "opening_prayer" | "closing_prayer" | "primary" | "assistant",
    newMemberId: string | undefined,
    slotId?: string
  ) {
    if (!newMemberId) {
      applyAssignment(targetRole, undefined, slotId);
      return;
    }

    if (!selectedProgram) {
      applyAssignment(targetRole, newMemberId, slotId);
      return;
    }

    const existing = findExistingAssignment(selectedProgram, newMemberId, targetRole, slotId);
    if (existing) {
      const member = members.find((m) => m.id === newMemberId);
      const memberName = member ? `${member.firstName} ${member.lastName}` : "El hermano/a";
      const isChairman = selectedProgram.chairmanId === newMemberId || targetRole === "chairman";

      setPendingDuplicate({
        memberId: newMemberId,
        memberName,
        existingPartTitle: existing.title,
        targetRole,
        slotId,
        isChairmanAssigningOther: isChairman,
      });
      setPreviewMemberId(newMemberId);
      return;
    }

    applyAssignment(targetRole, newMemberId, slotId);
  }

  const renderSideHistoryCard = () => {
    const member = members.find((m) => m.id === previewMemberId);

    return (
      <AnimatePresence mode="wait">
        {previewMemberId && member && (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, x: -520, y: -15, scale: 0.78 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.25, ease: "easeIn" } }}
            transition={{
              duration: 0.55,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="card history-side-card"
          >
            <div className="popover-header">
              <span>
                <Clock size={14} aria-hidden="true" />
                Historial (últimos 3 meses)
              </span>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0 }}
                onClick={() => setPreviewMemberId(null)}
                aria-label="Cerrar historial"
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ fontWeight: 850, marginBottom: 8, color: "#1d4ed8", fontSize: "12px" }}>
              {member.firstName} {member.lastName}
            </div>
            {previewLoading ? (
              <div className="popover-empty">Cargando historial…</div>
            ) : previewHistory.length === 0 ? (
              <div className="popover-empty">Sin asignaciones registradas en los últimos 3 meses</div>
            ) : (
              <ul className="popover-list">
                {previewHistory.map((item) => (
                  <li key={item.id} className="popover-item">
                    <div>
                      <div className="popover-item-title">{item.assignment}</div>
                      <div className="popover-item-meta">
                        {CATEGORY_LABELS[item.category] || item.category} · {item.participation}
                        {item.companionName ? ` (${item.companionName})` : ""}
                      </div>
                    </div>
                    <div className="popover-item-date">{item.date}</div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="workspace">
      <header className="page-head">
        <div>
          <h1>Reunión Vida y Ministerio Cristianos</h1>
          <p>Preparación de asignaciones semanales, confirmación de elegibilidad y emisión del formulario S-140.</p>
        </div>
        <div className="head-actions">
          {mode === "demo" && <span className="demo-pill"><span className="demo-dot" /> MODO DEMOSTRACIÓN</span>}
          {activeGuide && mode === "connected" && <span className="small-note">Guía activa: <strong>{activeGuide.periodLabel}</strong></span>}
          {canManage && mode === "connected" && <button type="button" className="button" onClick={() => void handleBeginGuideReplacement()} disabled={guideImporting}><Upload size={16} /> Iniciar nuevo ciclo bimestral</button>}
          {canManage && <button type="button" className="button" onClick={() => setIsNewProgramModalOpen(true)}><Plus size={16} /> Crear programa</button>}
        </div>
      </header>

      {mode === "demo" && <div className="demo-banner" role="note"><AlertTriangle size={17} /><div><strong>Entorno de demostración</strong><p>Los datos son ficticios y no se guardan permanentemente. Para guardar programas y emitir el S-140 oficial, inicia sesión con una cuenta autorizada.</p></div></div>}
      {pageError && <div className="inline-alert pre" role="alert"><AlertTriangle size={15} />{pageError}<button type="button" className="icon-button" onClick={() => setPageError("")} aria-label="Cerrar aviso"><X size={14} /></button></div>}
      {feedback && <div className="alert-ok" role="status">{feedback}</div>}

      <div className="seg" role="tablist" style={{ marginBottom: 20 }}>
        <button type="button" role="tab" aria-selected={activeTab === "editor"} aria-pressed={activeTab === "editor"} onClick={() => setActiveTab("editor")}>Editor de programa</button>
        <button type="button" role="tab" aria-selected={activeTab === "bimonthly"} aria-pressed={activeTab === "bimonthly"} onClick={() => setActiveTab("bimonthly")}>Resumen bimestral</button>
      </div>

      {activeTab === "bimonthly" ? (
        <div className="cycle-grid">
          {cycleLabels.length === 0 ? <div className="empty-state">Aún no hay programas registrados.</div> : cycleLabels.map((cycle) => {
            const list = programs.filter((p) => p.bimonthCycle === cycle);
            const pub = list.filter((p) => p.status === "published").length;
            const draft = list.filter((p) => p.status === "draft").length;
            return (
              <article key={cycle} className="panel" style={{ padding: 20 }}>
                <h3 style={{ margin: "0 0 8px", font: "500 20px var(--font-display)" }}>{formatBimonthCycleLabel(cycle)}</h3>
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>{list.length} reuniones · {pub} publicadas · {draft} borradores</p>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          {programs.length > 0 && (
            <>
              {/* Barra global reutilizable de Horario de Reunión de Congregación */}
              <div className="meeting-schedule-bar" role="region" aria-label="Horario habitual de la reunión de entre semana">
                <div className="meeting-schedule-item">
                  <label htmlFor="meeting-day-select">Día de reunión (entre semana):</label>
                  <select
                    id="meeting-day-select"
                    className="select-field"
                    value={meetingDayOffset}
                    onChange={(e) => setMeetingDayOffset(Number(e.target.value))}
                  >
                    <option value={0}>Lunes</option>
                    <option value={1}>Martes</option>
                    <option value={2}>Miércoles</option>
                    <option value={3}>Jueves</option>
                    <option value={4}>Viernes</option>
                  </select>
                </div>
                <div className="meeting-schedule-item">
                  <label htmlFor="meeting-hour-select">Hora habitual:</label>
                  <select
                    id="meeting-hour-select"
                    className="select-field"
                    value={meetingHour}
                    onChange={(e) => setMeetingHour(e.target.value)}
                  >
                    <option value="17">17 (5 PM)</option>
                    <option value="18">18 (6 PM)</option>
                    <option value="19">19 (7 PM)</option>
                    <option value="20">20 (8 PM)</option>
                  </select>
                  <span>:</span>
                  <select
                    id="meeting-minute-select"
                    className="select-field"
                    value={meetingMinute}
                    aria-label="Minuto habitual"
                    onChange={(e) => setMeetingMinute(e.target.value)}
                  >
                    <option value="00">00</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                  </select>
                </div>
              </div>

              <div className="cycle-line">
                <span><strong>{formatBimonthCycleLabel(cycleKey ?? "")}</strong> · {cycleWeeks.length} semanas</span>
                <span>{scheduledCount} de {cycleWeeks.length} programadas · {publishedCount} publicadas</span>
              </div>
              <div className="date-strip" role="group" aria-label="Semanas del ciclo">
                {cycleWeeks.map(({ date, program }) => {
                  const actualDate = addDays(date, meetingDayOffset);
                  const { day, month } = shortDate(actualDate);
                  if (program) {
                    const isPub = program.status === "published";
                    const isSelected = program.id === selectedProgramId;
                    return (
                      <button key={date} type="button" className={`date-chip ${isPub ? "pub" : ""}`} aria-pressed={isSelected} onClick={() => { setSelectedProgramId(program.id); setPageError(""); setFeedback(""); setPreviewMemberId(null); }}>
                        <b>{day} {month}</b>
                        <span><i />{isPub ? "Publicada" : "Borrador"}</span>
                      </button>
                    );
                  }
                  return (
                    <button key={date} type="button" className="date-chip empty" disabled={!canManage} onClick={() => { setNewMeetingDate(date); setIsNewProgramModalOpen(true); setPreviewMemberId(null); }}>
                      <b>{day} {month}</b>
                      <span><i />Sin programar</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!selectedProgram ? (
            <div className="empty-state" style={{ padding: 60 }}>No hay reuniones para mostrar. Selecciona una semana o crea un programa nuevo.</div>
          ) : (
            <div className="meeting-grid">
              <div>
                <h2 className="meeting-title">{longDate(addDays(selectedProgram.meetingDate, meetingDayOffset))}</h2>
                <p className="meeting-sub">{WEEK_LABELS[selectedProgram.weekType]} · {formatBimonthCycleLabel(selectedProgram.bimonthCycle)} · Guía: {longDate(selectedProgram.meetingDate)}</p>

                {readOnly && (
                  <div className="alert-info">
                    {selectedProgram.status === "published"
                      ? "Programa publicado: solo lectura para proteger el historial."
                      : "Tu rol permite consultar, pero no editar este programa."}
                  </div>
                )}

                <div className="leaders">
                  <label className="lbl">Presidente de la reunión
                    <select className="select-field" aria-label="Presidente de la reunión" value={selectedProgram.chairmanId ?? ""} disabled={readOnly}
                      onFocus={() => { setPreviewMemberId(selectedProgram.chairmanId ?? null); }}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        handleParticipantSelect("chairman", val);
                      }}>
                      <option value="">Seleccionar presidente…</option>{people(activeMembers.filter((member) => member.appointment === "elder"))}
                    </select>
                  </label>
                  <label className="lbl">Consejero auxiliar (opcional)
                    <select className="select-field" aria-label="Consejero auxiliar" value={selectedProgram.auxiliaryCounselorId ?? ""} disabled={readOnly}
                      onFocus={() => { setPreviewMemberId(selectedProgram.auxiliaryCounselorId ?? null); }}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        handleParticipantSelect("auxiliary", val);
                      }}>
                      <option value="">Ninguno</option>{people(activeMembers.filter((m) => m.appointment === "elder"))}
                    </select>
                  </label>
                  <label className="lbl">Oración inicial
                    <select className="select-field" aria-label="Oración inicial" value={selectedProgram.openingPrayerParticipantId ?? ""} disabled={readOnly}
                      onFocus={() => { setPreviewMemberId(selectedProgram.openingPrayerParticipantId ?? null); }}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        handleParticipantSelect("opening_prayer", val);
                      }}>
                      <option value="">Seleccionar oración inicial…</option>{people(activeMaleMembers)}
                    </select>
                  </label>
                  {selectedProgram.weekType === "circuit_overseer" && (
                    <label className="lbl full">Título del discurso del superintendente de circuito
                      <input className="field" value={selectedProgram.circuitOverseerTalkTitle ?? ""} disabled={readOnly}
                        onChange={(e) => updateProgram({ ...selectedProgram, circuitOverseerTalkTitle: e.target.value })} />
                    </label>
                  )}
                  <label className="review full">
                    <input type="checkbox" checked={selectedProgram.leadershipReviewConfirmed === true} disabled={readOnly}
                      onChange={(e) => updateProgram({
                        ...selectedProgram,
                        leadershipReviewConfirmed: e.target.checked,
                        leadershipReviewConfirmedBy: e.target.checked ? userId ?? undefined : undefined,
                        leadershipReviewConfirmedAt: e.target.checked ? new Date().toISOString() : undefined,
                      })} />
                    <div>
                      Presidencia y consejería revisadas
                      <small>Solo un anciano o administrador confirma esto antes de publicar. Cambiar al presidente o al consejero invalida la revisión.</small>
                    </div>
                  </label>
                </div>

                {slots.length === 0 ? (
                  <div className="empty-state">Sin intervenciones — Este programa no tiene partes cargadas.</div>
                ) : (
                  <>
                    {SECTIONS.map((section) => {
                      const group = slots.filter((s) => s.section === section.id);
                      if (group.length === 0) return null;
                      return (
                        <section key={section.id} className={`sec sec-${section.id}`}>
                          <div className="sec-bar">{section.label}<span>{group.reduce((n, s) => n + s.durationMinutes, 0)} min</span></div>
                          <div className="slots">
                            {group.map((slot) => {
                              const isBibleStudy = slot.assignmentType === "bible_study_conductor"
                                || slot.assignmentType === "bible_study_reader"
                                || slot.title.toLowerCase().includes("estudio bíblico")
                                || slot.title.toLowerCase().includes("estudio biblico");
                              const primaryLabel = isBibleStudy ? "Conductor" : slot.isStudentPart ? "Estudiante" : "Encargado";
                              const assistantLabel = isBibleStudy ? "Lector" : "Ayudante";

                              return (
                                <article key={slot.id} className="slot">
                                  <div className="slot-time"><b>{slot.durationMinutes}</b><span>min</span></div>
                                  <div className="slot-main">
                                    <div className="slot-title">
                                      <input className="field" aria-label={`Título de ${slot.orderIndex}`} value={slot.title} disabled={readOnly}
                                        onChange={(e) => updateSlot(slot.id, { title: e.target.value }, true)} />
                                      {!readOnly && <button type="button" className="icon-button" onClick={() => handleRemoveSlot(slot.id)}
                                        title="Retirar de este borrador" aria-label={`Retirar ${slot.title}`}><Trash2 size={15} /></button>}
                                    </div>
                                    <div className="slot-people">
                                      <label className="lbl">{primaryLabel}
                                        <select className="select-field" aria-label={`${primaryLabel} de ${slot.title}`} value={slot.primaryParticipantId ?? ""} disabled={readOnly}
                                          onFocus={() => { setPreviewMemberId(slot.primaryParticipantId ?? null); }}
                                          onChange={(e) => {
                                            const val = e.target.value || undefined;
                                            handleParticipantSelect("primary", val, slot.id);
                                          }}>
                                          <option value="">Seleccionar {primaryLabel.toLowerCase()}…</option>{peopleForSlot(slot)}
                                        </select>
                                      </label>
                                      {(PAIRED_ASSIGNMENTS.has(slot.assignmentType ?? "") || slot.assistantParticipantId || isBibleStudy) && (
                                        <label className="lbl">{assistantLabel}
                                          <select className="select-field" aria-label={`${assistantLabel} de ${slot.title}`} value={slot.assistantParticipantId ?? ""} disabled={readOnly}
                                            onFocus={() => { setPreviewMemberId(slot.assistantParticipantId ?? null); }}
                                            onChange={(e) => {
                                              const val = e.target.value || undefined;
                                              handleParticipantSelect("assistant", val, slot.id);
                                            }}>
                                            <option value="">Seleccionar {assistantLabel.toLowerCase()}…</option>{peopleForSlot(slot)}
                                          </select>
                                        </label>
                                      )}
                                    </div>
                                    <label className="slot-check">
                                      <input type="checkbox" checked={slot.eligibilityConfirmed === true}
                                        disabled={readOnly || (mode === "connected" && !canConfirmEligibility)}
                                        onChange={(e) => updateSlot(slot.id, { eligibilityConfirmed: e.target.checked, eligibilityConfirmedBy: e.target.checked ? userId ?? undefined : undefined })} />
                                      {slot.eligibilityConfirmed
                                        ? <span className="slot-ok"><CheckCircle size={13} style={{ verticalAlign: "-2px" }} /> Revisada{slot.eligibilityConfirmedBy ? "" : " (demo)"}</span>
                                        : <span title="Confirmar elegibilidad S-38-S. Cambiar el título o los participantes la invalida.">Por revisar</span>}
                                    </label>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}

                    <div className="leaders" style={{ marginTop: 20 }}>
                      <label className="lbl">Oración final
                        <select className="select-field" aria-label="Oración final" value={selectedProgram.closingPrayerParticipantId ?? ""} disabled={readOnly}
                          onFocus={() => { setPreviewMemberId(selectedProgram.closingPrayerParticipantId ?? null); }}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            handleParticipantSelect("closing_prayer", val);
                          }}>
                          <option value="">Seleccionar oración final…</option>{people(activeMembers)}
                        </select>
                      </label>
                    </div>
                  </>
                )}
              </div>

              <aside className="side" aria-label="Estado del programa">
                <div className="card">
                  <h3>Avance del programa</h3>
                  {meter("Titulares asignados", assigned)}
                  {meter("Elegibilidad revisada", reviewed)}
                  <p className="small-note">Duración total: {elapsed} min</p>
                </div>

                {renderSideHistoryCard()}

                <div className="card stack">
                  {canManage && !readOnly && (
                    <>
                      <button type="button" className="button" disabled={saving} onClick={() => void handleSave("draft")}>
                        <Save size={15} /> {saving ? "Guardando…" : "Guardar borrador"}
                      </button>
                      <button type="button" className="button button-primary" disabled={saving} onClick={() => void handleSave("published")}>
                        <CheckCircle size={15} /> {saving ? "Publicando…" : "Validar y publicar"}
                      </button>
                    </>
                  )}
                  <button type="button" className="button" disabled={generating} onClick={() => void handleGenerateS140()}>
                    <Download size={15} /> {generating ? "Generando…" : "Generar S-140 del bimestre"}
                  </button>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      {/* Modal de crear programa */}
      {isNewProgramModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsNewProgramModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-program-title">
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="new-program-title">Crear nuevo programa</h2>
                <p className="modal-description">Selecciona la fecha y el tipo de semana para inicializar el borrador.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsNewProgramModalOpen(false)} aria-label="Cerrar modal"><X size={17} /></button>
            </div>
            <form onSubmit={handleCreateNewProgram}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="field-label" htmlFor="meetingDate">Fecha de la reunión *</label>
                  <input id="meetingDate" className="field" type="date" required value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} autoFocus />
                </div>
                <div className="form-field full">
                  <label className="field-label" htmlFor="weekType">Tipo de semana</label>
                  <select id="weekType" className="select-field" value={newWeekType} onChange={(e) => setNewWeekType(e.target.value as WeekType)}>
                    <option value="normal">Semana normal</option>
                    <option value="circuit_overseer">Visita del superintendente de circuito</option>
                    <option value="assembly">Asamblea</option>
                    <option value="memorial">Conmemoración</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button" onClick={() => setIsNewProgramModalOpen(false)}>Cancelar</button>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Guardando…" : "Crear programa"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isGuideImportModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !guideImporting) setIsGuideImportModalOpen(false); }}>
          <section className="modal-card" style={{ width: "min(100%, 880px)" }} role="dialog" aria-modal="true" aria-labelledby="guide-import-title">
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="guide-import-title">Importar guía de actividades</h2>
                <p className="modal-description">La nueva guía reemplaza la anterior. Sus semanas, estructura, títulos, duraciones, lectura bíblica y canciones definirán los borradores y el S-140; los programas publicados se conservan.</p>
              </div>
              <button type="button" className="icon-button" disabled={guideImporting} onClick={() => setIsGuideImportModalOpen(false)} aria-label="Cerrar importación"><X size={17} /></button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>
                Selecciona el EPUB original. La guía activa anterior se reemplazará solo después de validar el nuevo archivo. Se crearán borradores para las semanas que falten y se actualizarán los no publicados; los programas publicados y el historial se conservarán.
              </p>
              <div className="form-field">
                <p className="field-label" style={{ margin: "0 0 8px" }}>Guía de actividades (.epub)</p>
                <GuideFilePicker
                  inputId="meeting-guide-file"
                  filename={guideFileName}
                  disabled={guideImporting}
                  onChange={(event) => void handleGuideFileSelected(event)}
                />
              </div>
              {guidePeriodLabel && <p className="guide-period-note"><CheckCircle size={14} /> Período detectado: <strong>{guidePeriodLabel}</strong></p>}
              {guideError && <div className="inline-alert pre" role="alert" style={{ marginTop: 12 }}><AlertTriangle size={15} />{guideError}</div>}
              {guideWeeks.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <strong>{guideWeeks.length} semanas detectadas</strong>
                    <span className="small-note">Vista previa de títulos</span>
                  </div>
                  <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: 8 }}>
                    {guideWeeks.map((week) => (
                      <article key={week.startDate} style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                          <strong>{week.label}</strong>
                          <span className="small-note">{week.weeklyBibleReading}</span>
                        </div>
                        <p style={{ margin: "3px 0 7px", fontSize: 11, color: "var(--color-text-muted)" }}>
                          Canciones: {week.openingSongNumber ?? "—"} · {week.livingSongNumber ?? "—"} · {week.closingSongNumber ?? "—"}
                        </p>
                        {week.assignments.map((assignment) => (
                          <p key={assignment.number} style={{ margin: "3px 0", fontSize: 12 }}>
                            <strong>{assignment.number}. {SECTIONS.find((section) => section.id === assignment.section)?.label ?? assignment.section}:</strong>{" "}
                            {assignment.title}{assignment.scriptureRange ? ` (${assignment.scriptureRange})` : ""} ({assignment.durationMinutes} min.)
                          </p>
                        ))}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button" onClick={() => setIsGuideImportModalOpen(false)} disabled={guideImporting}>Cancelar</button>
              <button type="button" className="button button-primary" onClick={() => void handleApplyGuideImport()} disabled={guideImporting || guideWeeks.length === 0}>
                <Upload size={15} /> {guideImporting ? "Activando guía…" : "Guardar guía y aplicar estructura"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Ventana flotante roja de advertencia para asignación duplicada */}
      <AnimatePresence>
        {pendingDuplicate && (
          <div
            className="warning-modal-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPendingDuplicate(null);
              }
            }}
          >
            <motion.section
              className="warning-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="warning-modal-title"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="warning-modal-header">
                <h2 className="warning-modal-title" id="warning-modal-title">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <span>Advertencia de asignación duplicada</span>
                </h2>
                <button
                  type="button"
                  className="warning-modal-close"
                  onClick={() => setPendingDuplicate(null)}
                  aria-label="Cerrar advertencia"
                  title="Cerrar (X)"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="warning-modal-body">
                <p style={{ margin: 0 }}>
                  <strong>{pendingDuplicate.memberName}</strong> ya tiene una parte asignada este mismo día{selectedProgram ? ` (${longDate(selectedProgram.meetingDate)})` : ""}:
                </p>

                <div className="warning-modal-badge">
                  <span className="warning-badge-role">Asignación actual:</span>
                  <span className="warning-badge-title">{pendingDuplicate.existingPartTitle}</span>
                </div>

                <p className="warning-modal-subtext">
                  {pendingDuplicate.isChairmanAssigningOther ? (
                    <>
                      <strong>Excepción de presidencia:</strong> El presidente de la reunión puede realizar asignaciones adicionales (oraciones, discursos o secciones especiales). Presiona <strong>Aceptar</strong> para confirmar.
                    </>
                  ) : (
                    <>
                      Un participante no debe tener dos asignaciones el mismo día. Si deseas asignarlo de todas formas, presiona <strong>Aceptar</strong>. Para cancelar y elegir a otra persona, presiona <strong>Cancelar</strong> o la <strong>X</strong>.
                    </>
                  )}
                </p>
              </div>

              <div className="warning-modal-footer">
                <button
                  type="button"
                  className="button"
                  onClick={() => setPendingDuplicate(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="warning-btn-accept"
                  onClick={() => {
                    applyAssignment(
                      pendingDuplicate.targetRole,
                      pendingDuplicate.memberId,
                      pendingDuplicate.slotId
                    );
                    setPendingDuplicate(null);
                  }}
                >
                  <CheckCircle size={15} aria-hidden="true" />
                  Aceptar
                </button>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
      {isPasswordDialogOpen && client && (
        <PasswordChangeDialog
          client={client}
          onClose={() => setIsPasswordDialogOpen(false)}
        />
      )}
    </div>
  );
};
