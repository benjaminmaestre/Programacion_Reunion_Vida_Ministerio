import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export interface S140AssignmentData {
  weekDate: string;
  weeklyBibleReading?: string;
  chairman: string;
  auxiliaryCounselor?: string;
  treasuresTalkTitle: string;
  treasuresTalkSpeaker: string;
  gemsSpeaker: string;
  bibleReader: string;
  ministersParts: Array<{
    title: string;
    speaker: string;
    assistant?: string;
  }>;
  livingParts: Array<{
    title: string;
    speaker: string;
  }>;
  congregationStudyConductor: string;
  congregationStudyReader: string;
}

export class S140DocxGenerator {
  static generateDocx(data: S140AssignmentData): Buffer {
    const templatePath = path.join(process.cwd(), 'templates', 'S-140_S.docx');
    const content = fs.readFileSync(templatePath, 'binary');

    const zip = new PizZip(content);
    const weeklyReading = data.weeklyBibleReading?.trim();
    const documentXml = zip.file("word/document.xml");
    if (weeklyReading && documentXml) {
      const xmlEscape = (value: string) => value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      zip.file("word/document.xml", documentXml.asText().replace(
        /LECTURA SEMANAL DE LA BIBLIA/g,
        `LECTURA SEMANAL DE LA BIBLIA: ${xmlEscape(weeklyReading)}`,
      ));
    }
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(data);

    return doc.getZip().generate({ type: 'nodebuffer' });
  }
}
