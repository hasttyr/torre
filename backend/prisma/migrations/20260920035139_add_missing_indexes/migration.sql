-- CreateIndex
CREATE INDEX "coach_players_player_id_idx" ON "coach_players"("player_id");

-- CreateIndex
CREATE INDEX "enrollments_player_id_idx" ON "enrollments"("player_id");

-- CreateIndex
CREATE INDEX "matches_round_id_idx" ON "matches"("round_id");

-- CreateIndex
CREATE INDEX "matches_white_id_idx" ON "matches"("white_id");

-- CreateIndex
CREATE INDEX "matches_black_id_idx" ON "matches"("black_id");

-- CreateIndex
CREATE INDEX "players_club_id_idx" ON "players"("club_id");

-- CreateIndex
CREATE INDEX "standings_player_id_idx" ON "standings"("player_id");

-- CreateIndex
CREATE INDEX "tournaments_organizer_id_idx" ON "tournaments"("organizer_id");
