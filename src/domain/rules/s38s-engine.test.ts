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

const mockEligibilityConfirmed: MemberEligibility = {
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

describe('S38SRulesEngine Unit Tests - Cobertura Completa', () => {
  describe('1. Discurso de Tesoros de la Biblia (Párrafo 3)', () => {
    it('debe aceptar a un anciano con habilitación confirmada', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockElderMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });

    it('debe rechazar a un publicador no nombrado', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockPublisherMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('anciano o siervo ministerial');
    });

    it('debe generar advertencia de revisión humana si la habilitación no está confirmada explícitamente', () => {
      const res = S38SRulesEngine.validateTreasuresTalk(mockMSMale, mockEligibilityUnconfirmed);
      expect(res.isValid).toBe(true);
      expect(res.warnings[0]).toContain('Revisión Humana Requerida');
    });
  });

  describe('2. Busquemos perlas escondidas (Párrafo 4)', () => {
    it('debe aceptar a un siervo ministerial con habilitación confirmada', () => {
      const res = S38SRulesEngine.validateGems(mockMSMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('debe rechazar a un publicador o hermana', () => {
      const res = S38SRulesEngine.validateGems(mockPublisherFemale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('presentada por un varón');
    });
  });

  describe('3. Lectura de la Biblia (Párrafo 5)', () => {
    it('debe aceptar a un estudiante varón', () => {
      const res = S38SRulesEngine.validateBibleReading(mockPublisherMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(true);
    });

    it('debe rechazar a una hermana para la lectura de la Biblia', () => {
      const res = S38SRulesEngine.validateBibleReading(mockPublisherFemale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('estudiante varón');
    });
  });

  describe('4. Necesidades de la congregación (Párrafo 15)', () => {
    it('debe exigir anciano estrictamente', () => {
      const resPass = S38SRulesEngine.validateLivingNeeds(mockElderMale);
      expect(resPass.isValid).toBe(true);

      const resFail = S38SRulesEngine.validateLivingNeeds(mockMSMale);
      expect(resFail.isValid).toBe(false);
      expect(resFail.errors[0]).toContain('anciano');
    });
  });

  describe('5. Estudio Bíblico de la Congregación (Párrafo 17)', () => {
    it('debe validar que el conductor sea anciano capacitado', () => {
      const res = S38SRulesEngine.validateBibleStudyConductor(mockElderMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(true);

      const resFail = S38SRulesEngine.validateBibleStudyConductor(mockMSMale, mockEligibilityConfirmed);
      expect(resFail.isValid).toBe(false);
    });

    it('debe validar que el lector sea un hermano capacitado', () => {
      const res = S38SRulesEngine.validateBibleStudyReader(mockPublisherMale, mockEligibilityConfirmed);
      expect(res.isValid).toBe(true);

      const resFail = S38SRulesEngine.validateBibleStudyReader(mockPublisherFemale, mockEligibilityConfirmed);
      expect(resFail.isValid).toBe(false);
    });
  });

  describe('6. Presidencia de la reunión (Párrafo 2)', () => {
    it('debe aceptar a un anciano en congregaciones normales', () => {
      const res = S38SRulesEngine.validateChairman(mockElderMale, mockEligibilityConfirmed, 5);
      expect(res.isValid).toBe(true);
    });

    it('debe rechazar a un siervo ministerial si hay suficientes ancianos (>= 3)', () => {
      const res = S38SRulesEngine.validateChairman(mockMSMale, mockEligibilityConfirmed, 5);
      expect(res.isValid).toBe(false);
    });

    it('debe permitir a un siervo ministerial con advertencia si hay menos de 3 ancianos (excepción)', () => {
      const res = S38SRulesEngine.validateChairman(mockMSMale, mockEligibilityConfirmed, 2);
      expect(res.isValid).toBe(true);
      expect(res.warnings[0]).toContain('Congregación con pocos ancianos');
    });
  });

  describe('7. Validación de Ayudantes por Tipo de Asignación (Párrafos 6-10)', () => {
    it('debe rechazar titular como su propio ayudante', () => {
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockPublisherFemale, []);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('no pueden ser la misma persona');
    });

    it('debe permitir ayudante cónyuge de distinto sexo en Empecemos conversaciones', () => {
      const familyRel: FamilyRelationship[] = [
        { memberId: mockElderMale.id, relatedMemberId: mockPublisherFemale.id, relationshipType: 'spouse' },
      ];
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockElderMale, familyRel, 'conversation');
      expect(res.isValid).toBe(true);
    });

    it('debe rechazar ayudante cónyuge de distinto sexo en Hagamos revisitas (estrictamente mismo sexo)', () => {
      const familyRel: FamilyRelationship[] = [
        { memberId: mockElderMale.id, relatedMemberId: mockPublisherFemale.id, relationshipType: 'spouse' },
      ];
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockElderMale, familyRel, 'revisit');
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('estrictamente del mismo sexo');
    });

    it('debe rechazar ayudante cónyuge de distinto sexo en Hagamos discípulos (estrictamente mismo sexo)', () => {
      const familyRel: FamilyRelationship[] = [
        { memberId: mockElderMale.id, relatedMemberId: mockPublisherFemale.id, relationshipType: 'spouse' },
      ];
      const res = S38SRulesEngine.validateAssistant(mockPublisherFemale, mockElderMale, familyRel, 'disciples');
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('estrictamente del mismo sexo');
    });
  });
});
