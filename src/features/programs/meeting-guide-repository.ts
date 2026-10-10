import { createNeonBrowserClient } from "@/lib/neon/client";
import type { MeetingGuideWeek } from "./meeting-guide-importer";

type NeonBrowserClient = ReturnType<typeof createNeonBrowserClient>;

export interface ActiveMeetingGuide {
  fileName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  weeks: MeetingGuideWeek[];
  uploadedAt: string;
}

type ActiveGuideRow = {
  file_name: string;
  period_label: string;
  period_start: string;
  period_end: string;
  weeks: MeetingGuideWeek[] | string;
  uploaded_at: string;
};

function asRecordArray(data: unknown): ActiveGuideRow[] {
  if (!data) return [];
  const decoded = typeof data === "string" ? JSON.parse(data) as unknown : data;
  if (Array.isArray(decoded)) return decoded as ActiveGuideRow[];
  return [decoded as ActiveGuideRow];
}

export async function getActiveMeetingGuide(neon: NeonBrowserClient): Promise<ActiveMeetingGuide | null> {
  const { data, error } = await neon.rpc("get_active_meeting_guide", {});
  if (error) {
    const details = error as { message?: string; code?: string };
    if (details.code === "PGRST202" || /could not find the function|schema cache/i.test(details.message ?? "")) {
      throw new Error("La base de datos todavía no tiene instalada la migración de la guía bimestral.");
    }
    throw new Error(details.message || "No se pudo comprobar la guía bimestral activa.");
  }

  const row = asRecordArray(data)[0];
  if (!row) return null;
  const weeks = typeof row.weeks === "string" ? JSON.parse(row.weeks) as MeetingGuideWeek[] : row.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) {
    throw new Error("La guía bimestral guardada no contiene una estructura válida.");
  }
  return {
    fileName: row.file_name,
    periodLabel: row.period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    weeks,
    uploadedAt: row.uploaded_at,
  };
}

export async function replaceActiveMeetingGuide(
  neon: NeonBrowserClient,
  guide: Pick<ActiveMeetingGuide, "fileName" | "periodLabel" | "periodStart" | "periodEnd" | "weeks">,
): Promise<ActiveMeetingGuide> {
  const { data, error } = await neon.rpc("replace_active_meeting_guide", {
    p_file_name: guide.fileName,
    p_period_label: guide.periodLabel,
    p_period_start: guide.periodStart,
    p_period_end: guide.periodEnd,
    p_weeks: guide.weeks,
  });
  if (error) {
    const details = error as { message?: string; code?: string };
    throw new Error(details.message || "No se pudo guardar la guía bimestral.");
  }
  const uploadedAt = typeof data === "string" ? data : new Date().toISOString();
  return { ...guide, uploadedAt };
}
