import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import { exportPairingsPdf, exportStandingsPdf, type PdfFile } from "../services/exports/exports.service";
import { idParam } from "../validators/params";

function sendPdf(res: Response, file: PdfFile): void {
  res
    .status(200)
    .type("application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${file.filename}"`)
    .send(file.content);
}

/** GET /tournaments/:id/standings.pdf — the standings as a printable PDF (HU30). */
export async function standingsPdf(req: Request, res: Response): Promise<void> {
  sendPdf(res, await exportStandingsPdf(prisma, idParam(req, "id"), actorOf(req)));
}

/** GET /rounds/:id/pairings.pdf — a published round's pairings as a printable PDF (HU30). */
export async function pairingsPdf(req: Request, res: Response): Promise<void> {
  sendPdf(res, await exportPairingsPdf(prisma, idParam(req, "id"), actorOf(req)));
}
