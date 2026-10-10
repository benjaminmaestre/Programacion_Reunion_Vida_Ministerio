import PizZip from "pizzip";
import type { AssignmentSlotDetail, MeetingProgramDetail } from "./program-types";

export type GuideAssignmentType = "conversation" | "revisit" | "disciples" | "explain_beliefs" | "student_talk";
export interface GuideMinistryPart {
  title: string;
  assignmentType: GuideAssignmentType;
  durationMinutes: number;
}
export interface MeetingGuideWeek {
  label: string;
  startDate: string;
  endDate: string;
  weeklyBibleReading: string;
  treasuresTalkTitle: string;
  gemsTitle: string;
  bibleReadingTitle: string;
  ministryParts: [GuideMinistryPart, GuideMinistryPart, GuideMinistryPart];
  livingTitle: string;
  livingDurationMinutes: number;
}
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};
const DEFAULT_DURATIONS = [3, 4, 5] as const;

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
function parseNumberedHeader(headerHtml: string): { number: number; title: string } | null {
  const match = plainText(headerHtml).match(/^(\d+)\.\s*(.+)$/);
  return match ? { number: Number(match[1]), title: match[2].trim() } : null;
}
function extractMinutes(body: string, fallback: number): number {
  const match = plainText(body).match(/\((\d{1,2})\s*mins?\.?\)/i);
  return match ? Number(match[1]) : fallback;
}
function extractSpeechTitle(body: string, fallback: string): string {
  const match = plainText(body).match(/\bTítulo\s*:\s*["“]?([\s\S]+?)(?=\s*\((?:th|lmd)\b|$)/i);
  return match?.[1]?.trim().replace(/[.\s]+$/, "").replace(/["”]+$/, "").trim() || fallback;
}
function classifyMinistryType(title: string): GuideAssignmentType {
  const normalized = normalizeForParsing(title);
  if (normalized.startsWith("empecemos conversaciones")) return "conversation";
  if (normalized.startsWith("hagamos revisitas")) return "revisit";
  if (normalized.startsWith("hagamos discipulos")) return "disciples";
  if (normalized.startsWith("expliquemos nuestras creencias")) return "explain_beliefs";
  return "student_talk";
}
function extractBibleReadingTitle(body: string): string {
  const match = plainText(body).match(/\(\s*\d+\s*mins?\.?\)\s*([^()]+?)(?=\s*\(|$)/i);
  return match?.[1]?.trim().replace(/[.\s]+$/, "") ?? "";
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

  const xhtmlFiles = fileNames.filter((name) => /(?:^|\/)20\d{7}\.xhtml$/i.test(name) && !/-extracted\.xhtml$/i.test(name)).sort();
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

    const firstH2 = source.slice((h1.index ?? 0) + h1[0].length).match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    const weeklyBibleReading = firstH2 ? plainText(firstH2[1]) : "";
    const headers = [...source.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
    const numbered = new Map<number, { title: string; originalHeading: string; body: string; minutes: number }>();
    for (let i = 0; i < headers.length; i += 1) {
      const parsed = parseNumberedHeader(headers[i][1]);
      if (!parsed) continue;
      const bodyStart = (headers[i].index ?? 0) + headers[i][0].length;
      const bodyEnd = i + 1 < headers.length ? (headers[i + 1].index ?? source.length) : source.length;
      const body = source.slice(bodyStart, bodyEnd);
      const title = parsed.number === 6 && normalizeForParsing(parsed.title) === "discurso"
        ? extractSpeechTitle(body, parsed.title) : parsed.title;
      const fallback = parsed.number === 1 ? 10 : parsed.number === 2 ? 10 : parsed.number === 3 ? 4
        : parsed.number === 4 ? DEFAULT_DURATIONS[0] : parsed.number === 5 ? DEFAULT_DURATIONS[1]
        : parsed.number === 6 ? DEFAULT_DURATIONS[2] : 15;
      numbered.set(parsed.number, { title, originalHeading: parsed.title, body, minutes: extractMinutes(body, fallback) });
    }
    if (!weeklyBibleReading || [1,2,3,4,5,6,7,8].some((number) => !numbered.get(number)?.title)) continue;

    const ministryParts = [4,5,6].map((number) => {
      const part = numbered.get(number)!;
      return { title: part.title, assignmentType: classifyMinistryType(part.originalHeading), durationMinutes: part.minutes };
    }) as [GuideMinistryPart, GuideMinistryPart, GuideMinistryPart];

    weeks.push({
      label, ...dates, weeklyBibleReading,
      treasuresTalkTitle: numbered.get(1)!.title,
      gemsTitle: numbered.get(2)!.title,
      bibleReadingTitle: extractBibleReadingTitle(numbered.get(3)!.body),
      ministryParts,
      livingTitle: numbered.get(7)!.title,
      livingDurationMinutes: numbered.get(7)!.minutes,
    });
  }
  if (!weeks.length) throw new Error("No se encontraron semanas con asignaciones numeradas reconocibles en la guía.");
  return weeks.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function applyMeetingGuideTitles(program: MeetingProgramDetail, week: MeetingGuideWeek): MeetingProgramDetail {
  const slots = program.slots.map((slot) => ({ ...slot }));
  let contentChanged = false;
  const updateSlot = (slot: AssignmentSlotDetail | undefined, changes: Partial<AssignmentSlotDetail>) => {
    if (!slot) return;
    const titleOrTypeChanged = (changes.title !== undefined && changes.title !== slot.title)
      || (changes.assignmentType !== undefined && changes.assignmentType !== slot.assignmentType);
    const durationChanged = changes.durationMinutes !== undefined && changes.durationMinutes !== slot.durationMinutes;
    if (titleOrTypeChanged || durationChanged) contentChanged = true;
    Object.assign(slot, changes);
    if (titleOrTypeChanged) {
      slot.eligibilityConfirmed = false;
      slot.eligibilityConfirmedBy = undefined;
      slot.eligibilityConfirmedAt = undefined;
    }
  };
  updateSlot(slots.find((slot) => slot.assignmentType === "treasures_talk"), {
    title: week.treasuresTalkTitle, durationMinutes: 10, isStudentPart: false,
  });
  updateSlot(slots.find((slot) => slot.assignmentType === "gems"), {
    title: week.gemsTitle, durationMinutes: 10, isStudentPart: false,
  });
  updateSlot(slots.find((slot) => slot.assignmentType === "bible_reading"), {
    title: week.bibleReadingTitle ? `Lectura de la Biblia (${week.bibleReadingTitle})` : "Lectura de la Biblia",
    durationMinutes: 4, isStudentPart: true,
  });
  const ministrySlots = slots.filter((slot) => slot.section === "ministers").sort((a, b) => a.orderIndex - b.orderIndex);
  week.ministryParts.forEach((part, index) => {
    const slot = ministrySlots[index];
    if (!slot) return;
    updateSlot(slot, {
      title: part.title,
      assignmentType: part.assignmentType,
      durationMinutes: part.durationMinutes,
      isStudentPart: true,
      ...(part.assignmentType === "student_talk" ? { assistantParticipantId: undefined } : {}),
    });
  });
  const living = slots.filter((slot) => slot.section === "living"
    && slot.assignmentType !== "bible_study_conductor"
    && slot.assignmentType !== "bible_study_reader").sort((a, b) => a.orderIndex - b.orderIndex)[0];
  updateSlot(living, { title: week.livingTitle, durationMinutes: week.livingDurationMinutes, isStudentPart: false });

  const readingChanged = program.weeklyBibleReading !== week.weeklyBibleReading;
  const anyChange = contentChanged || readingChanged;
  return {
    ...program,
    slots,
    weeklyBibleReading: week.weeklyBibleReading,
    ...(anyChange ? {
      leadershipReviewConfirmed: false,
      leadershipReviewConfirmedBy: undefined,
      leadershipReviewConfirmedAt: undefined,
      updatedAt: new Date().toISOString(),
    } : {}),
  };
}
