export type Gender = 'male' | 'female';
export type Appointment = 'none' | 'ministerial_servant' | 'elder';
export type Section = 'treasures' | 'ministers' | 'living' | 'auxiliary';
export type WeekType = 'normal' | 'circuit_overseer' | 'assembly' | 'memorial';

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  appointment: Appointment;
  isActive: boolean;
  isBaptized: boolean;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface MemberEligibility {
  memberId: string;
  canDoTreasuresTalk: boolean;
  canDoGems: boolean;
  canDoBibleReading: boolean;
  canDoStudentTalk: boolean;
  canBeAssistant: boolean;
  canDoLivingPart: boolean;
  canConductCongregationBibleStudy: boolean;
  canReadCongregationBibleStudy: boolean;
  canBeChairman: boolean;
  canBeAuxiliaryCounselor: boolean;
}

export interface FamilyRelationship {
  memberId: string;
  relatedMemberId: string;
  relationshipType: 'spouse' | 'parent' | 'child' | 'sibling';
}

export interface AssignmentSlot {
  id: string;
  meetingProgramId: string;
  section: Section;
  title: string;
  durationMinutes: number;
  orderIndex: number;
  isStudentPart: boolean;
  primaryParticipantId?: string;
  assistantParticipantId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
