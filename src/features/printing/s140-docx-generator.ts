import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

export interface S140AssignmentData {
  weekDate: string;
  weeklyBibleReading?: string;
  openingSongNumber?: number;
  livingSongNumber?: number;
  closingSongNumber?: number;
  chairman: string;
  auxiliaryCounselor?: string;
  openingPrayer?: string;
  closingPrayer?: string;
  congregationName?: string;
  treasuresTalkTitle: string;
  treasuresTalkSpeaker: string;
  gemsSpeaker: string;
  bibleReader: string;
  ministersParts: Array<{
    title: string;
    speaker: string;
    assistant?: string;
    durationMinutes?: number;
  }>;
  livingParts: Array<{
    title: string;
    speaker: string;
    durationMinutes?: number;
  }>;
  congregationStudyConductor: string;
  congregationStudyReader: string;
}


const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function xmlEscape(value: string): string { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function xmlDecode(value: string): string { return value.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&"); }
function visibleText(xml: string): string { return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m)=>xmlDecode(m[1])).join(""); }
function setTextNode(xml:string,target:string,value:string,occurrence=0):string {
  let seen=0;
  return xml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,(whole,opening:string,text:string,closing:string)=>{
    if(xmlDecode(text)!==target)return whole;
    if(seen++!==occurrence)return whole;
    return opening+xmlEscape(value)+closing;
  });
}
function formatSpanishDate(iso:string):string {
  const match=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!match)return iso;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return iso;
  return day+" de "+MONTHS_ES[month-1]+" de "+year;
}
function pairNames(speaker:string,assistant?:string):string { const a=speaker.trim(),b=assistant?.trim(); return a&&b?a+" / "+b:a||b||""; }
function compactLongTitleRun(xml: string, title: string): string {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length < 18) return xml;
  let changed = false;
  return xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (changed || !visibleText(run).includes(normalizedTitle)) return run;
    changed = true;
    const runProperties = /<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/.exec(run)?.[0];
    if (runProperties) {
      let compactProperties = runProperties;
      if (/<w:sz\b[^>]*\/>/.test(compactProperties)) {
        compactProperties = compactProperties.replace(/<w:sz\b[^>]*\/>/, '<w:sz w:val="16"/>');
      } else {
        compactProperties = compactProperties.replace(/<\/w:rPr>$/, '<w:sz w:val="16"/>');
      }
      if (/<w:szCs\b[^>]*\/>/.test(compactProperties)) {
        compactProperties = compactProperties.replace(/<w:szCs\b[^>]*\/>/, '<w:szCs w:val="16"/>');
      } else {
        compactProperties = compactProperties.replace(/<\/w:rPr>$/, '<w:szCs w:val="16"/>');
      }
      return run.replace(runProperties, compactProperties);
    }
    return run.replace(/^(<w:r\b[^>]*>)/, '$1<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>');
  });
}

const COMPACT_PARAGRAPH_SPACING = '<w:spacing w:before="0" w:after="0" w:line="220" w:lineRule="auto"/>';

function addOrReplaceCompactSpacing(pPr: string): string {
  const spacingPattern = /<w:spacing\b[^>]*(?:\/>|>[\s\S]*?<\/w:spacing>)/;
  if (spacingPattern.test(pPr)) return pPr.replace(spacingPattern, COMPACT_PARAGRAPH_SPACING);
  const insertBefore = [
    /<w:ind\b/,
    /<w:contextualSpacing\b/,
    /<w:mirrorIndents\b/,
    /<w:jc\b/,
    /<w:textDirection\b/,
    /<w:rPr\b/,
    /<w:sectPr\b/,
    /<w:pPrChange\b/,
  ];
  for (const pattern of insertBefore) {
    const match = pattern.exec(pPr);
    if (match && match.index >= 0) {
      return pPr.slice(0, match.index) + COMPACT_PARAGRAPH_SPACING + pPr.slice(match.index);
    }
  }
  return pPr.replace(/<\/w:pPr>$/, COMPACT_PARAGRAPH_SPACING + '</w:pPr>');
}

