import { describe, expect, it } from "vitest";

import { renderOfficialPdf, type OfficialDocument } from "./pdfRenderer";

function documentWithRows(count: number): OfficialDocument {
  return {
    title: "Copa Otoño — Ñandú",
    subtitle: "Clasificación oficial",
    notes: ["Generado el 26 de septiembre de 2026, 10:30."],
    tables: [
      {
        columns: [
          { header: "#", width: 40, align: "right" },
          { header: "Jugador", width: 300 },
          { header: "Pts", width: 60, align: "right" },
        ],
        rows: Array.from({ length: count }, (_, index) => [String(index + 1), `Jugador ${index + 1}`, "½"]),
      },
    ],
  };
}

const pageCount = (pdf: Buffer): number => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("renderOfficialPdf", () => {
  it("produces a complete PDF file", async () => {
    const pdf = await renderOfficialPdf(documentWithRows(3));

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pageCount(pdf)).toBe(1);
  });

  it("continues a long table on further pages instead of cutting it off", async () => {
    const pdf = await renderOfficialPdf(documentWithRows(120));

    expect(pageCount(pdf)).toBeGreaterThan(1);
  });
});
