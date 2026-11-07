import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ExportDocument } from "@/lib/dataExport";

// Draws an ExportDocument (dataExport.ts) as an A4 PDF: title, then each section with its blocks,
// lines wrapped to the page, new pages as needed, and "Page n of m" at the foot.

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const TEXT_WIDTH = PAGE.width - MARGIN * 2;
const WRAP_INDENT = 14;
const GREY = rgb(0.4, 0.4, 0.43);
const BLACK = rgb(0.1, 0.1, 0.12);

// The built-in fonts only have Western European letters. Anything else (another script, an emoji)
// becomes "?" rather than failing the whole download.
function sanitizer(font: PDFFont): (text: string) => string {
  const supported = new Set(font.getCharacterSet());
  return (text) =>
    Array.from(text.replace(/[\r\n\t]+/g, " "))
      .map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");
}

// Splits text into lines no wider than `width`, breaking at spaces (or mid-word for a long word).
export function wrapText(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (measure(current) > width && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && measure(current.slice(0, cut)) > width) cut--;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  lines.push(current);
  return lines;
}

export async function renderExportPdf(doc: ExportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  pdf.setCreator("GymJourno");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = sanitizer(regular);

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 20) newPage();
  };
  const write = (text: string, opts: { font: PDFFont; size: number; color?: typeof BLACK; indent?: number; gapAfter?: number }) => {
    const indent = opts.indent ?? 0;
    const lineHeight = opts.size * 1.35;
    const wrapped = wrapText(clean(text), TEXT_WIDTH - indent - WRAP_INDENT, (s) => opts.font.widthOfTextAtSize(s, opts.size));
    wrapped.forEach((line, i) => {
      ensure(lineHeight);
      y -= lineHeight;
      page.drawText(line, {
        x: MARGIN + indent + (i > 0 ? WRAP_INDENT : 0),
        y,
        size: opts.size,
        font: opts.font,
        color: opts.color ?? BLACK,
      });
    });
    y -= opts.gapAfter ?? 0;
  };

  write(doc.title, { font: bold, size: 20, gapAfter: 2 });
  write(doc.subtitle, { font: regular, size: 10, color: GREY, gapAfter: 8 });

  for (const section of doc.sections) {
    // A section heading never sits alone at the foot of a page.
    ensure(60);
    y -= 14;
    write(section.heading, { font: bold, size: 14, gapAfter: 4 });
    if (section.blocks.length === 0) write(section.empty, { font: regular, size: 10, color: GREY });
    for (const block of section.blocks) {
      if (block.heading) {
        ensure(36);
        y -= 6;
        write(block.heading, { font: bold, size: 10.5, gapAfter: 1 });
      }
      for (const line of block.lines) {
        const indented = line.startsWith("    ");
        write(line.trim(), { font: regular, size: 10, indent: indented ? WRAP_INDENT : 0, color: indented ? GREY : BLACK });
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN / 2,
      size: 8,
      font: regular,
      color: GREY,
    });
  });

  return pdf.save();
}
