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
  const programId = `prog-${meetingDate}-${crypto.randomUUID().slice(0, 8)}`;
  const cycle = bimonthCycle || calculateBimonthCycle(meetingDate);
  const period = historyPeriod || calculateHistoryPeriod(meetingDate);

  const defaultSlots: AssignmentSlotDetail[] = [
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "treasures",
      title: "Tesoros de la Biblia: Discurso",
      durationMinutes: 10,
      orderIndex: 1,
      isStudentPart: false,
      assignmentType: "treasures_talk",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "treasures",
      title: "Busquemos perlas escondidas",
      durationMinutes: 10,
      orderIndex: 2,
      isStudentPart: false,
      assignmentType: "gems",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "treasures",
      title: "Lectura de la Biblia",
      durationMinutes: 4,
      orderIndex: 3,
      isStudentPart: true,
      assignmentType: "bible_reading",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "ministers",
      title: "Empecemos conversaciones",
      durationMinutes: 3,
      orderIndex: 4,
      isStudentPart: true,
      assignmentType: "conversation",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "ministers",
      title: "Hagamos revisitas",
      durationMinutes: 4,
      orderIndex: 5,
      isStudentPart: true,
      assignmentType: "revisit",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "ministers",
      title: "Hagamos discípulos",
      durationMinutes: 5,
      orderIndex: 6,
      isStudentPart: true,
      assignmentType: "disciples",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "living",
      title: "Nuestra Vida Cristiana: Parte 1",
      durationMinutes: 15,
      orderIndex: 7,
      isStudentPart: false,
      assignmentType: "living_part",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "living",
      title: "Estudio bíblico de la congregación (Conductor)",
      durationMinutes: 30,
      orderIndex: 8,
      isStudentPart: false,
      assignmentType: "bible_study_conductor",
    },
    {
      id: `slot-${crypto.randomUUID().slice(0, 8)}`,
      meetingProgramId: programId,
      section: "living",
      title: "Estudio bíblico de la congregación (Lector)",
      durationMinutes: 30,
      orderIndex: 9,
      isStudentPart: false,
      assignmentType: "bible_study_reader",
    },
  ];

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
