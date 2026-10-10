import PizZip from "pizzip";
import type { Section } from "@/types/domain";
import type { AssignmentSlotDetail, MeetingProgramDetail } from "./program-types";

export type GuideAssignmentType =
  | NonNullable<AssignmentSlotDetail["assignmentType"]>
  | "bible_study";

export interface GuideStructureAssignment {
  number: number;
  section: Section;
  title: string;
  durationMinutes: number;
  isStudentPart: boolean;
  assignmentType: GuideAssignmentType;
  scriptureRange?: string;
}

export interface GuideMinistryPart {
  title: string;
  assignmentType: NonNullable<AssignmentSlotDetail["assignmentType"]>;
  durationMinutes: number;
}

export interface MeetingGuideWeek {
  label: string;
  startDate: string;
  endDate: string;
  weeklyBibleReading: string;
  openingSongNumber?: number;
  livingSongNumber?: number;
  closingSongNumber?: number;
  assignments: GuideStructureAssignment[];
  // Convenience properties used by the import preview.
  treasuresTalkTitle: string;
  gemsTitle: string;
  bibleReadingTitle: string;
  ministryParts: GuideMinistryPart[];
  livingTitle: string;
  livingDurationMinutes: number;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};
const DEFAULT_DURATIONS: Record<number, number> = { 1: 10, 2: 10, 3: 4, 4: 3, 5: 4, 6: 5, 7: 15, 8: 30 };

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    if (code.startsWith("#")) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    return named[code.toLowerCase()] ?? whole;
  });
}
function plainText(markup: string): string {
  return decodeEntities(markup
    .replace(/<br\b[^>]*>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\u00a0\u200b\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeForParsing(value: string): string {
  return plainText(value).toLocaleLowerCase("es").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error("La guía contiene una fecha de semana inválida.");
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseWeekRange(label: string, baseYear: number): { startDate: string; endDate: string } | null {
  const text = normalizeForParsing(label);
  const sameMonth = text.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);
  if (sameMonth) {
    const month = MONTHS[sameMonth[3]];
    const year = Number(sameMonth[4] || baseYear);
    if (!month) return null;
    return { startDate: isoDate(year, month, Number(sameMonth[1])), endDate: isoDate(year, month, Number(sameMonth[2])) };
  }
  const across = text.match(/^(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?\s+a\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);
  if (!across) return null;
  const startMonth = MONTHS[across[2]];
  const startYear = Number(across[3] || baseYear);
  const endMonth = MONTHS[across[5]];
  const endYear = Number(across[6] || (endMonth < startMonth ? startYear + 1 : startYear));
  if (!startMonth || !endMonth) return null;
  return {
    startDate: isoDate(startYear, startMonth, Number(across[1])),
    endDate: isoDate(endYear, endMonth, Number(across[4])),
  };
}
function stripDurationAnnotations(value: string): string {
  return value
    .replace(/\s*\(\s*\d{1,2}\s*(?:mins?|minutos?)\.?\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function parseNumberedHeader(headerHtml: string): { number: number; title: string } | null {
  const match = plainText(headerHtml).match(/^(\d+)\.\s*(.+)$/);
  return match ? { number: Number(match[1]), title: stripDurationAnnotations(match[2]) } : null;
}
function extractMinutes(body: string, fallback: number): number {
  const match = plainText(body).match(/\(\s*(\d{1,2})\s*(?:mins?|minutos?)\.?\s*\)/i);
  return match ? Number(match[1]) : fallback;
}
function extractSpeechTitle(body: string, fallback: string): string {
  const match = plainText(body).match(/\bTítulo\s*:\s*["“]?([\s\S]+?)(?=\s*\(\s*(?:th|lmd)\b|$)/i);
  return match?.[1]?.trim().replace(/[.\s]+$/, "").replace(/["”]+$/, "").trim() || fallback;
}
function classifyMinistryType(title: string): NonNullable<AssignmentSlotDetail["assignmentType"]> {
  const normalized = normalizeForParsing(title);
  if (normalized.startsWith("empecemos conversaciones")) return "conversation";
  if (normalized.startsWith("hagamos revisitas")) return "revisit";
  if (normalized.startsWith("hagamos discipulos")) return "disciples";
  if (normalized.startsWith("expliquemos nuestras creencias")) return "explain_beliefs";
  return "student_talk";
}
function extractBibleReadingTitle(body: string): string {
  const text = plainText(body);
  const afterDuration = text.match(/\(\s*\d+\s*(?:mins?|minutos?)\.?\s*\)\s*([^()]+?)(?=\s*\(|$)/i);
  if (afterDuration) return afterDuration[1].trim().replace(/[.\s]+$/, "");

  // In some EPUB layouts, the time is in the heading and the body begins directly
  // with the scripture range (followed by the study lesson reference).
  const withoutDuration = text.match(/^([\s\S]+?)(?=\s*\(\s*(?:th|lmd)\b|$)/i);
  return withoutDuration?.[1]?.trim().replace(/[.\s]+$/, "") ?? "";
}
function sectionFromHeading(value: string): Section | null {
  const text = normalizeForParsing(value);
  if (text.includes("tesoros de la biblia")) return "treasures";
  if (text.includes("seamos mejores maestros")) return "ministers";
  if (text.includes("nuestra vida cristiana")) return "living";
  return null;
}
function extractSongNumber(value: string): number | undefined {
  const match = plainText(value).match(/Canción\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

const GUIDE_MONTH_NAMES: Record<string, string> = {
  enero: "Enero", febrero: "Febrero", marzo: "Marzo", abril: "Abril",
  mayo: "Mayo", junio: "Junio", julio: "Julio", agosto: "Agosto",
  septiembre: "Septiembre", setiembre: "Septiembre", octubre: "Octubre",
  noviembre: "Noviembre", diciembre: "Diciembre",
};

export function getMeetingGuidePeriodLabel(bytes: Uint8Array, filename = "guia.epub"): string {
  let zip: PizZip;
  try { zip = new PizZip(bytes); }
  catch { throw new Error("No se pudo abrir el archivo. Comprueba que sea un EPUB válido."); }
  const opfPath = Object.keys(zip.files).find((name) => /(?:^|\/)content\.opf$/i.test(name));
  if (!opfPath) throw new Error("El archivo no contiene la estructura de una publicación EPUB.");
  const opf = zip.file(opfPath)?.asText() ?? "";
  const metadataTitle = plainText(opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1] ?? "");
  const normalizedTitle = normalizeForParsing(metadataTitle);
  const monthPair = normalizedTitle.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:y|[-–—])\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(20\d{2})\b/);
  if (monthPair) return `${GUIDE_MONTH_NAMES[monthPair[1]]} - ${GUIDE_MONTH_NAMES[monthPair[2]]} ${monthPair[3]}`;

  const filenamePeriod = filename.match(/\b(20\d{2})(0[1-9]|1[0-2])\.epub$/i);
  if (filenamePeriod) {
    const year = Number(filenamePeriod[1]);
    const startMonth = Number(filenamePeriod[2]);
    const endMonth = startMonth % 12 + 1;
    const firstMonth = Object.keys(MONTHS).find((name) => MONTHS[name] === startMonth) ?? "enero";
    const secondMonth = Object.keys(MONTHS).find((name) => MONTHS[name] === endMonth) ?? "febrero";
    if (startMonth === 12) return `${GUIDE_MONTH_NAMES[firstMonth]} ${year} - ${GUIDE_MONTH_NAMES[secondMonth]} ${year + 1}`;
    return `${GUIDE_MONTH_NAMES[firstMonth]} - ${GUIDE_MONTH_NAMES[secondMonth]} ${year}`;
  }
  const year = filename.match(/\b(20\d{2})/i)?.[1];
  if (year) return `Guía de actividades ${year}`;
  throw new Error("No se pudo determinar el período de la guía.");
}

export function parseMeetingGuideEpub(bytes: Uint8Array, filename = "guia.epub"): MeetingGuideWeek[] {
  if (!bytes.length) throw new Error("El archivo EPUB está vacío.");
  let zip: PizZip;
  try { zip = new PizZip(bytes); }
  catch { throw new Error("No se pudo abrir el archivo. Comprueba que sea un EPUB válido."); }
  const fileNames = Object.keys(zip.files);
  const opfPath = fileNames.find((name) => /(?:^|\/)content\.opf$/i.test(name));
  if (!opfPath) throw new Error("El archivo no contiene la estructura de una publicación EPUB.");
  const opf = zip.file(opfPath)?.asText() ?? "";
  const metadataTitle = plainText(opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1] ?? "");
  const baseYear = Number(metadataTitle.match(/\b(20\d{2})\b/)?.[1] || filename.match(/\b(20\d{2})(?:\d{2})?\.epub$/i)?.[1]);
  if (!Number.isInteger(baseYear) || baseYear < 2000 || baseYear > 2200) {
    throw new Error("No se pudo determinar el año de la guía a partir de sus metadatos.");
  }

  const xhtmlFiles = fileNames
    .filter((name) => /(?:^|\/)20\d{7}\.xhtml$/i.test(name) && !/-extracted\.xhtml$/i.test(name))
    .sort();
  const weeks: MeetingGuideWeek[] = [];

  for (const path of xhtmlFiles) {
    const source = zip.file(path)?.asText();
    if (!source) continue;
    const h1 = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (!h1) continue;
    const label = plainText(h1[1]);
    let dates: { startDate: string; endDate: string } | null;
    try { dates = parseWeekRange(label, baseYear); } catch { continue; }
    if (!dates) continue;

    const afterH1 = source.slice((h1.index ?? 0) + h1[0].length);
    const firstH2 = afterH1.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    const weeklyBibleReading = firstH2 ? plainText(firstH2[1]) : "";
    const h2s = [...source.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
    const headers = [...source.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
    const headingTexts = headers.map((entry) => plainText(entry[1]));
    const numbered = new Map<number, {
      title: string; originalHeading: string; body: string; minutes: number; section: Section;
    }>();

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      const parsed = parseNumberedHeader(header[1]);
      if (!parsed) continue;
      const headingPosition = header.index ?? 0;
      let activeSection: Section | null = null;
      for (const h2 of h2s) {
        const h2Position = h2.index ?? 0;
        if (h2Position >= headingPosition) break;
        const mapped = sectionFromHeading(h2[1]);
        if (mapped) activeSection = mapped;
      }
      if (!activeSection) continue;

      const bodyStart = headingPosition + header[0].length;
      const bodyEnd = index + 1 < headers.length ? (headers[index + 1].index ?? source.length) : source.length;
      const body = source.slice(bodyStart, bodyEnd);
      const title = parsed.number === 6 && normalizeForParsing(parsed.title) === "discurso"
        ? extractSpeechTitle(body, parsed.title)
        : parsed.title;
      numbered.set(parsed.number, {
        title,
        originalHeading: parsed.title,
        body,
        section: activeSection,
        minutes: extractMinutes(`${header[1]} ${body}`, DEFAULT_DURATIONS[parsed.number] ?? 5),
      });
    }

    const assignments: GuideStructureAssignment[] = [];
    for (const [number, row] of [...numbered.entries()].sort((a, b) => a[0] - b[0])) {
      const normalizedHeading = normalizeForParsing(row.originalHeading);
      let assignmentType: GuideAssignmentType;
      let title = row.title;
      let scriptureRange: string | undefined;
      let isStudentPart = false;

      if (row.section === "treasures") {
        if (normalizedHeading.includes("busquemos perlas escondidas")) assignmentType = "gems";
        else if (normalizedHeading.startsWith("lectura de la biblia")) {
          assignmentType = "bible_reading";
          scriptureRange = extractBibleReadingTitle(row.body) || undefined;
          title = "Lectura de la Biblia";
          isStudentPart = true;
        } else {
          assignmentType = "treasures_talk";
        }
      } else if (row.section === "ministers") {
        assignmentType = classifyMinistryType(row.originalHeading);
        isStudentPart = true;
      } else if (normalizedHeading.startsWith("estudio biblico de la congregacion")) {
        assignmentType = "bible_study";
      } else {
        assignmentType = normalizedHeading.includes("necesidades de la congregacion")
          ? "living_needs" : "living_part";
      }

      assignments.push({
        number,
        section: row.section,
        title,
        durationMinutes: row.minutes,
        isStudentPart,
        assignmentType,
        ...(scriptureRange ? { scriptureRange } : {}),
      });
    }

    const ministryParts = assignments
      .filter((item) => item.section === "ministers")
      .map((item) => ({
        title: item.title,
        assignmentType: item.assignmentType === "bible_study" ? "student_talk" as const
          : item.assignmentType as NonNullable<AssignmentSlotDetail["assignmentType"]>,
        durationMinutes: item.durationMinutes,
      }));
    const treasuresTalkTitle = assignments.find((item) => item.assignmentType === "treasures_talk")?.title ?? "";
    const gemsTitle = assignments.find((item) => item.assignmentType === "gems")?.title ?? "";
    const bibleReadingTitle = assignments.find((item) => item.assignmentType === "bible_reading")?.scriptureRange ?? "";
    const livingAssignment = assignments.find((item) => item.section === "living" && item.assignmentType !== "bible_study");
    const studyAssignment = assignments.find((item) => item.assignmentType === "bible_study");
    if (!weeklyBibleReading || !treasuresTalkTitle || !gemsTitle || !assignments.some((item) => item.assignmentType === "bible_reading")
      || !ministryParts.length || !livingAssignment || !studyAssignment) {
      continue;
    }

    const firstSong = extractSongNumber(headingTexts[0] ?? "");
    const ministryEndPosition = Math.max(
      ...headers.filter((header) => {
        const parsed = parseNumberedHeader(header[1]);
        return parsed && assignments.some((assignment) => assignment.number === parsed.number && assignment.section === "ministers");
      }).map((header) => header.index ?? 0),
    );
    const livingStartPosition = headers.find((header) => {
      const parsed = parseNumberedHeader(header[1]);
      return parsed && assignments.some((assignment) => assignment.number === parsed.number && assignment.section === "living");
    })?.index ?? Number.POSITIVE_INFINITY;
    const livingSong = headers
      .filter((header) => (header.index ?? 0) > ministryEndPosition && (header.index ?? 0) < livingStartPosition)
      .map((header) => extractSongNumber(header[1]))
      .find((value) => value !== undefined);
    const closingSong = [...headingTexts].reverse()
      .find((text) => /palabras de conclusión/i.test(text) && extractSongNumber(text) !== undefined);
    const closingSongNumber = closingSong ? extractSongNumber(closingSong) : undefined;

    weeks.push({
      label,
      ...dates,
      weeklyBibleReading,
      openingSongNumber: firstSong,
      livingSongNumber: livingSong,
      closingSongNumber,
      assignments,
      treasuresTalkTitle,
      gemsTitle,
      bibleReadingTitle,
      ministryParts,
      livingTitle: livingAssignment.title,
      livingDurationMinutes: livingAssignment.durationMinutes,
    });
  }

  if (!weeks.length) throw new Error("No se encontraron semanas con una estructura de asignaciones reconocible en la guía.");
  return weeks.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Rebuilds assignment rows from the guide while preserving participants by sequence. */
export function applyMeetingGuideTitles(program: MeetingProgramDetail, week: MeetingGuideWeek): MeetingProgramDetail {
  const oldSlots = [...program.slots].sort((a, b) => a.orderIndex - b.orderIndex);
  const usedOldIds = new Set<string>();
  const nextSlots: AssignmentSlotDetail[] = [];
  let nextOrderIndex = 1;
  let contentChanged = false;

  const takeOldSlot = (orderIndex: number, types: string[]) => {
    const exact = oldSlots.find((slot) => !usedOldIds.has(slot.id) && slot.orderIndex === orderIndex);
    const byType = exact ?? oldSlots.find((slot) => !usedOldIds.has(slot.id)
      && types.includes(slot.assignmentType ?? ""));
    if (byType) usedOldIds.add(byType.id);
    return byType;
  };

  const buildSlot = (
    assignment: GuideStructureAssignment,
    type: NonNullable<AssignmentSlotDetail["assignmentType"]>,
    title: string,
    durationMinutes: number,
    orderIndex: number,
    paired: boolean,
  ) => {
    const old = takeOldSlot(assignment.number, [type]);
    const next: AssignmentSlotDetail = {
      id: old?.id ?? crypto.randomUUID(),
      meetingProgramId: program.id,
      section: assignment.section,
      title,
      durationMinutes,
      orderIndex,
      isStudentPart: assignment.isStudentPart,
      assignmentType: type,
      primaryParticipantId: old?.primaryParticipantId,
      assistantParticipantId: paired ? old?.assistantParticipantId : undefined,
      notes: old?.notes,
      eligibilityConfirmed: old?.eligibilityConfirmed === true,
      eligibilityConfirmedBy: old?.eligibilityConfirmedBy,
      eligibilityConfirmedAt: old?.eligibilityConfirmedAt,
    };
    const invalidatesReview = !old || old.title !== next.title || old.assignmentType !== next.assignmentType
      || old.section !== next.section || old.durationMinutes !== next.durationMinutes
      || (old.assistantParticipantId ?? "") !== (next.assistantParticipantId ?? "");
    if (invalidatesReview) {
      next.eligibilityConfirmed = false;
      next.eligibilityConfirmedBy = undefined;
      next.eligibilityConfirmedAt = undefined;
      contentChanged = true;
    }
    if (old?.section !== next.section || (old && old.assignmentType !== next.assignmentType && !paired)) {
      next.primaryParticipantId = undefined;
    }
    nextSlots.push(next);
  };

  for (const assignment of [...week.assignments].sort((a, b) => a.number - b.number)) {
    const title = assignment.assignmentType === "bible_reading"
      ? assignment.scriptureRange ? `Lectura de la Biblia (${assignment.scriptureRange})` : "Lectura de la Biblia"
      : assignment.title;

    if (assignment.assignmentType === "bible_study") {
      const study = { ...assignment, section: "living" as const, isStudentPart: false };
      buildSlot(study, "bible_study", "Estudio bíblico de la congregación", study.durationMinutes, nextOrderIndex++, false);
    } else {
      const paired = ["conversation", "revisit", "disciples", "explain_beliefs"].includes(assignment.assignmentType);
      const durationMinutes = assignment.durationMinutes;
      buildSlot(assignment, assignment.assignmentType as NonNullable<AssignmentSlotDetail["assignmentType"]>,
        title, durationMinutes, nextOrderIndex++, paired);
    }
  }

  const readingChanged = program.weeklyBibleReading !== week.weeklyBibleReading;
  const songsChanged = program.openingSongNumber !== week.openingSongNumber
    || program.livingSongNumber !== week.livingSongNumber
    || program.closingSongNumber !== week.closingSongNumber;
  return {
    ...program,
    slots: nextSlots,
    weeklyBibleReading: week.weeklyBibleReading,
    openingSongNumber: week.openingSongNumber,
    livingSongNumber: week.livingSongNumber,
    closingSongNumber: week.closingSongNumber,
    ...(contentChanged || readingChanged || songsChanged ? {
      leadershipReviewConfirmed: false,
      leadershipReviewConfirmedBy: undefined,
      leadershipReviewConfirmedAt: undefined,
      updatedAt: new Date().toISOString(),
    } : {}),
  };
}
