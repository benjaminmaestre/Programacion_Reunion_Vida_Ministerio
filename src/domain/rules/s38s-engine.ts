import { Member, MemberEligibility, FamilyRelationship, ValidationResult } from '@/types/domain';

export class S38SRulesEngine {
  /**
   * Valida la asignación del Discurso de Tesoros de la Biblia (10 min)
   */
  static validateTreasuresTalk(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('El discurso de Tesoros debe ser presentado por un varón.');
    }

    if (primary.appointment !== 'elder' && primary.appointment !== 'ministerial_servant') {
      errors.push('El discurso de Tesoros debe asignarse a un anciano o siervo ministerial.');
    }

    if (!eligibility.canDoTreasuresTalk) {
      warnings.push('El participante no tiene confirmada la habilitación para discurso de Tesoros.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Valida la asignación de Lectura de la Biblia (4 min)
   */
  static validateBibleReading(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('La lectura de la Biblia debe ser asignada a un estudiante varón.');
    }

    if (!eligibility.canDoBibleReading) {
      warnings.push('El estudiante no tiene habilitada la asignación de Lectura de la Biblia.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Valida la relación del ayudante (Mismo sexo o familiar directo)
   */
  static validateAssistant(
    primary: Member,
    assistant: Member,
    relationships: FamilyRelationship[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.id === assistant.id) {
      errors.push('El titular y el ayudante no pueden ser la misma persona.');
    }

    const isSameGender = primary.gender === assistant.gender;
    const isFamily = relationships.some(
      (r) =>
        (r.memberId === primary.id && r.relatedMemberId === assistant.id) ||
        (r.memberId === assistant.id && r.relatedMemberId === primary.id)
    );

    if (!isSameGender && !isFamily) {
      errors.push('El ayudante debe ser del mismo sexo que el estudiante o un familiar directo.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
