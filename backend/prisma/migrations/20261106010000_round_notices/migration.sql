-- #141: whether the user gets an email when a round of a tournament they
-- play is published. On by default: it's part of organizing the tournament
-- (the data policy's purposes); the user turns it off from their account.
ALTER TABLE "users" ADD COLUMN "round_notices" BOOLEAN NOT NULL DEFAULT true;
