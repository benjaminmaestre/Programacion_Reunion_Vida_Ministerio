export interface MemberFormInput {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  appointment: 'none' | 'ministerial_servant' | 'elder';
  isBaptized: boolean;
  phone?: string;
  email?: string;
  notes?: string;
  eligibilities: {
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
  };
}

export const defaultMemberEligibilities = (gender: 'male' | 'female', appointment: 'none' | 'ministerial_servant' | 'elder') => ({
  canDoTreasuresTalk: gender === 'male' && appointment !== 'none',
  canDoGems: gender === 'male' && appointment !== 'none',
  canDoBibleReading: gender === 'male',
  canDoStudentTalk: true,
  canBeAssistant: true,
  canDoLivingPart: gender === 'male',
  canConductCongregationBibleStudy: appointment === 'elder',
  canReadCongregationBibleStudy: gender === 'male',
  canBeChairman: appointment === 'elder',
  canBeAuxiliaryCounselor: appointment === 'elder',
});
