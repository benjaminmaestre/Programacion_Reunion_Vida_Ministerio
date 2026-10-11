import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { S140DocxGenerator, type S140AssignmentData } from "./s140-docx-generator";

function findUnbalancedTag(xml: string): string | null {
  const stack: string[] = [];
  const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)\b[^>]*?(\/?)>/g;
  for (const match of xml.matchAll(tagPattern)) {
    const [, closing, name, selfClosing] = match;
    if (match[0].startsWith("<?") || selfClosing) continue;
    if (!closing) {
      stack.push(name);
      continue;
    }
    const open = stack.pop();
    if (open !== name) return `esperaba </${open}> pero encontró </${name}>`;
  }
  return stack.length ? `etiquetas sin cerrar: ${stack.join(", ")}` : null;
}

function buildMeeting(weekDate: string): S140AssignmentData {
  return {
    weekDate,
    weeklyBibleReading: "JEREMÍAS 49, 50",
    openingSongNumber: 1,
    livingSongNumber: 44,
    closingSongNumber: 33,
    chairman: "Benjamin Pérez Maestre",
    auxiliaryCounselor: "Félix Anibal Pérez",
    openingPrayer: "Alejandro Zapata",
    closingPrayer: "Luis Castrillo",
    congregationName: "Las Violetas",
    treasuresTalkTitle: "Ayudamos a otros a beneficiarse de la misericordia",
    treasuresTalkSpeaker: "Gonzalo Álvarez",
    gemsSpeaker: "Luis Castrillón",
    bibleReader: "Estiven Díaz",
    ministersParts: [
      // Títulos de 18+ caracteres activan la compactación de la fuente.
      { title: "Empecemos conversaciones", speaker: "Ana", durationMinutes: 3 },
      { title: "Hagamos revisitas con amor", speaker: "Bea", assistant: "Cata", durationMinutes: 4 },
      { title: "Hagamos discípulos", speaker: "Dora", assistant: "Eva", durationMinutes: 5 },
    ],
    livingParts: [{ title: "Nunca olviden lo que Jehová recuerda", speaker: "Widmar", durationMinutes: 15 }],
    congregationStudyConductor: "Luis",
    congregationStudyReader: "Mario $& $1",
  };
}

describe("S140DocxGenerator", () => {
  it("genera un document.xml bien formado con títulos largos y texto con '$'", () => {
    const buffer = S140DocxGenerator.generateDocx([
      buildMeeting("2026-11-02"),
      buildMeeting("2026-11-09"),
      buildMeeting("2026-11-16"),
    ]);
    const documentXml = new PizZip(buffer).file("word/document.xml")?.asText() ?? "";

    expect(documentXml.length).toBeGreaterThan(0);
    expect(findUnbalancedTag(documentXml)).toBeNull();
    expect(documentXml).toContain("Mario $&amp; $1");
  });
});