function compactS140Body(body: string): string {
  const compactRows = body.replace(/<w:trHeight\b[^>]*\/>/g, (height) =>
    /w:val=["']288["']/.test(height) ? height.replace(/w:val=["']288["']/, 'w:val="220"') : height
  );
  return compactRows.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (paragraph, attributes: string, content: string) => {
    const properties = /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.exec(content);
    if (!properties) {
      return '<w:p' + attributes + '><w:pPr>' + COMPACT_PARAGRAPH_SPACING + '</w:pPr>' + content + '</w:p>';
    }
    const compactProperties = addOrReplaceCompactSpacing(properties[0]);
    return paragraph.replace(properties[0], compactProperties);
  });
}

function compactSectionMargins(section: string): string {
  return section.replace(/<w:pgMar\b([^>]*)\/>/, (_whole, attributes: string) => {
    const compactAttributes = attributes.replace(/w:(top|bottom)=["'](\d+)["']/g, (_attr: string, edge: string, raw: string) => {
      return 'w:' + edge + '="' + Math.min(Number(raw), 500) + '"';
    });
    return '<w:pgMar' + compactAttributes + '/>';
  });
}
function mapRows(table:string,mapper:(row:string,index:number)=>string):string { let index=0; return table.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g,(row)=>mapper(row,index++)); }
function setRunFontSize(run: string, size: number): string {
  const value = String(size);
  const runProperties = /<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/.exec(run)?.[0];
  if (runProperties) {
    let properties = runProperties;
    for (const tag of ["sz", "szCs"]) {
      const pattern = new RegExp("<w:" + tag + "\\\\b[^>]*\\\\/>");
      const replacement = '<w:' + tag + ' w:val="' + value + '"/>';
      if (pattern.test(properties)) properties = properties.replace(pattern, replacement);
      else properties = properties.replace(/<\/w:rPr>$/, replacement);
    }
    return run.replace(runProperties, properties);
  }
  return run.replace(/^(<w:r\b[^>]*>)/, '$1<w:rPr><w:sz w:val="' + value + '"/><w:szCs w:val="' + value + '"/></w:rPr>');
}

function compactAssignmentTable(table: string): string {
  return mapRows(table, (row, rowIndex) => {
    const text = visibleText(row);
    if (text.includes("LAS VIOLETAS") || text.includes("Programa para la reunión de entre semana")) return "";
    if (rowIndex === 0) return row;
    return row.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
      if (visibleText(run).trim().length < 9) return run;
      return setRunFontSize(run, 16);
    });
  });
}

function fillDateTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"[FECHA] | LECTURA SEMANAL DE LA BIBLIA",
    data.weeklyBibleReading?.trim()?formatSpanishDate(data.weekDate)+" | LECTURA SEMANAL DE LA BIBLIA: "+data.weeklyBibleReading.trim():formatSpanishDate(data.weekDate)+" | LECTURA SEMANAL DE LA BIBLIA");
  next=setTextNode(next,"[Nombre]",data.chairman||"",0);
  return setTextNode(next,"[Nombre]",data.auxiliaryCounselor||"",0);
}
function fillOpeningTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"Canción [Número]",data.openingSongNumber?"Canción "+data.openingSongNumber:"",0);
  return setTextNode(next,"[Nombre]",data.openingPrayer||"",0);
}
function fillTreasuresTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"[Título]",data.treasuresTalkTitle||"",0);
  next=setTextNode(next,"[Nombre]",data.treasuresTalkSpeaker||"",0);
  next=setTextNode(next,"[Nombre]",data.gemsSpeaker||"",0);
  next=setTextNode(next,"[Nombre]","",0);
  return setTextNode(next,"[Nombre]",data.bibleReader||"",0);
}
function fillMinistryTable(table:string,data:S140AssignmentData):string {
  const parts=data.ministersParts.slice(0,3);
  return mapRows(table,(row,rowIndex)=>{
    if(rowIndex===0)return row;
    if(rowIndex===1){
      let current=setTextNode(row,"[Título]",parts[0]?.title||"",0);
      current=compactLongTitleRun(current, parts[0]?.title || "");
      current=setTextNode(current,"(X mins.)",parts[0]?"("+(parts[0].durationMinutes??3)+" mins.)":"",0);
      current=setTextNode(current,"[Consejero]",data.auxiliaryCounselor||"",0);
      return setTextNode(current,"[Presidente]",data.chairman||"",0);
    }
    const part=parts[rowIndex-1]; if(!part)return "";
    let current=setTextNode(row,"[Título]",part.title||"",0);
    current=compactLongTitleRun(current, part.title || "");
    current=setTextNode(current,"(X mins.)","("+(part.durationMinutes??(rowIndex===2?4:5))+" mins.)",0);
    current=setTextNode(current,"[Nombre/Nombre]","",0);
    return setTextNode(current,"[Nombre/Nombre]",pairNames(part.speaker,part.assistant),0);
  });
}
function fillLivingTable(table:string,data:S140AssignmentData):string {
  const parts=data.livingParts.slice(0,2);
  return mapRows(table,(row,rowIndex)=>{
    if(rowIndex===0)return row;
    if(rowIndex===1)return setTextNode(row,"Canción [Número]",data.livingSongNumber?"Canción "+data.livingSongNumber:"",0);
    if(rowIndex===2||rowIndex===3){
      const part=parts[rowIndex-2]; if(!part)return "";
      let current=setTextNode(row,"[Título]",part.title||"",0);
      current=setTextNode(current,"(XX mins.)","("+(part.durationMinutes??15)+" mins.)",0);
      return setTextNode(current,"[Nombre]",part.speaker||"",0);
    }
    if(rowIndex===4)return setTextNode(row,"[Nombre/Nombre]",pairNames(data.congregationStudyConductor,data.congregationStudyReader),0);
    if(rowIndex===6){
      let current=setTextNode(row,"Canción [Número]",data.closingSongNumber?"Canción "+data.closingSongNumber:"",0);
      return setTextNode(current,"[Nombre]",data.closingPrayer||"",0);
    }
    return row;
  });
}
type S140FormStart = { tableIndex: number; offset: number };

