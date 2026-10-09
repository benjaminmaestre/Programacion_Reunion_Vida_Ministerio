import { Section, WeekType } from '@/types/domain';

export type ProgramStatus = 'draft' | 'under_review' | 'published';

export interface MeetingProgramDetail {
  id: string;
  meetingDate: string; // ISO Date "YYYY-MM-DD"
  weekType: WeekType;
  bimonthCycle: string; // p.ej. "2026-1" (Enero-Febrero 2026)
  historyPeriod: string; // p.ej. "2026-S1" (1 de enero a 30 de junio de 2026)
  chairmanId?: string;
  auxiliaryCounselorId?: string;
  circuitOverseerTalkTitle?: string;
  status: ProgramStatus;
  notes?: string;
  slots: AssignmentSlotDetail[];
  updatedAt: string;
}

export interface AssignmentSlotDetail {
  id: string;
  meetingProgramId: string;
  section: Section;
  title: string;
  durationMinutes: number;
  orderIndex: number;
  isStudentPart: boolean;
  assignmentType?: 'treasures_talk' | 'gems' | 'bible_reading' | 'conversation' | 'revisit' | 'disciples' | 'explain_beliefs' | 'student_talk' | 'living_part' | 'living_needs' | 'bible_study_conductor' | 'bible_study_reader';
  primaryParticipantId?: string;
  assistantParticipantId?: string;
  notes?: string;
}

export interface BimonthlyPlanSummary {
  year: number;
  bimonthNumber: number; // 1 a 6
  label: string; // p.ej. "Noviembre - Diciembre 2026"
  isPublished: boolean;
  totalMeetings: number;
  draftMeetings: number;
  publishedMeetings: number;
}
