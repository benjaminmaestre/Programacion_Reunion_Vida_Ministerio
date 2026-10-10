import { Section, WeekType } from '@/types/domain';

export type ProgramStatus = 'draft' | 'under_review' | 'published';

export interface MeetingProgramDetail {
  id: string;
  meetingDate: string; // ISO Date "YYYY-MM-DD"
  weekType: WeekType;
  bimonthCycle: string; // Etiqueta de presentación, p.ej. "2026-1"
  historyPeriod: string; // Etiqueta de presentación, p.ej. "2026-S1"
  weeklyBibleReading?: string; // Lectura semanal indicada en la guía bimestral
  openingSongNumber?: number;
  livingSongNumber?: number;
  closingSongNumber?: number;
  planningCycleId?: string; // UUID real de planning_cycles
  historyPeriodId?: string; // UUID real de history_periods
  chairmanId?: string;
  auxiliaryCounselorId?: string;
  openingPrayerParticipantId?: string;
  closingPrayerParticipantId?: string;
  leadershipReviewConfirmed?: boolean;
  leadershipReviewConfirmedBy?: string;
  leadershipReviewConfirmedAt?: string;
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
  assignmentType?: 'treasures_talk' | 'gems' | 'bible_reading' | 'conversation' | 'revisit' | 'disciples' | 'explain_beliefs' | 'student_talk' | 'living_part' | 'living_needs' | 'bible_study' | 'bible_study_conductor' | 'bible_study_reader';
  primaryParticipantId?: string;
  assistantParticipantId?: string;
  /** Revisión explícita de elegibilidad por un responsable; nunca se infiere automáticamente. */
  eligibilityConfirmed?: boolean;
  eligibilityConfirmedBy?: string;
  eligibilityConfirmedAt?: string;
  isDeleted?: boolean;
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
