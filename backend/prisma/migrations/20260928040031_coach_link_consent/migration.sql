-- HU24 + Ley 1581: a coach's link is a request until the player accepts it.
-- Links made before this rule were never consented to, so they start as
-- requests too (accepted_at NULL): the player accepts or declines them.
ALTER TABLE "coach_players" ADD COLUMN "accepted_at" TIMESTAMP(3);
