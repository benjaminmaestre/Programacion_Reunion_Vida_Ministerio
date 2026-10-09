import { Member, MemberEligibility, FamilyRelationship, ValidationResult } from '@/types/domain';

/**
 * MOTOR DE REGLAS S-38-S
 *
 * Basado en las instrucciones oficiales "Instrucciones para la reunión Vida y Ministerio Cristianos" (S-38-S).
 * Cada regla cita el párrafo / sección correspondiente.
 */

export class S38SRulesEngine {
  /**
   * Discurso de Tesoros de la Biblia (10 min) — S-38-S Párrafo 3
   * "Debe asignarse a un anciano o a un siervo ministerial competente."
   */
  static validateTreasuresTalk(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('[S-38-S Pár. 3] El discurso de Tesoros de la Biblia debe ser presentado por un varón.');
    }

    if (primary.appointment !== 'elder' && primary.appointment !== 'ministerial_servant') {
      errors.push('[S-38-S Pár. 3] El discurso de Tesoros debe asignarse exclusivamente a un anciano o siervo ministerial.');
    }

    if (!eligibility.canDoTreasuresTalk) {
      warnings.push('[Revisión Humana Requerida] El participante no tiene confirmada la habilitación explícita para el discurso de Tesoros por el cuerpo de ancianos.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Busquemos perlas escondidas (10 min) — S-38-S Párrafo 4
   * "Debe asignarse a un anciano o a un siervo ministerial competente."
   */
  static validateGems(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('[S-38-S Pár. 4] La sección de Busquemos perlas escondidas debe ser presentada por un varón.');
    }

    if (primary.appointment !== 'elder' && primary.appointment !== 'ministerial_servant') {
      errors.push('[S-38-S Pár. 4] Busquemos perlas escondidas debe asignarse a un anciano o siervo ministerial.');
    }

    if (!eligibility.canDoGems) {
      warnings.push('[Revisión Humana Requerida] El participante no tiene habilitada formalmente la conducción de Perlas Escondidas.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Lectura de la Biblia (4 min) — S-38-S Párrafo 5
   * "Debe asignarse a un estudiante varón."
   */
  static validateBibleReading(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('[S-38-S Pár. 5] La lectura de la Biblia debe asignarse a un estudiante varón.');
    }

    if (!eligibility.canDoBibleReading) {
      warnings.push('[Revisión Humana Requerida] El estudiante no tiene habilitada la asignación de Lectura de la Biblia.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Discurso de estudiante — S-38-S Párrafo 11
   * "Debe asignarse a un estudiante varón."
   */
  static validateStudentTalk(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('[S-38-S Pár. 11] El discurso de estudiante debe ser presentado por un estudiante varón.');
    }

    if (!eligibility.canDoStudentTalk) {
      warnings.push('[Revisión Humana Requerida] El estudiante no tiene habilitada la asignación de discurso.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Necesidades de la congregación — S-38-S Párrafo 15
   * "Debe estar a cargo de un anciano."
   */
  static validateLivingNeeds(primary: Member): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      errors.push('[S-38-S Pár. 15] La parte de Necesidades de la congregación debe estar siempre a cargo de un anciano.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Estudio Bíblico de la Congregación (Conductor) — S-38-S Párrafo 17
   * "Debe dirigirlo un anciano capacitado designado por el cuerpo de ancianos."
   */
  static validateBibleStudyConductor(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      errors.push('[S-38-S Pár. 17] El Estudio Bíblico de la Congregación debe ser dirigido por un anciano.');
    }

    if (!eligibility.canConductCongregationBibleStudy) {
      warnings.push('[Revisión Humana Requerida] El anciano no tiene la asignación confirmada por el cuerpo de ancianos para dirigir el Estudio Bíblico.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Estudio Bíblico de la Congregación (Lector) — S-38-S Párrafo 17
   * "Debe asignarse a un hermano capacitado."
   */
  static validateBibleStudyReader(primary: Member, eligibility: MemberEligibility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.gender !== 'male') {
      errors.push('[S-38-S Pár. 17] El lector del Estudio Bíblico de la Congregación debe ser un varón.');
    }

    if (!eligibility.canReadCongregationBibleStudy) {
      warnings.push('[Revisión Humana Requerida] El hermano no tiene habilitada formalmente la lectura del Estudio Bíblico.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Presidente de la reunión — S-38-S Párrafo 2 & Excepción de pocos ancianos
   */
  static validateChairman(primary: Member, eligibility: MemberEligibility, totalEldersCount: number = 5): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (primary.appointment !== 'elder') {
      if (totalEldersCount < 3) {
        warnings.push('[S-38-S Excepción] Congregación con pocos ancianos: se asigna a un siervo ministerial capacitado.');
      } else {
        errors.push('[S-38-S Pár. 2] El presidente de la reunión debe ser un anciano.');
      }
    }

    if (!eligibility.canBeChairman) {
      warnings.push('[Revisión Humana Requerida] El hermano no tiene confirmada la habilitación como Presidente por el cuerpo de ancianos.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validación de Ayudantes en Seamos Mejores Maestros — S-38-S Párrafos 6-10
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

    // S-38-S Párrafos 7 y 8: Hagamos revisitas y Hagamos discípulos -> ayudante estrictamente del mismo sexo.
    const requiresStrictSameGender = assignmentType === 'revisit' || assignmentType === 'disciples';

    if (requiresStrictSameGender) {
      if (!isSameGender) {
        errors.push(`[S-38-S Pár. 7-8] Para la asignación de ${assignmentType}, el ayudante debe ser estrictamente del mismo sexo que el estudiante.`);
      }
    } else {
      // S-38-S Párrafos 6 y 10: Empecemos conversaciones y Expliquemos creencias -> mismo sexo o familiar directo.
      if (!isSameGender && !isFamily) {
        errors.push('[S-38-S Pár. 6, 10] El ayudante debe ser del mismo sexo que el estudiante o un familiar directo (cónyuge, padre/madre, hijo/hija, hermano/hermana).');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
