-- B-D6: every id (primary and foreign keys) becomes a native uuid instead
-- of text: 16 bytes instead of 36 characters, and the database itself
-- refuses anything that isn't a UUID. Converted in place (USING ::uuid), so
-- every row keeps its id; PostgreSQL runs this script as one transaction, so
-- an id that isn't a UUID makes it fail without changing anything.
--
-- Written by hand: Prisma's draft drops and re-adds each column, which would
-- lose the data. The foreign keys go first (both ends of each must change
-- type) and come back unchanged at the end.

-- Foreign keys, out of the way.
ALTER TABLE "role_widgets" DROP CONSTRAINT "role_widgets_role_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";
ALTER TABLE "players" DROP CONSTRAINT "players_user_id_fkey";
ALTER TABLE "players" DROP CONSTRAINT "players_club_id_fkey";
ALTER TABLE "coach_players" DROP CONSTRAINT "coach_players_coach_id_fkey";
ALTER TABLE "coach_players" DROP CONSTRAINT "coach_players_player_id_fkey";
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_organizer_id_fkey";
ALTER TABLE "rounds" DROP CONSTRAINT "rounds_tournament_id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT "matches_round_id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT "matches_white_id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT "matches_black_id_fkey";
ALTER TABLE "results" DROP CONSTRAINT "results_match_id_fkey";
ALTER TABLE "tiebreak_criteria" DROP CONSTRAINT "tiebreak_criteria_tournament_id_fkey";
ALTER TABLE "standings" DROP CONSTRAINT "standings_tournament_id_fkey";
ALTER TABLE "standings" DROP CONSTRAINT "standings_player_id_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_tournament_id_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_player_id_fkey";
ALTER TABLE "password_reset_requests" DROP CONSTRAINT "password_reset_requests_user_id_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";
ALTER TABLE "data_requests" DROP CONSTRAINT "data_requests_user_id_fkey";

-- Every id column, in place.
ALTER TABLE "audit_logs"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "user_id" SET DATA TYPE UUID USING "user_id"::uuid;

ALTER TABLE "clubs"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;

ALTER TABLE "coach_players"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "coach_id" SET DATA TYPE UUID USING "coach_id"::uuid,
  ALTER COLUMN "player_id" SET DATA TYPE UUID USING "player_id"::uuid;

ALTER TABLE "data_requests"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "user_id" SET DATA TYPE UUID USING "user_id"::uuid;

ALTER TABLE "enrollments"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "tournament_id" SET DATA TYPE UUID USING "tournament_id"::uuid,
  ALTER COLUMN "player_id" SET DATA TYPE UUID USING "player_id"::uuid;

ALTER TABLE "matches"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "round_id" SET DATA TYPE UUID USING "round_id"::uuid,
  ALTER COLUMN "white_id" SET DATA TYPE UUID USING "white_id"::uuid,
  ALTER COLUMN "black_id" SET DATA TYPE UUID USING "black_id"::uuid;

ALTER TABLE "password_reset_requests"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "user_id" SET DATA TYPE UUID USING "user_id"::uuid;

ALTER TABLE "players"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "user_id" SET DATA TYPE UUID USING "user_id"::uuid,
  ALTER COLUMN "club_id" SET DATA TYPE UUID USING "club_id"::uuid;

ALTER TABLE "results"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "match_id" SET DATA TYPE UUID USING "match_id"::uuid;

ALTER TABLE "role_widgets"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "role_id" SET DATA TYPE UUID USING "role_id"::uuid;

ALTER TABLE "roles"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid;

ALTER TABLE "rounds"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "tournament_id" SET DATA TYPE UUID USING "tournament_id"::uuid;

ALTER TABLE "standings"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "tournament_id" SET DATA TYPE UUID USING "tournament_id"::uuid,
  ALTER COLUMN "player_id" SET DATA TYPE UUID USING "player_id"::uuid;

ALTER TABLE "tiebreak_criteria"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "tournament_id" SET DATA TYPE UUID USING "tournament_id"::uuid;

ALTER TABLE "tournaments"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "organizer_id" SET DATA TYPE UUID USING "organizer_id"::uuid;

ALTER TABLE "users"
  ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
  ALTER COLUMN "role_id" SET DATA TYPE UUID USING "role_id"::uuid;

-- Foreign keys, back as they were.
ALTER TABLE "role_widgets" ADD CONSTRAINT "role_widgets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coach_players" ADD CONSTRAINT "coach_players_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coach_players" ADD CONSTRAINT "coach_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_white_id_fkey" FOREIGN KEY ("white_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_black_id_fkey" FOREIGN KEY ("black_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "results" ADD CONSTRAINT "results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tiebreak_criteria" ADD CONSTRAINT "tiebreak_criteria_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "standings" ADD CONSTRAINT "standings_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "standings" ADD CONSTRAINT "standings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
