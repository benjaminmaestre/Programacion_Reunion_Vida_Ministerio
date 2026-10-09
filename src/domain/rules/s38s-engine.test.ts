import { describe, it, expect } from 'vitest';
import { S38SRulesEngine } from './s38s-engine';
import { Member, MemberEligibility, FamilyRelationship } from '@/types/domain';

const mockElderMale: Member = {
  id: 'elder-1',
  firstName: 'Juan',
  lastName: 'Pérez',
  gender: 'male',
  appointment: 'elder',
  isActive: true,
  isBaptized: true,
};

const mockMSMale: Member = {
  id: 'ms-1',
  firstName: 'Carlos',
  lastName: 'Gómez',
  gender: 'male',
  appointment: 'ministerial_servant',
  isActive: true,
  isBaptized: true,
};

const mockPublisherMale: Member = {
  id: 'pub-male-1',
  firstName: 'Pedro',
  lastName: 'Martínez',
  gender: 'male',
  appointment: 'none',
  isActive: true,
  isBaptized: true,
};

const mockPublisherFemale: Member = {
  id: 'pub-female-1',
  firstName: 'María',
  lastName: 'Pérez',
  gender: 'female',
  appointment: 'none',
  isActive: true,
  isBaptized: true,
};

const mockEligibilityFull: MemberEligibility = {
  memberId: 'elder-1',
  canDoTreasuresTalk: true,
  canDoGems: true,
  canDoBibleReading: true,
  canDoStudentTalk: true,
  canBeAssistant: true,
  canDoLivingPart: true,
  canConductCongregationBibleStudy: true,
  canReadCongregationBibleStudy: true,
  canBeChairman: true,
  canBeAuxiliaryCounselor: true,
};

const mockEligibilityUnconfirmed: MemberEligibility = {
  memberId: 'pub-male-1',
  canDoTreasuresTalk: false,
  canDoGems: false,
  canDoBibleReading: false,
  canDoStudentTalk: false,
  canBeAssistant: true,
  canDoLivingPart: false,
  canConductCongregationBibleStudy: false,
  canReadCongregationBibleStudy: false,
  canBeChairman: false,
  canBeAuxiliaryCounselor: false,
};

describe('S38SRulesEngine Unit Tests', () => {
  describe('Discurso de Tesoros de la Biblia (Párrafo 3)', () => {
    it('debe aceptar a un anciano o siervo ministerial varón', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockElderMale, mockEligibilityFull);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('debe rechazar a un publicador no nombrado', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockPublisherMale, mockEligibilityFull);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('anciano o siervo ministerial');
    });

    it('debe generar advertencia de revisión humana si la habilitación no está confirmada', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockMSMale, mockEligibilityUnconfirmed);
      expect(res.isValid).toBe(true);
      expect(res.warnings[0]).toContain('Revisión Humana Requerida');
    });
  });

  describe('Lectura de la Biblia (Párrafo 5)', () => {
    it('debe aceptar a un estudiante varón', () => {
      const res = S38SRulesEngine.validateBibleReading(mockPublisherMale, mockEligibilityFull);
      expect(res.isValid).toBe(true);
    });

    it('debe rechazar a una hermana', () => {
      const res = S38SRulesEngine.validateBibleReading(mockPublisherFemale, mockEligibilityFull);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('estudiante varón');
    });
  });

  describe('Necesidades de la congregación (Párrafo 15)', () => {
    it('debe exigir que el participante sea anciano', () => {
      const resPass = S38SRulesEngine.validateLivingNeeds(mockElderMale);
      expect(resPass.isValid).toBe(true);

      const resFail = S38SRulesEngine.validateLivingNeeds(mockMSMale);
      expect(resFail.isValid).toBe(false);
      expect(resFail.errors[0]).toContain('anciano');
    });
  });

  describe('Validación de Ayudantes (Párrafos 6-10)', () => {
    it('debe rechazar al titular como su propio ayudante', () => {
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockPublisherFemale, []);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('no pueden ser la misma persona');
    });

    it('debe permitir ayudante de distinto sexo si son familiares en "Empecemos conversaciones"', () => {
      const familyRel: FamilyRelationship[] = [
        { memberId: mockElderMale.id, relatedMemberId: mockPublisherFemale.id, relationshipType: 'spouse' },
      ];
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockElderMale, familyRel, 'conversation');
      expect(res.isValid).toBe(true);
    });

    it('debe rechazar ayudante de distinto sexo aun siendo familiar en "Hagamos revisitas"', () => {
      const familyRel: FamilyRelationship[] = [
        { memberId: mockElderMale.id, relatedMemberId: mockPublisherFemale.id, relationshipType: 'spouse' },
      ];
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockElderMale, familyRel, 'revisit');
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('estrictamente del mismo sexo');
    });
  });
});
