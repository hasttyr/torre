import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRoundsStore } from "./rounds";

vi.mock("../services/rounds", () => ({
  listRounds: vi.fn(),
  getStandings: vi.fn(),
  getTournamentStats: vi.fn(),
  generateRound: vi.fn(),
  recordResult: vi.fn(),
}));

import { generateRound, getStandings, getTournamentStats, listRounds, recordResult } from "../services/rounds";

const standingsFor = (tournamentId: string) => ({
  tournamentId,
  pending: false,
  roundsCompleted: 0,
  tiebreaks: [],
  rows: [],
});

describe("rounds store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(listRounds).mockResolvedValue([]);
    vi.mocked(getTournamentStats).mockResolvedValue({} as never);
    vi.mocked(getStandings).mockImplementation(async (id) => standingsFor(id));
  });

  it("re-reads everything from the server after a change, instead of patching it locally", async () => {
    const store = useRoundsStore();
    await store.load("t-1");
    vi.mocked(listRounds).mockClear();

    await store.generate();
    await store.record("m-1", "1-0");

    expect(generateRound).toHaveBeenCalledWith("t-1");
    expect(recordResult).toHaveBeenCalledWith("m-1", "1-0");
    expect(listRounds).toHaveBeenCalledTimes(2);
  });

  it("drops a late answer that belongs to a tournament the viewer already left", async () => {
    const store = useRoundsStore();
    let releaseFirst!: () => void;
    vi.mocked(getStandings).mockImplementationOnce(
      (id) => new Promise((resolve) => (releaseFirst = () => resolve(standingsFor(id)))),
    );

    const first = store.load("t-1");
    await store.load("t-2");
    releaseFirst();
    await first;

    expect(store.tournamentId).toBe("t-2");
    expect(store.standings?.tournamentId).toBe("t-2");
  });

  it("exposes the draft round, if any", async () => {
    vi.mocked(listRounds).mockResolvedValue([
      { id: "r-1", number: 1, status: "STANDINGS_UPDATED", createdAt: "", matches: [] },
      { id: "r-2", number: 2, status: "GENERATED", createdAt: "", matches: [] },
    ]);
    const store = useRoundsStore();

    await store.load("t-1");

    expect(store.draft?.id).toBe("r-2");
  });
});