function findS140FormStarts(body: string): S140FormStart[] {
  const starts: S140FormStart[] = [];
  let tableIndex = 0;
  body.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table, offset: number) => {
    const text = visibleText(table);
    if (text.includes("[FECHA]") && text.includes("LECTURA SEMANAL DE LA BIBLIA")) {
      starts.push({ tableIndex, offset });
    }
    tableIndex += 1;
    return table;
  });
  return starts;
}

function truncateAfterForm(body: string, formIndex: number): string {
  const formStarts = findS140FormStarts(body);
  if (formIndex < 0 || formIndex >= formStarts.length) {
    throw new Error("No se encontró el formulario S-140 solicitado en la plantilla.");
  }
  const targetTableIndex = formStarts[formIndex].tableIndex + 4;
  let tableIndex = 0;
  let targetEnd = -1;
  body.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table, offset: number) => {
    if (tableIndex === targetTableIndex) targetEnd = offset + table.length;
    tableIndex += 1;
    return table;
  });
  if (targetEnd < 0) throw new Error("No se pudo delimitar el formulario S-140 en la plantilla.");
  return body.slice(0, targetEnd);
}

function stripTemplatePageBreaks(body: string): string {
  return body
    .replace(/<w:br\b[^>]*\bw:type=["']page["'][^>]*\/>/g, "")
    .replace(/<w:pageBreakBefore\b[^>]*\/>/g, "");
}

function createTwoMeetingPageTemplate(documentXml: string): { body: string; section: string } {
  const match = documentXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  if (!match) throw new Error("La plantilla S-140 no contiene un cuerpo Word válido.");

  const rawSection = match[1].match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0] ?? "";
  const section = compactSectionMargins(rawSection.replace(/<w:docGrid\b[^>]*\/>/g, ""));
  let body = match[1].replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/, "");
  const formStarts = findS140FormStarts(body);
  if (formStarts.length < 2) {
    throw new Error("La plantilla S-140 no contiene espacio para dos reuniones por página.");
  }
  body = truncateAfterForm(body, 1);
  return { body: stripTemplatePageBreaks(body), section };
}

