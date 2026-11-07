import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderExportPdf, wrapText } from "./exportPdf";
import type { ExportDocument } from "./dataExport";

const charWidth = (s: string) => s.length;

describe("wrapText", () => {
  it("breaks at spaces, and inside a word too long for a line", () => {
    expect(wrapText("one two three four", 9, charWidth)).toEqual(["one two", "three", "four"]);
    expect(wrapText("abcdefghijkl", 5, charWidth)).toEqual(["abcde", "fghij", "kl"]);
    expect(wrapText("short", 20, charWidth)).toEqual(["short"]);
  });
});

describe("renderExportPdf", () => {
  const doc = (lines: string[]): ExportDocument => ({
    title: "Your GymJourno data",
    subtitle: "Downloaded Sat 7 Nov 2026",
    sections: [
      { heading: "Workouts", empty: "No workouts logged yet.", blocks: [{ heading: "Sun 1 Nov 2026", lines }] },
      { heading: "Plans", empty: "No plans yet.", blocks: [] },
    ],
  });

  it("makes a PDF that runs onto more pages when it's long", async () => {
    const bytes = await renderExportPdf(doc(Array.from({ length: 150 }, (_, i) => `Bench Press: 60kg × ${i} (RPE 8)`)));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    expect(loaded.getTitle()).toBe("Your GymJourno data");
  });

  it("doesn't fail on letters the PDF font lacks", async () => {
    const bytes = await renderExportPdf(doc(["सूर्य नमस्कार: 1:30 💪", "Line\nwith a break"]));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
