import { defineQueryOptions, type QueryCache } from "@pinia/colada";

import { getNotificationSettings, listMyCoaches } from "../services/auth";

// The signed-in person's own data that isn't the session itself (the user
// lives in the auth store: the header and the route guards read it too).

/** HU24, the player's side: the coaches who follow them, and the requests waiting for them. */
export const myCoachesQuery = defineQueryOptions({
  key: ["me", "coaches"],
  query: () => listMyCoaches(),
});

/** #141: the signed-in user's notification choices. */
export const notificationSettingsQuery = defineQueryOptions({
  key: ["me", "notifications"],
  query: () => getNotificationSettings(),
});

/** Marks a coach's request as accepted, as the server just did. */
export function markCoachAccepted(cache: QueryCache, coachId: string): void {
  const acceptedAt = new Date().toISOString();
  cache.setQueryData(myCoachesQuery.key, (coaches = []) =>
    coaches.map((coach) => (coach.id === coachId ? { ...coach, acceptedAt } : coach)),
  );
}

/** Takes a coach (or their request) off the list. */
export function removeMyCoachFromList(cache: QueryCache, coachId: string): void {
  cache.setQueryData(myCoachesQuery.key, (coaches = []) => coaches.filter((coach) => coach.id !== coachId));
}
