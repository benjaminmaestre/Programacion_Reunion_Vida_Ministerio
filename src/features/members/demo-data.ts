export type MemberGender = "male" | "female";
export type MemberAppointment = "none" | "ministerial_servant" | "elder";
export type HistoryCategory =
  | "treasures"
  | "gems"
  | "bible-reading"
  | "conversation"
  | "revisit"
  | "disciples"
  | "explain-beliefs"
  | "student-talk"
  | "living";

export interface DirectoryMember {
  id: string;
  firstName: string;
  lastName: string;
  gender: MemberGender;
  appointment: MemberAppointment;
  isRegularPioneer?: boolean;
  additionalRoles?: string;
  isActive: boolean;
  isBaptized: boolean | null;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface AssignmentHistoryEntry {
  id: string;
  memberId: string;
  date: string;
  category: HistoryCategory;
  assignment: string;
  participation: "Titular" | "Ayudante" | "Otro participante";
  companionName?: string;
}

export const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  treasures: "Tesoros de la Biblia",
  gems: "Busquemos perlas escondidas",
  "bible-reading": "Lectura de la Biblia",
  conversation: "Empecemos conversaciones",
  revisit: "Hagamos revisitas",
  disciples: "Hagamos discípulos",
  "explain-beliefs": "Expliquemos nuestras creencias",
  "student-talk": "Discurso de estudiante",
  living: "Nuestra vida cristiana",
};

export const CATEGORY_OPTIONS: Array<{ value: "all" | HistoryCategory; label: string }> = [
  { value: "all", label: "Todas las categorías" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value: value as HistoryCategory,
    label,
  })),
];

// Datos ficticios para mostrar el comportamiento de la interfaz.
// No representan a personas reales ni proceden de una congregación.
export const DEMO_MEMBERS: DirectoryMember[] = [
  { id: "demo-001", firstName: "David", lastName: "Morales", gender: "male", appointment: "elder", isRegularPioneer: false, isActive: true, isBaptized: true },
  { id: "demo-002", firstName: "Miguel", lastName: "Ríos", gender: "male", appointment: "ministerial_servant", isRegularPioneer: true, additionalRoles: "Secretario", isActive: true, isBaptized: true },
  { id: "demo-003", firstName: "Andrés", lastName: "Herrera", gender: "male", appointment: "none", isRegularPioneer: false, isActive: true, isBaptized: null },
  { id: "demo-004", firstName: "Laura", lastName: "Vega", gender: "female", appointment: "none", isRegularPioneer: true, isActive: true, isBaptized: true },
  { id: "demo-005", firstName: "Sofía", lastName: "Castro", gender: "female", appointment: "none", isRegularPioneer: false, isActive: true, isBaptized: false },
  { id: "demo-006", firstName: "Carlos", lastName: "Jiménez", gender: "male", appointment: "none", isRegularPioneer: false, isActive: false, isBaptized: null },
];

export const DEMO_HISTORY: AssignmentHistoryEntry[] = [
  { id: "hist-01", memberId: "demo-001", date: "2026-10-07", category: "living", assignment: "Estudio bíblico de la congregación", participation: "Titular" },
  { id: "hist-02", memberId: "demo-001", date: "2026-09-23", category: "treasures", assignment: "Discurso: Tesoros de la Biblia", participation: "Titular" },
  { id: "hist-03", memberId: "demo-002", date: "2026-10-07", category: "gems", assignment: "Busquemos perlas escondidas", participation: "Titular" },
  { id: "hist-04", memberId: "demo-002", date: "2026-09-16", category: "conversation", assignment: "Empecemos conversaciones", participation: "Ayudante", companionName: "Andrés Herrera" },
  { id: "hist-05", memberId: "demo-003", date: "2026-10-07", category: "conversation", assignment: "Empecemos conversaciones", participation: "Titular", companionName: "Miguel Ríos" },
  { id: "hist-06", memberId: "demo-003", date: "2026-08-26", category: "bible-reading", assignment: "Lectura de la Biblia", participation: "Titular" },
  { id: "hist-07", memberId: "demo-004", date: "2026-10-07", category: "revisit", assignment: "Hagamos revisitas", participation: "Titular", companionName: "Sofía Castro" },
  { id: "hist-08", memberId: "demo-004", date: "2026-09-09", category: "conversation", assignment: "Empecemos conversaciones", participation: "Titular", companionName: "Sofía Castro" },
  { id: "hist-09", memberId: "demo-005", date: "2026-10-07", category: "revisit", assignment: "Hagamos revisitas", participation: "Ayudante", companionName: "Laura Vega" },
  { id: "hist-10", memberId: "demo-005", date: "2026-08-19", category: "disciples", assignment: "Hagamos discípulos", participation: "Titular", companionName: "Laura Vega" },
  { id: "hist-11", memberId: "demo-006", date: "2026-07-22", category: "student-talk", assignment: "Discurso de estudiante", participation: "Titular" },
];
