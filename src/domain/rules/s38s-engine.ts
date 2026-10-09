import { Member, MemberEligibility, FamilyRelationship, ValidationResult } from '@/types/domain';

export class S38SRulesEngine {
  /**
   * Discurso de Tesoros de la Biblia (10 min): debe asignarse a un anciano o siervo ministerial competente.
   */
  static validateTreasuresTalk(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('El discurso de Tesoros de la Biblia debe ser presentado por un varón.');
    }

    if (primary.appointment !== 'elder' && primary.appointment !== 'ministerial_servant') {
      errors.push('El discurso de Tesoros debe asignarse a un anciano o siervo ministerial.');
    }

    if (!eligibility.canDoTreasuresTalk) {
      warnings.push('El participante no tiene confirmada la habilitación para discurso de Tesoros por los responsables.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Busquemos perlas escondidas (10 min): debe asignarse a un anciano o siervo ministerial competente.
   */
  static validateGems(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('La sección de Busquemos perlas escondidas debe ser presentada por un varón.');
    }

    if (primary.appointment !== 'elder' && primary.appointment !== 'ministerial_servant') {
      errors.push('Perlas escondidas debe asignarse a un anciano o siervo ministerial.');
    }

    if (!eligibility.canDoGems) {
      warnings.push('El participante no tiene habilitada formalmente la conducción de Perlas Escondidas.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Lectura de la Biblia (4 min): estudiante varón.
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
   * Asignación de estudiante genérica (Discurso de estudiante, etc.)
   */
  static validateStudentTalk(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('El discurso de estudiante debe ser presentado por un varón.');
    }

    if (!eligibility.canDoStudentTalk) {
      warnings.push('El estudiante no tiene habilitada la asignación de discurso de estudiante.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Asignación de Necesidades de la Congregación: anciano.
   */
  static validateLivingNeeds(primary: Member): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      errors.push('La parte de Necesidades de la Congregación debe estar a cargo de un anciano.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Estudio Bíblico de la Congregación (Conductor): anciano capacitado.
   */
  static validateBibleStudyConductor(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      errors.push('El Estudio Bíblico de la Congregación debe ser dirigido por un anciano.');
    }

    if (!eligibility.canConductCongregationBibleStudy) {
      warnings.push('El hermano no tiene confirmada la habilitación para dirigir el Estudio Bíblico de la Congregación.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Estudio Bíblico de la Congregación (Lector): hermano capacitado.
   */
  static validateBibleStudyReader(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('El lector del Estudio Bíblico de la Congregación debe ser un varón.');
    }

    if (!eligibility.canReadCongregationBibleStudy) {
      warnings.push('El estudiante o hermano no tiene habilitada la lectura del Estudio Bíblico.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Presidencia de la reunión: anciano capacitado.
   */
  static validateChairman(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      errors.push('El presidente de la reunión debe ser un anciano (salvo excepciones para congregaciones con muy pocos ancianos).');
    }

    if (!eligibility.canBeChairman) {
      warnings.push('El hermano no tiene habilitada la función de Presidente de la reunión.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Valida la relación del ayudante según las reglas S-38-S:
   * - Empecemos conversaciones: ayudante del mismo sexo o familiar directo.
   * - Hagamos revisitas: ayudante del mismo sexo.
   * - Hagamos discípulos: ayudante del mismo sexo.
   * - Expliquemos nuestras creencias (escenificación): ayudante del mismo sexo o familiar directo.
   */
  static validateAssistant(
    primary: Member,
    assistant: Member,
    relationships: FamilyRelationship[],
    assignmentType: 'conversation' | 'revisit' | 'disciples' | 'explain-beliefs' = 'conversation'
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

    const requiresStrictSameGender = assignmentType === 'revisit' || assignmentType === 'disciples';

    if (requiresStrictSameGender) {
      if (!isSameGender) {
        errors.push(`Para la asignación "${assignmentType}", el ayudante debe ser estrictamente del mismo sexo que el estudiante.`);
      }
    } else {
      if (!isSameGender && !isFamily) {
        errors.push('El ayudante debe ser del mismo sexo que el estudiante o un familiar directo.');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
