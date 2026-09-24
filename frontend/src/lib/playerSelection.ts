import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";

import type { SubjectPlayer } from "../services/dashboard";

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

/** Creates and provides the selection for the current component's subtree. */
export function providePlayerSelection(options: { hasPlayerWidgets: () => boolean }): PlayerSelection {
  const players = ref<SubjectPlayer[]>([]);
  const selectedId = ref<string | null>(null);
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