function renderMeetingPage(templateBody: string, meetings: S140AssignmentData[]): string {
  if (meetings.length < 1 || meetings.length > 2) {
    throw new Error("Cada página S-140 debe contener una o dos reuniones.");
  }
  const activeTemplate = meetings.length === 1 ? truncateAfterForm(templateBody, 0) : templateBody;
  const formStarts = findS140FormStarts(activeTemplate);
  if (formStarts.length < meetings.length) {
    throw new Error("No se encontraron suficientes formularios S-140 en la plantilla.");
  }
  let tableIndex = 0;
  const rendered = activeTemplate.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => {
    const currentTableIndex = tableIndex++;
    let formIndex = -1;
    for (let index = 0; index < formStarts.length; index += 1) {
      if (currentTableIndex >= formStarts[index].tableIndex) formIndex = index;
      else break;
    }
    if (formIndex < 0) return table;
    if (formIndex >= meetings.length) return "";
    const relativeIndex = currentTableIndex - formStarts[formIndex].tableIndex;
    const meeting = meetings[formIndex];
    if (relativeIndex === 0) return fillDateTable(table, meeting);
    if (relativeIndex === 1) return fillOpeningTable(table, meeting);
    if (relativeIndex === 2) return compactAssignmentTable(fillTreasuresTable(table, meeting));
    if (relativeIndex === 3) return compactAssignmentTable(fillMinistryTable(table, meeting));
    if (relativeIndex === 4) return compactAssignmentTable(fillLivingTable(table, meeting));
    return "";
  });
  return compactS140Body(rendered);
}

function renderTwoMeetingPage(templateBody: string, meetings: [S140AssignmentData, S140AssignmentData]): string {
  return renderMeetingPage(templateBody, meetings);
}

function renderSingleMeetingPage(templateBody: string, meeting: S140AssignmentData): string {
  return renderMeetingPage(templateBody, [meeting]);
}

export class S140DocxGenerator {
  static generateDocx(input: S140AssignmentData | S140AssignmentData[]): Buffer {
    const meetings = Array.isArray(input) ? input : [input];
    if (meetings.length === 0) throw new Error("Selecciona al menos una reunión para generar el S-140.");

    const templatePath = path.join(process.cwd(), "templates", "S-140_S.docx");
    const zip = new PizZip(fs.readFileSync(templatePath, "binary"));
    const file = zip.file("word/document.xml");
    if (!file) throw new Error("La plantilla S-140 no contiene word/document.xml.");

    const originalXml = file.asText();
    const { body: pageTemplate, section } = createTwoMeetingPageTemplate(originalXml);
    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const pages: string[] = [];
    for (let index = 0; index < meetings.length; index += 2) {
      const next = meetings[index + 1];
      pages.push(next
        ? renderTwoMeetingPage(pageTemplate, [meetings[index], next])
        : renderSingleMeetingPage(pageTemplate, meetings[index]));
    }

    const congregationName = meetings[0]?.congregationName?.trim()
      || process.env.NEXT_PUBLIC_CONGREGATION_NAME?.trim()
      || "Las Violetas";

    zip.file(/word\/header\d*\.xml/).forEach((headerFile) => {
      let headerXml = headerFile.asText();
      if (headerXml.includes("[NOMBRE DE LA CONGREGACIÓN]")) {
        headerXml = headerXml.replace(
          /<w:t\b([^>]*)>\[NOMBRE DE LA CONGREGACIÓN\]<\/w:t>/g,
          `<w:t$1>${xmlEscape(congregationName.toUpperCase())}</w:t>`
        );
        zip.file(headerFile.name, headerXml);
      }
    });

    const body = pages.join(pageBreak);
    const clean = body
      .replace(/<w:t\b([^>]*)>\[NOMBRE DE LA CONGREGACIÓN\]<\/w:t>/g, `<w:t$1>${xmlEscape(congregationName.toUpperCase())}</w:t>`)
      .replace(/<w:t\b([^>]*)>\[Nombre\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Nombre\/Nombre\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Consejero\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Presidente\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Título\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\(X mins\.\)<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\(XX mins\.\)<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[FECHA\]<\/w:t>/g, "<w:t$1></w:t>");

    const bodyMatch = originalXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) throw new Error("La plantilla S-140 no contiene un cuerpo Word válido.");
    const documentXml = originalXml.replace(bodyMatch[1], clean + section);
    zip.file("word/document.xml", documentXml);
    return zip.generate({ type: "nodebuffer" });
  }
}
