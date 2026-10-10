import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { applyMeetingGuideTitles, getMeetingGuidePeriodLabel, parseMeetingGuideEpub } from "./meeting-guide-importer";
import { buildDefaultMeetingProgram } from "./program-builder";

function makeEpub(weekLabel: string, year = 2026, periodMonths = "noviembre y diciembre") {
  const zip = new PizZip();
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Guía de actividades ${periodMonths} de ${year}</dc:title></metadata></package>`);
  zip.file("OEBPS/202026401.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml"><body>
      <h1>${weekLabel}</h1><h3><strong>Canción 1 y oración | Palabras de introducción (1 min.)</strong></h3>
      <h2>JEREMÍAS 49, 50</h2><h2>TESOROS DE LA BIBLIA</h2>
      <h3><strong>1. Tema del discurso principal (10 mins.)</strong></h3><p>Contenido del discurso.</p>
      <h3><strong>2. Busquemos perlas escondidas</strong></h3><p>(10 mins.)</p>
      <h3><strong>3. Lectura de la Biblia (4 mins.)</strong></h3><p>Jer 50:24-40 ( th lección 11 ).</p>
      <h2>SEAMOS MEJORES MAESTROS</h2>
      <h3><strong>4. Empecemos conversaciones</strong></h3><p>(2 mins.) Indicaciones.</p>
      <h3><strong>5. Hagamos revisitas</strong></h3><p>(5 mins.) Indicaciones.</p>
      <h3><strong>6. Discurso (6 mins.)</strong></h3><p>lmd apéndice A punto 21. Título: El Reino de Dios es un gobierno real que está en el cielo ( th lección 7 ).</p>
      <h3>Canción 44</h3><h2>NUESTRA VIDA CRISTIANA</h2><h3><strong>7. Tema de Nuestra vida cristiana (12 mins.)</strong></h3><p>Contenido de la asignación.</p>
      <h3><strong>8. Estudio bíblico de la congregación</strong></h3><p>(25 mins.)</p>
      <h3>Palabras de conclusión (3 mins.) | Canción 33 y oración</h3>
    </body></html>`);
  return zip.generate({ type: "uint8array" }) as Uint8Array;
}

describe("meeting guide EPUB importer", () => {
  it("extracts titles, weekly reading and the actual talk title", () => {
    const weeks = parseMeetingGuideEpub(makeEpub("2-8 DE NOVIEMBRE"), "mwb_S_202611.epub");
    expect(weeks).toHaveLength(1);
    expect(weeks[0].assignments).toHaveLength(8);
    expect(weeks[0].assignments.map(({ number, durationMinutes }) => [number, durationMinutes])).toEqual([
      [1, 10], [2, 10], [3, 4], [4, 2], [5, 5], [6, 6], [7, 12], [8, 25],
    ]);
    expect(weeks[0]).toMatchObject({
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      weeklyBibleReading: "JEREMÍAS 49, 50",
      openingSongNumber: 1,
      livingSongNumber: 44,
      closingSongNumber: 33,
      treasuresTalkTitle: "Tema del discurso principal",
      gemsTitle: "Busquemos perlas escondidas",
      bibleReadingTitle: "Jer 50:24-40",
      ministryParts: [
        { title: "Empecemos conversaciones", assignmentType: "conversation", durationMinutes: 2 },
        { title: "Hagamos revisitas", assignmentType: "revisit", durationMinutes: 5 },
        { title: "El Reino de Dios es un gobierno real que está en el cielo", assignmentType: "student_talk", durationMinutes: 6 },
      ],
      livingTitle: "Tema de Nuestra vida cristiana",
      livingDurationMinutes: 12,
    });
  });

  it("normaliza los períodos bimestrales a enero-febrero y siguientes", () => {
    expect(getMeetingGuidePeriodLabel(makeEpub("4-10 DE ENERO", 2027, "enero y febrero"), "mwb_S_202701.epub"))
      .toBe("Enero - Febrero 2027");
    expect(getMeetingGuidePeriodLabel(makeEpub("2-8 DE NOVIEMBRE"), "mwb_S_202611.epub"))
      .toBe("Noviembre - Diciembre 2026");
  });

  it("recognizes a week that crosses the end of the year", () => {
    const weeks = parseMeetingGuideEpub(makeEpub("28 DE DICIEMBRE DE 2026 A 3 DE ENERO DE 2027"), "mwb_S_202611.epub");
    expect(weeks[0].startDate).toBe("2026-12-28");
    expect(weeks[0].endDate).toBe("2027-01-03");
  });

  it("applies titles and Bible reading without changing assigned participants", () => {
    const program = buildDefaultMeetingProgram("2026-11-04");
    const week = parseMeetingGuideEpub(makeEpub("2-8 DE NOVIEMBRE"), "mwb_S_202611.epub")[0];
    const updated = applyMeetingGuideTitles({ ...program, leadershipReviewConfirmed: true }, week);
    expect(updated.weeklyBibleReading).toBe("JEREMÍAS 49, 50");
    expect(updated.leadershipReviewConfirmed).toBe(false);
    expect(updated.slots.find((slot) => slot.assignmentType === "treasures_talk")?.title).toBe("Tema del discurso principal");
    expect(updated.slots.find((slot) => slot.assignmentType === "treasures_talk")?.durationMinutes).toBe(10);
    expect(updated.slots.find((slot) => slot.assignmentType === "gems")?.durationMinutes).toBe(10);
    expect(updated.slots.find((slot) => slot.assignmentType === "bible_reading")?.title).toBe("Lectura de la Biblia (Jer 50:24-40)");
    expect(updated.slots.find((slot) => slot.assignmentType === "bible_reading")?.durationMinutes).toBe(4);
    expect(updated.slots.find((slot) => slot.assignmentType === "conversation")?.durationMinutes).toBe(2);
    expect(updated.slots.find((slot) => slot.assignmentType === "revisit")?.durationMinutes).toBe(5);
    expect(updated.slots.find((slot) => slot.assignmentType === "student_talk")?.durationMinutes).toBe(6);
    expect(updated.slots.find((slot) => slot.assignmentType === "living_part")?.durationMinutes).toBe(12);
    expect(updated.slots.find((slot) => slot.assignmentType === "bible_study_conductor")?.durationMinutes).toBe(25);
    expect(updated.slots.find((slot) => slot.assignmentType === "bible_study_reader")?.durationMinutes).toBe(25);
    expect(updated.slots.find((slot) => slot.assignmentType === "living_part")?.title).toBe("Tema de Nuestra vida cristiana");
    expect(updated.slots.find((slot) => slot.assignmentType === "conversation")?.primaryParticipantId)
      .toBe(program.slots.find((slot) => slot.assignmentType === "conversation")?.primaryParticipantId);
  });
});
