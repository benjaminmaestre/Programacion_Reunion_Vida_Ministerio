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
function mapRows(table:string,mapper:(row:string,index:number)=>string):string { let index=0; return table.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g,(row)=>mapper(row,index++)); }
function fillDateTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"[FECHA] | LECTURA SEMANAL DE LA BIBLIA",
    data.weeklyBibleReading?.trim()?formatSpanishDate(data.weekDate)+" | LECTURA SEMANAL DE LA BIBLIA: "+data.weeklyBibleReading.trim():formatSpanishDate(data.weekDate)+" | LECTURA SEMANAL DE LA BIBLIA");
  next=setTextNode(next,"[Nombre]",data.chairman||"",0);
  return setTextNode(next,"[Nombre]",data.auxiliaryCounselor||"",1);
}
function fillOpeningTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"Canción [Número]",data.openingSongNumber?"Canción "+data.openingSongNumber:"",0);
  return setTextNode(next,"[Nombre]","",0);
}
function fillTreasuresTable(table:string,data:S140AssignmentData):string {
  let next=setTextNode(table,"[Título]",data.treasuresTalkTitle||"",0);
  next=setTextNode(next,"[Nombre]",data.treasuresTalkSpeaker||"",0);
  next=setTextNode(next,"[Nombre]",data.gemsSpeaker||"",1);
  next=setTextNode(next,"[Nombre]","",2);
  return setTextNode(next,"[Nombre]",data.bibleReader||"",3);
}
function fillMinistryTable(table:string,data:S140AssignmentData):string {
  const parts=data.ministersParts.slice(0,3);
  return mapRows(table,(row,rowIndex)=>{
    if(rowIndex===0)return row;
    if(rowIndex===1){
      let current=setTextNode(row,"[Título]",parts[0]?.title||"",0);
      current=setTextNode(current,"(X mins.)",parts[0]?"("+(parts[0].durationMinutes??3)+" mins.)":"",0);
      current=setTextNode(current,"[Consejero]",data.auxiliaryCounselor||"",0);
      return setTextNode(current,"[Presidente]",data.chairman||"",0);
    }
    const part=parts[rowIndex-1]; if(!part)return "";
    let current=setTextNode(row,"[Título]",part.title||"",0);
    current=setTextNode(current,"(X mins.)","("+(part.durationMinutes??(rowIndex===2?4:5))+" mins.)",0);
    current=setTextNode(current,"[Nombre/Nombre]","",0);
    return setTextNode(current,"[Nombre/Nombre]",pairNames(part.speaker,part.assistant),1);
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
      return setTextNode(current,"[Nombre]","",0);
    }
    return row;
  });
}
function keepOneS140Form(documentXml:string):string {
  const match=documentXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  if(!match)throw new Error("La plantilla S-140 no contiene un cuerpo Word válido.");
  const section=match[1].match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0]??"";
  let body=match[1].replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/,"");
  const tables=[...body.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)];
  const dates=tables.filter((t)=>{const text=visibleText(t[0]);return text.includes("[FECHA]")&&text.includes("LECTURA SEMANAL DE LA BIBLIA");});
  if(dates.length>1)body=body.slice(0,dates[1].index??body.length);
  return documentXml.replace(match[1],body+section);
}

export class S140DocxGenerator {
  static generateDocx(data: S140AssignmentData): Buffer {
    const templatePath = path.join(process.cwd(), "templates", "S-140_S.docx");
    const zip = new PizZip(fs.readFileSync(templatePath, "binary"));
    const file = zip.file("word/document.xml");
    if (!file) throw new Error("La plantilla S-140 no contiene word/document.xml.");
    const singleForm = keepOneS140Form(file.asText());
    let tableIndex = 0;
    const rendered = singleForm.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => {
      const index = tableIndex++;
      if (index === 1) return fillDateTable(table, data);
      if (index === 2) return fillOpeningTable(table, data);
      if (index === 3) return fillTreasuresTable(table, data);
      if (index === 4) return fillMinistryTable(table, data);
      if (index === 5) return fillLivingTable(table, data);
      return table;
    });
    const clean = rendered
      .replace(/<w:t\b([^>]*)>\[Nombre\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Nombre\/Nombre\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Consejero\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Presidente\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[Título\]<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\(X mins\.\)<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\(XX mins\.\)<\/w:t>/g, "<w:t$1></w:t>")
      .replace(/<w:t\b([^>]*)>\[FECHA\]<\/w:t>/g, "<w:t$1></w:t>");
    zip.file("word/document.xml", clean);
    return zip.generate({ type: "nodebuffer" });
  }
}
