import type { PrismaClient } from "../../generated/prisma/client";

import { env } from "../../config/env";
import { HttpError } from "../../errors/apiErrors";
import type { AuthUser } from "../../types/express";
import { ROUND_INCLUDE, toRoundDto } from "../round.mapper";
import { getStandings } from "../standings.service";
import { assertCanExport, loadTournament } from "../tournamentAccess";
import { pairingsDocument, standingsDocument } from "./officialDocuments";
import { renderOfficialPdf } from "./pdfRenderer";

export interface PdfFile {
  filename: string;
  content: Buffer;
}

/** "Copa Otoño 2025" → "copa-otono-2025", for a download's file name. */
function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** HU30: the tournament's current standings as a printable PDF. */
export async function exportStandingsPdf(
  prisma: PrismaClient,
  tournamentId: string,
  actor: AuthUser,
): Promise<PdfFile> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanExport(tournament, actor);

  const standings = await getStandings(prisma, tournamentId, actor);
  const content = await renderOfficialPdf(standingsDocument(tournament, standings, new Date(), env.timeZone));
  return { filename: `clasificacion-${slug(tournament.name)}.pdf`, content };
}

/**
 * HU30: a published round's pairings (and results so far) as a printable PDF.
 *
 * @throws {HttpError} 409 for a draft: it isn't official information yet.
 */
export async function exportPairingsPdf(prisma: PrismaClient, roundId: string, actor: AuthUser): Promise<PdfFile> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { ...ROUND_INCLUDE, tournament: true },
  });
  if (!round) {
    throw new HttpError("ROUND_NOT_FOUND");
  }
  assertCanExport(round.tournament, actor);
  if (round.status === "GENERATED") {
    throw new HttpError("ROUND_NOT_EXPORTABLE");
  }

  const content = await renderOfficialPdf(
    pairingsDocument(round.tournament, toRoundDto(round), new Date(), env.timeZone),
  );
  return { filename: `ronda-${round.number}-${slug(round.tournament.name)}.pdf`, content };
}
