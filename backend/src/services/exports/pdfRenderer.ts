import PDFDocument from "pdfkit";

// Layout only: turns an OfficialDocument (title, notes, tables of text) into
// PDF bytes. It knows nothing about tournaments; officialDocuments.ts maps
// the domain onto this shape.

export interface PdfColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface PdfTable {
  heading?: string;
  columns: PdfColumn[];
  rows: string[][];
}

export interface OfficialDocument {
  title: string;
  subtitle: string;
  // Printed under the title: when it was generated and what it reflects
  // (HU30: a document is a snapshot, later changes don't alter it).
  notes: string[];
  tables: PdfTable[];
}

const MARGIN = 48;
const ROW_HEIGHT = 18;
const INK = "#1f1f1f";
const MUTED = "#5c5648";
const RULE = "#d9d4c7";

function drawRow(pdf: PDFKit.PDFDocument, columns: PdfColumn[], cells: string[], y: number, bold: boolean): void {
  let x = MARGIN;
  pdf
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(10)
    .fillColor(INK);
  columns.forEach((column, index) => {
    // Height-bound: a cell that doesn't fit is cut with an ellipsis instead
    // of wrapping into the next row.
    pdf.text(cells[index] ?? "", x + 4, y + 4, {
      width: column.width - 8,
      height: ROW_HEIGHT - 6,
      align: column.align ?? "left",
      lineBreak: false,
      ellipsis: true,
    });
    x += column.width;
  });
  const right = MARGIN + columns.reduce((sum, column) => sum + column.width, 0);
  pdf
    .moveTo(MARGIN, y + ROW_HEIGHT)
    .lineTo(right, y + ROW_HEIGHT)
    .lineWidth(bold ? 1 : 0.5)
    .strokeColor(RULE)
    .stroke();
}

function drawTable(pdf: PDFKit.PDFDocument, table: PdfTable): void {
  if (table.heading) {
    pdf.moveDown(0.5).font("Helvetica-Bold").fontSize(12).fillColor(INK).text(table.heading, MARGIN);
    pdf.moveDown(0.3);
  }

  const bottom = () => pdf.page.height - MARGIN - ROW_HEIGHT;
  let y = pdf.y;
  drawRow(
    pdf,
    table.columns,
    table.columns.map((column) => column.header),
    y,
    true,
  );
  y += ROW_HEIGHT;

  for (const row of table.rows) {
    if (y > bottom()) {
      // Long tables continue on a new page, repeating the header row.
      pdf.addPage();
      y = MARGIN;
      drawRow(
        pdf,
        table.columns,
        table.columns.map((column) => column.header),
        y,
        true,
      );
      y += ROW_HEIGHT;
    }
    drawRow(pdf, table.columns, row, y, false);
    y += ROW_HEIGHT;
  }
  pdf.x = MARGIN;
  pdf.y = y + 8;
}

/** Renders an official document as an A4 PDF. */
export function renderOfficialPdf(document: OfficialDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: { Title: document.title, Producer: "Torre Central Hub" },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(document.title);
    pdf.font("Helvetica").fontSize(11).fillColor(MUTED).text(document.subtitle);
    pdf.moveDown(0.4).fontSize(9);
    for (const note of document.notes) pdf.text(note);
    pdf.moveDown(0.6);

    for (const table of document.tables) drawTable(pdf, table);

    pdf.end();
  });
}
