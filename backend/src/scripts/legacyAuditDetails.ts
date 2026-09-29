import type { AuditAction } from "../contracts/catalogs";
import { mention } from "../services/auditLog.service";

// Audit entries written before details referenced people by id hold their
// names as plain text (see auditLog.service.ts). These are the formats each
// action used then, to find those names and put a reference in their place.

/** A name in an old entry, and where it sits in the detail. */
export interface NameSpan {
  name: string;
  start: number;
  end: number;
}

/** Who an old entry names, and what else it says that narrows down who they are. */
export interface LegacyDetail {
  names: NameSpan[];
  tournament?: string;
  round?: number;
  board?: number;
}

// `d` gives each group's position, so only the names are replaced.
const LEGACY_FORMATS: Partial<Record<AuditAction, RegExp>> = {
  ROLE_CHANGED: /^(?<name1>.+) \([A-Z_]+ -> [A-Z_]+\)$/ds,
  ACCOUNT_STATUS_CHANGED: /^(?<name1>.+) -> [A-Z_]+$/ds,
  RESULT_CORRECTED:
    /^"(?<tournament>.+?)", ronda (?<round>\d+), mesa (?<board>\d+) \((?<name1>.+?) – (?<name2>.+?)\): /ds,
  PAIRING_ADJUSTED:
    /^Ronda (?<round>\d+) de "(?<tournament>.+?)": (?<name1>.+?) ↔ (?<name2>.+?)(?: \(repite un enfrentamiento previo\))? — /ds,
  PLAYER_WITHDRAWN: /^(?<name1>.+?) de "(?<tournament>.+?)"(?: — .*)?$/ds,
};

/**
 * The names in an old entry's detail, or null when there are none to
 * replace: the entry already references people by id, its action never
 * named anyone, or its text isn't in the old format.
 */
export function parseLegacyDetail(action: string, detail: string): LegacyDetail | null {
  if (detail.includes("{{user:")) return null;
  const match = LEGACY_FORMATS[action as AuditAction]?.exec(detail);
  const groups = match?.groups;
  const positions = match?.indices?.groups;
  if (!groups || !positions) return null;

  const names = (["name1", "name2"] as const).flatMap((key) => {
    const position = positions[key];
    return position ? [{ name: groups[key]!, start: position[0], end: position[1] }] : [];
  });
  return {
    names,
    tournament: groups.tournament,
    round: groups.round ? Number(groups.round) : undefined,
    board: groups.board ? Number(groups.board) : undefined,
  };
}

/** The detail with each name replaced by a reference to its person (`userIds`, in the same order). */
export function withMentions(detail: string, names: NameSpan[], userIds: string[]): string {
  return names.reduceRight(
    (text, span, index) => text.slice(0, span.start) + mention(userIds[index]!) + text.slice(span.end),
    detail,
  );
}
