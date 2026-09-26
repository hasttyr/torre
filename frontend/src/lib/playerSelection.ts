import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";

import type { SubjectPlayer } from "../services/dashboard";
import { useQueryParam } from "./useQueryParam";

// The dashboard's shared "which player am I looking at" state. Provided once
// by the dashboard view and injected by any widget that needs it, so widgets
// stay plain components with no props to thread through the dynamic
// <component :is> that renders them.

export interface PlayerSelection {
  players: Ref<SubjectPlayer[]>;
  selectedId: Ref<string | null>;
  selectedName: ComputedRef<string | null>;
  // Whether picking a player changes anything: some widget on the dashboard
  // is about one player, and there's more than one to pick from.
  enabled: ComputedRef<boolean>;
  canSelect: (playerId: string) => boolean;
  select: (playerId: string) => void;
}

const PLAYER_SELECTION: InjectionKey<PlayerSelection> = Symbol("playerSelection");

/**
 * The selection kept in the URL (`?jugador=<id>`), so a link opens the
 * dashboard on that player: a valid id from the URL, else the first player,
 * who needs no param.
 */
function urlBackedSelection(name: string, players: Ref<SubjectPlayer[]>): Ref<string | null> {
  const param = useQueryParam(name);
  return computed({
    get: () => players.value.find((player) => player.id === param.value)?.id ?? players.value[0]?.id ?? null,
    set: (playerId) => {
      param.value = playerId === null || playerId === players.value[0]?.id ? "" : playerId;
    },
  });
}

/**
 * Creates and provides the selection for the current component's subtree.
 *
 * @param options.urlParam - query param to keep the selected player in; without
 *   it, the selection starts empty and lives only in memory.
 */
export function providePlayerSelection(options: {
  hasPlayerWidgets: () => boolean;
  urlParam?: string;
}): PlayerSelection {
  const players = ref<SubjectPlayer[]>([]);
  const selectedId = options.urlParam ? urlBackedSelection(options.urlParam, players) : ref<string | null>(null);
  const enabled = computed(() => options.hasPlayerWidgets() && players.value.length > 1);

  const canSelect = (playerId: string): boolean =>
    enabled.value && players.value.some((player) => player.id === playerId);

  const selection: PlayerSelection = {
    players,
    selectedId,
    selectedName: computed(() => players.value.find((player) => player.id === selectedId.value)?.name ?? null),
    enabled,
    canSelect,
    select: (playerId) => {
      if (canSelect(playerId)) selectedId.value = playerId;
    },
  };

  provide(PLAYER_SELECTION, selection);
  return selection;
}

/** Injects the dashboard's player selection. Outside a dashboard, nothing is ever selected. */
export function usePlayerSelection(): PlayerSelection {
  return (
    inject(PLAYER_SELECTION, null) ?? {
      players: ref([]),
      selectedId: ref(null),
      selectedName: computed(() => null),
      enabled: computed(() => false),
      canSelect: () => false,
      select: () => undefined,
    }
  );
}
