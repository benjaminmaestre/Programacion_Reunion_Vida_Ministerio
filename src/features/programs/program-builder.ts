import type { WeekType } from "@/types/domain";
import type { AssignmentSlotDetail, MeetingProgramDetail } from "./program-types";

export function calculateBimonthCycle(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  const bimonthNumber = Math.ceil(month / 2);
  return `${year}-${bimonthNumber}`;
}

export function calculateHistoryPeriod(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const semester = month <= 6 ? 1 : 2;
  return `${year}-S${semester}`;
}

export function buildDefaultMeetingProgram(
  meetingDate: string,
  weekType: WeekType = "normal",
  bimonthCycle?: string,
  historyPeriod?: string,
): MeetingProgramDetail {
  const programId = crypto.randomUUID();
  const cycle = bimonthCycle || calculateBimonthCycle(meetingDate);
  const period = historyPeriod || calculateHistoryPeriod(meetingDate);

  let defaultSlots: AssignmentSlotDetail[] = [];

  if (weekType === "assembly") {
    defaultSlots = [
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "auxiliary",
        title: "Asamblea de Circuito / Regional (No hay reunión de entre semana)",
        durationMinutes: 0,
        orderIndex: 1,
        isStudentPart: false,
        notes: "Semana de asamblea: no se programan intervenciones ordinarias en la congregación.",
      },
    ];
  } else if (weekType === "memorial") {
    defaultSlots = [
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "auxiliary",
        title: "Conmemoración de la Muerte de Cristo",
        durationMinutes: 60,
        orderIndex: 1,
        isStudentPart: false,
        notes: "Reunión especial de Conmemoración.",
      },
    ];
  } else if (weekType === "circuit_overseer") {
    defaultSlots = [
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Tesoros de la Biblia: Discurso",
        durationMinutes: 10,
        orderIndex: 1,
        isStudentPart: false,
        assignmentType: "treasures_talk",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Busquemos perlas escondidas",
        durationMinutes: 10,
        orderIndex: 2,
        isStudentPart: false,
        assignmentType: "gems",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Lectura de la Biblia",
        durationMinutes: 4,
        orderIndex: 3,
        isStudentPart: true,
        assignmentType: "bible_reading",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "ministers",
        title: "Seamos mejores maestros: Intervención",
        durationMinutes: 15,
        orderIndex: 4,
        isStudentPart: true,
        assignmentType: "conversation",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "living",
        title: "Discurso del Superintendente de Circuito",
        durationMinutes: 30,
        orderIndex: 5,
        isStudentPart: false,
        assignmentType: "living_part",
        notes: "Visita del Superintendente de Circuito: discurso especial de servicio.",
      },
    ];
  } else {
    // Normal week
    defaultSlots = [
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Tesoros de la Biblia: Discurso",
        durationMinutes: 10,
        orderIndex: 1,
        isStudentPart: false,
        assignmentType: "treasures_talk",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Busquemos perlas escondidas",
        durationMinutes: 10,
        orderIndex: 2,
        isStudentPart: false,
        assignmentType: "gems",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "treasures",
        title: "Lectura de la Biblia",
        durationMinutes: 4,
        orderIndex: 3,
        isStudentPart: true,
        assignmentType: "bible_reading",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "ministers",
        title: "Empecemos conversaciones",
        durationMinutes: 3,
        orderIndex: 4,
        isStudentPart: true,
        assignmentType: "conversation",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "ministers",
        title: "Hagamos revisitas",
        durationMinutes: 4,
        orderIndex: 5,
        isStudentPart: true,
        assignmentType: "revisit",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "ministers",
        title: "Hagamos discípulos",
        durationMinutes: 5,
        orderIndex: 6,
        isStudentPart: true,
        assignmentType: "disciples",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "living",
        title: "Nuestra Vida Cristiana: Parte 1",
        durationMinutes: 15,
        orderIndex: 7,
        isStudentPart: false,
        assignmentType: "living_part",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "living",
        title: "Estudio bíblico de la congregación (Conductor)",
        durationMinutes: 30,
        orderIndex: 8,
        isStudentPart: false,
        assignmentType: "bible_study_conductor",
      },
      {
        id: crypto.randomUUID(),
        meetingProgramId: programId,
        section: "living",
        title: "Estudio bíblico de la congregación (Lector)",
        durationMinutes: 30,
        orderIndex: 9,
        isStudentPart: false,
        assignmentType: "bible_study_reader",
      },
    ];
  }

  return {
    id: programId,
    meetingDate,
    weekType,
    bimonthCycle: cycle,
    historyPeriod: period,
    status: "draft",
    updatedAt: new Date().toISOString(),
    slots: defaultSlots,
  };
}
