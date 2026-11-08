import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { AREA_LABELS, AREA_ORDER, CRITERIA, GAP_LABELS, VERDICT_LABELS, type AnalysisRecord } from "./types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function latin(value: string): string {
  return value.replace(/[^\n\t\x20-\x7e]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of latin(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildReportPdf(record: AnalysisRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.09, 0.12);
  const muted = rgb(0.35, 0.38, 0.44);
  const yellow = rgb(0.96, 0.77, 0);
  const blue = rgb(0.17, 0.5, 1);
  const width = PAGE_WIDTH - MARGIN * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed > MARGIN) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const write = (text: string, options: { size?: number; face?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = options.size ?? 11;
    const face = options.face ?? font;
    const lines = wrap(text, face, size, width);
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font: face, color: options.color ?? ink });
      y -= size + 4;
    }
    y -= options.gap ?? 4;
  };

  const company = record.job.company.trim();
  const heading = company ? `${record.job.title} at ${company}` : record.job.title;
  ensure(22);
  page.drawText("Job", { x: MARGIN, y, size: 18, font: bold, color: yellow });
  const jobWidth = bold.widthOfTextAtSize("Job", 18);
  page.drawText("Fit", { x: MARGIN + jobWidth, y, size: 18, font: bold, color: blue });
  const fitWidth = bold.widthOfTextAtSize("Fit", 18);
  page.drawText(" AI match report", { x: MARGIN + jobWidth + fitWidth, y, size: 18, font: bold, color: ink });
  y -= 30;
  write(`${heading} · ${record.classification} · ${record.score}%`, { size: 12, face: bold });
  write(record.createdAt.replace("T", " ").replace("Z", " UTC"), { size: 9, color: muted, gap: 10 });
  write("Verdict", { size: 13, face: bold, gap: 2 });
  write(`${VERDICT_LABELS[record.apply.verdict]}. ${record.apply.explanation}`);
  write("Summary", { size: 13, face: bold, gap: 2 });
  write(record.summary);
  write("Category scores", { size: 13, face: bold, gap: 2 });
  for (const category of record.categories) {
    const label = CRITERIA.find((item) => item.key === category.criterion);
    write(`${label?.label ?? category.criterion}: ${category.score}/100 (${label?.weight ?? ""})`, { face: bold, gap: 1 });
    write(category.explanation);
    for (const evidence of category.evidence) write(`• ${evidence}`, { size: 10, color: muted, gap: 1 });
  }
  write("Matched skills", { size: 13, face: bold, gap: 2 });
  write(record.matchedSkills.join(", ") || "None identified.");
  write("Missing or weak skills", { size: 13, face: bold, gap: 2 });
  if (record.gaps.length === 0) write("None identified.");
  for (const gap of record.gaps) write(`${gap.skill}. ${GAP_LABELS[gap.status]} ${gap.explanation}`);
  write("Strengths", { size: 13, face: bold, gap: 2 });
  if (record.strengths.length === 0) write("None identified.");
  for (const strength of record.strengths) write(`${strength.title}. ${strength.detail}`);
  write("Recommendations", { size: 13, face: bold, gap: 2 });
  for (const area of AREA_ORDER) {
    const advice = record.recommendations.filter((item) => item.area === area);
    if (advice.length === 0) continue;
    write(AREA_LABELS[area], { face: bold, gap: 1 });
    for (const item of advice) write(`• ${item.advice}`);
  }
  if (record.emailSubject || record.emailBody) {
    write("Application email", { size: 13, face: bold, gap: 2 });
    write(`Subject: ${record.emailSubject}`, { face: bold, gap: 2 });
    write(record.emailBody);
  }

  pdf.setTitle("JobFit AI match report");
  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "report";
}
