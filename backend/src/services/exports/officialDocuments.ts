import type { Tournament } from "@prisma/client";

import type { RoundDto } from "../round.mapper";
import type { StandingsDto } from "../standings.service";
import type { OfficialDocument } from "./pdfRenderer";

// HU30: what goes on each official document. Pure mapping from the same DTOs
// the screens use, so the paper at the venue never disagrees with the app.

const RESULT_TEXT: Record<string, string> = { "1-0": "1 – 0", "0-1": "0 – 1", "1/2-1/2": "½ – ½", BYE: "Bye" };

// Two decimals: Sonneborn-Berger can land on quarters (0.5 × 0.5), and
// rounding it away could make two tied players look different.
function formatPoints(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

// Two notes: when (its own line, since the time format may already end in
// a period, "a. m."), and what that means for the reader (HU30).
function generatedNotes(generatedAt: Date, timeZone: string): string[] {
  const when = generatedAt.toLocaleString("es-CO", { timeZone, dateStyle: "long", timeStyle: "short" });
  return [
    `Generado el ${when}`,
    "Refleja la información oficial vigente en ese momento; cambios posteriores no modifican este documento.",
  ];
}

/** The standings sheet: rank, player, points and the computable tiebreaks. */
export function standingsDocument(
  tournament: Pick<Tournament, "name" | "roundsCount">,
  standings: StandingsDto,
  generatedAt: Date,
  timeZone: string,
): OfficialDocument {
  const state = standings.pending
    ? "Clasificación provisional: faltan resultados de la ronda en juego"
    : "Clasificación oficial";
  return {
    title: tournament.name,
    subtitle: `${state} · ${standings.roundsCompleted} de ${tournament.roundsCount ?? "—"} rondas completas`,
    notes: [
      ...generatedNotes(generatedAt, timeZone),
      ...(standings.tiebreaks.length > 0 ? [`Desempates en orden: ${standings.tiebreaks.join(" › ")}.`] : []),
    ],
    tables: [
      {
        columns: [
          { header: "#", width: 32, align: "right" },
          { header: "Jugador", width: 243 },
          { header: "Pts", width: 60, align: "right" },
          { header: "BH", width: 56, align: "right" },
          { header: "BC1", width: 56, align: "right" },
          { header: "SB", width: 52, align: "right" },
        ],
        rows: standings.rows.map((row) => [
          String(row.rank),
          row.withdrawn ? `${row.name} (retirado)` : row.name,
          formatPoints(row.score),
          formatPoints(row.buchholz),
          formatPoints(row.buchholzCut1),
          formatPoints(row.sonnebornBerger),
        ]),
      },
    ],
  };
}

/** A round's pairings sheet: board, both players with their colors, and results so far. */
export function pairingsDocument(
  tournament: Pick<Tournament, "name">,
  round: RoundDto,
  generatedAt: Date,
  timeZone: string,
): OfficialDocument {
  return {
    title: `${tournament.name} — Ronda ${round.number}`,
    subtitle: "Emparejamientos",
    notes: generatedNotes(generatedAt, timeZone),
    tables: [
      {
        columns: [
          { header: "Mesa", width: 44, align: "right" },
          { header: "Blancas", width: 190 },
          { header: "Resultado", width: 75, align: "center" },
          { header: "Negras", width: 190 },
        ],
        rows: round.matches.map((match) =>
          match.isBye
            ? [String(match.board), match.white?.name ?? match.black?.name ?? "", "Bye", "—"]
            : [
                String(match.board),
                match.white?.name ?? "",
                match.result ? (RESULT_TEXT[match.result] ?? match.result) : "",
                match.black?.name ?? "",
              ],
        ),
      },
    ],
  };
}
