"use client";

import React, { useState } from "react";
import { MeetingProgramDetail, AssignmentSlotDetail } from "./program-types";
import { DEMO_PROGRAMS, DEMO_BIMONTHLY_PLANS } from "./programs-demo-data";
import { DEMO_MEMBERS } from "../members/demo-data";
import { S38SRulesEngine } from "@/domain/rules/s38s-engine";
import { Calendar, Clock, AlertTriangle, CheckCircle, Save, FileSpreadsheet, User, ShieldAlert, ArrowLeft } from "lucide-react";

export const ProgramsWorkspace: React.FC = () => {
  const [programs, setPrograms] = useState<MeetingProgramDetail[]>(DEMO_PROGRAMS);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>("prog-2026-11-02");
  const [activeTab, setActiveTab] = useState<"bimonthly" | "editor">("editor");

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Calcula si faltan menos de 3 semanas para la entrega
  const getDeadlineAlert = (dateStr: string) => {
    const meetingDate = new Date(dateStr);
    const today = new Date();
    const diffTime = meetingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 21 && diffDays >= 0) {
      return { isAlert: true, daysLeft: diffDays, message: `⚠️ Atención: Quedan ${diffDays} días (${Math.ceil(diffDays / 7)} semanas). Las asignaciones deben entregarse con al menos 3 semanas de antelación.` };
    }
    return { isAlert: false, daysLeft: diffDays, message: "OK: Plazo con más de 3 semanas de antelación." };
  };

  const handleUpdateParticipant = (slotId: string, role: "primary" | "assistant", participantId: string) => {
    if (!selectedProgram) return;

    const updatedSlots = selectedProgram.slots.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          [role === "primary" ? "primaryParticipantId" : "assistantParticipantId"]: participantId || undefined,
        };
      }
      return slot;
    });

    const updatedProgram = { ...selectedProgram, slots: updatedSlots, updatedAt: new Date().toISOString() };
    setPrograms(programs.map((p) => (p.id === selectedProgramId ? updatedProgram : p)));
  };

  const handleUpdateTitle = (slotId: string, title: string) => {
    if (!selectedProgram) return;

    const updatedSlots = selectedProgram.slots.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          title,
        };
      }
      return slot;
    });

    const updatedProgram = { ...selectedProgram, slots: updatedSlots, updatedAt: new Date().toISOString() };
    setPrograms(programs.map((p) => (p.id === selectedProgramId ? updatedProgram : p)));
  };

  const [publishError, setPublishError] = useState("");

  const handleSaveStatus = (status: "draft" | "published") => {
    if (!selectedProgram) return;
    setPublishError("");

    if (status === "published") {
      // Validar si existen errores bloqueantes S-38-S
      let hasBlockingErrors = false;
      for (const slot of selectedProgram.slots) {
        const primary = DEMO_MEMBERS.find((m) => m.id === slot.primaryParticipantId);
        if (primary) {
          const fullEligibility = {
            memberId: primary.id,
            canDoTreasuresTalk: primary.appointment !== "none",
            canDoGems: primary.appointment !== "none",
            canDoBibleReading: primary.gender === "male",
            canDoStudentTalk: true,
            canBeAssistant: true,
            canDoLivingPart: primary.gender === "male",
            canConductCongregationBibleStudy: primary.appointment === "elder",
            canReadCongregationBibleStudy: primary.gender === "male",
            canBeChairman: primary.appointment === "elder",
            canBeAuxiliaryCounselor: primary.appointment === "elder",
          };

          let res = null;
          if (slot.assignmentType === "treasures_talk") {
            res = S38SRulesEngine.validateTreasuresTalk(primary, fullEligibility);
          } else if (slot.assignmentType === "gems") {
            res = S38SRulesEngine.validateGems(primary, fullEligibility);
          } else if (slot.assignmentType === "bible_reading") {
            res = S38SRulesEngine.validateBibleReading(primary, fullEligibility);
          }
          if (res && !res.isValid) {
            hasBlockingErrors = true;
            break;
          }
        }
      }

      if (hasBlockingErrors) {
        setPublishError("No se puede publicar el programa porque contiene violaciones bloqueantes del reglamento S-38-S.");
        return;
      }
    }

    const updatedProgram = { ...selectedProgram, status, updatedAt: new Date().toISOString() };
    setPrograms(programs.map((p) => (p.id === selectedProgramId ? updatedProgram : p)));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Programación Bimestral Vida y Ministerio
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de programas de reuniones, validación del motor S-38-S y alertas de plazo de 3 semanas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("bimonthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "bimonthly" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            Ciclos Bimestrales
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "editor" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            Editor de Reunión
          </button>
        </div>
      </div>

      {/* Tab: Ciclos Bimestrales */}
      {activeTab === "bimonthly" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEMO_BIMONTHLY_PLANS.map((plan) => (
            <div key={plan.label} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{plan.label}</h3>
                  <span className="text-xs text-slate-500">Año {plan.year} • Ciclo {plan.bimonthNumber}</span>
                </div>
                {plan.isPublished ? (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Publicado
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> En Preparación
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-base">{plan.totalMeetings}</div>
                  <div className="text-slate-500">Reuniones</div>
                </div>
                <div>
                  <div className="font-bold text-amber-600 text-base">{plan.draftMeetings}</div>
                  <div className="text-slate-500">Borradores</div>
                </div>
                <div>
                  <div className="font-bold text-emerald-600 text-base">{plan.publishedMeetings}</div>
                  <div className="text-slate-500">Listas</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTab("editor");
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                Abrir Planificación
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Editor de Reunión */}
      {activeTab === "editor" && selectedProgram && (
        <div className="space-y-6">
          {/* Selector de Fecha de Reunión y Alerta de Plazo */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha de Reunión:</label>
              <input
                type="date"
                value={selectedProgram.meetingDate}
                onChange={(e) => {
                  const p = programs.find((pr) => pr.meetingDate === e.target.value);
                  if (p) setSelectedProgramId(p.id);
                }}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <span className={`px-2 py-1 text-xs font-semibold rounded ${selectedProgram.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {selectedProgram.status === 'published' ? 'Publicado' : 'Borrador'}
              </span>
            </div>

            {/* Alerta de Plazo de 3 Semanas */}
            {(() => {
              const deadline = getDeadlineAlert(selectedProgram.meetingDate);
              return (
                <div className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${deadline.isAlert ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {deadline.isAlert ? <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                  <span>{deadline.message}</span>
                </div>
              );
            })()}
          </div>

          {/* Tabla / Lista de Intervenciones con Validación S-38-S en Vivo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Intervenciones de la Reunion</h2>
              <span className="text-xs text-slate-500">Duración estimada total: 1h 45m</span>
            </div>

            {selectedProgram.slots.map((slot) => {
              const primaryMember = DEMO_MEMBERS.find((m) => m.id === slot.primaryParticipantId);
              const assistantMember = DEMO_MEMBERS.find((m) => m.id === slot.assistantParticipantId);

              // Ejecutar validación S-38-S si hay participante asignado
              let validationRes = null;
              if (primaryMember) {
                const fullEligibility = {
                  memberId: primaryMember.id,
                  canDoTreasuresTalk: primaryMember.appointment !== "none",
                  canDoGems: primaryMember.appointment !== "none",
                  canDoBibleReading: primaryMember.gender === "male",
                  canDoStudentTalk: true,
                  canBeAssistant: true,
                  canDoLivingPart: primaryMember.gender === "male",
                  canConductCongregationBibleStudy: primaryMember.appointment === "elder",
                  canReadCongregationBibleStudy: primaryMember.gender === "male",
                  canBeChairman: primaryMember.appointment === "elder",
                  canBeAuxiliaryCounselor: primaryMember.appointment === "elder",
                };

                if (slot.assignmentType === "treasures_talk") {
                  validationRes = S38SRulesEngine.validateTreasuresTalk(primaryMember, fullEligibility);
                } else if (slot.assignmentType === "gems") {
                  validationRes = S38SRulesEngine.validateGems(primaryMember, fullEligibility);
                } else if (slot.assignmentType === "bible_reading") {
                  validationRes = S38SRulesEngine.validateBibleReading(primaryMember, fullEligibility);
                } else if (slot.assignmentType === "living_needs") {
                  validationRes = S38SRulesEngine.validateLivingNeeds(primaryMember);
                } else if (slot.assistantParticipantId && assistantMember) {
                  validationRes = S38SRulesEngine.validateAssistant(primaryMember, assistantMember, []);
                }
              }

              return (
                <div key={slot.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {slot.durationMinutes} min
                      </span>
                      <input
                        type="text"
                        value={slot.title}
                        onChange={(e) => handleUpdateTitle(slot.id, e.target.value)}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex-1 font-semibold"
                        title="Título de la intervención (editable según la Guía de actividades)"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Selector Titular */}
                      <select
                        value={slot.primaryParticipantId || ""}
                        onChange={(e) => handleUpdateParticipant(slot.id, "primary", e.target.value)}
                        className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Seleccionar Titular --</option>
                        {DEMO_MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.firstName} {m.lastName} ({m.gender === "male" ? "Hno" : "Hna"})
                          </option>
                        ))}
                      </select>

                      {/* Selector Ayudante (Si aplica) */}
                      {slot.isStudentPart && (
                        <select
                          value={slot.assistantParticipantId || ""}
                          onChange={(e) => handleUpdateParticipant(slot.id, "assistant", e.target.value)}
                          className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          <option value="">-- Seleccionar Ayudante --</option>
                          {DEMO_MEMBERS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.firstName} {m.lastName} ({m.gender === "male" ? "Hno" : "Hna"})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Ficha contextual de validación S-38-S */}
                  {validationRes && (
                    <div className="text-xs space-y-1 pl-3 border-l-2 border-slate-300 dark:border-slate-700">
                      {validationRes.errors.map((err, idx) => (
                        <div key={idx} className="text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                      {validationRes.warnings.map((warn, idx) => (
                        <div key={idx} className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{warn}</span>
                        </div>
                      ))}
                      {validationRes.isValid && validationRes.warnings.length === 0 && (
                        <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Validación S-38-S correcta</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {publishError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2" role="alert">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{publishError}</span>
            </div>
          )}

          {/* Acciones de Guardado y Publicación */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => handleSaveStatus("draft")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" /> Guardar Borrador
            </button>

            <button
              onClick={() => handleSaveStatus("published")}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Aprobar y Publicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
