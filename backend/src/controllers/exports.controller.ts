import type { Response } from "express";

import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { exportPairingsPdf, exportStandingsPdf, type PdfFile } from "../services/exports/exports.service";

function sendPdf(res: Response, file: PdfFile): void {
  res
    .status(200)
    .type("application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${file.filename}"`)
    .send(file.content);
}

/** GET /tournaments/:id/standings.pdf — the standings as a printable PDF (HU30). */
export const standingsPdf = asyncHandler(async (req, res) => {
  sendPdf(res, await exportStandingsPdf(prisma, String(req.params.id), req.user!));
});

/** GET /rounds/:id/pairings.pdf — a published round's pairings as a printable PDF (HU30). */
export const pairingsPdf = asyncHandler(async (req, res) => {
  sendPdf(res, await exportPairingsPdf(prisma, String(req.params.id), req.user!));
});
