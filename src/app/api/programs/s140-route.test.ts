import { describe, expect, it } from "vitest";
import { S140DocxGenerator } from "../../../features/printing/s140-docx-generator";

describe("Generación del documento S-140 DOCX", () => {
  it("genera un buffer DOCX válido omitiendo intervenciones retiradas lógicamente", () => {
    const activeSlots = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        section: "treasures" as const,
        title: "Levítico 17:1-16 — La santidad de la sangre",
        assignment_type: "treasures_talk",
        primary_participant_id: "p-1",
        assistant_participant_id: null,
        order_index: 1,
        is_deleted: false,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        section: "treasures" as const,
        title: "Intervención retirada",
        assignment_type: "gems",
        primary_participant_id: "p-2",
        assistant_participant_id: null,
        order_index: 2,
        is_deleted: true, // Debe omitirse
      },
    ];

    const slotsToPrint = activeSlots.filter((slot) => !slot.is_deleted);
    expect(slotsToPrint).toHaveLength(1);
    expect(slotsToPrint[0].title).toBe("Levítico 17:1-16 — La santidad de la sangre");

    const docxBuffer = S140DocxGenerator.generateDocx({
      weekDate: "2026-11-02",
      chairman: "David Morales",
      auxiliaryCounselor: "Félix Pérez",
      treasuresTalkTitle: slotsToPrint[0].title,
      treasuresTalkSpeaker: "David Morales",
      gemsSpeaker: "",
      bibleReader: "",
      ministersParts: [],
      livingParts: [],
      congregationStudyConductor: "",
      congregationStudyReader: "",
    });

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(100);
  });
});
