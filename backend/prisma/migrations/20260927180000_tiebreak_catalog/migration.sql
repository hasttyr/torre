-- B-B3: tiebreak criteria move from free text to HU13's closed catalog.
CREATE TYPE "Tiebreak" AS ENUM ('BUCHHOLZ', 'BUCHHOLZ_CUT1', 'SONNEBORN_BERGER', 'DIRECT_ENCOUNTER', 'ARO');

-- Names are matched the way the standings calculator used to match them:
-- case, spaces and punctuation ignored. A name it couldn't match was
-- skipped when ranking, so dropping it leaves every standing as it was.
DELETE FROM "tiebreak_criteria"
WHERE lower(regexp_replace("name", '[^a-zA-Z0-9]', '', 'g')) NOT IN (
  'buchholz', 'buchholzcortado1', 'buchholzcut1', 'sonnebornberger', 'resultadoparticular', 'directencounter', 'aro'
);

ALTER TABLE "tiebreak_criteria" ALTER COLUMN "name" TYPE "Tiebreak" USING (
  CASE lower(regexp_replace("name", '[^a-zA-Z0-9]', '', 'g'))
    WHEN 'buchholz' THEN 'BUCHHOLZ'
    WHEN 'buchholzcortado1' THEN 'BUCHHOLZ_CUT1'
    WHEN 'buchholzcut1' THEN 'BUCHHOLZ_CUT1'
    WHEN 'sonnebornberger' THEN 'SONNEBORN_BERGER'
    WHEN 'resultadoparticular' THEN 'DIRECT_ENCOUNTER'
    WHEN 'directencounter' THEN 'DIRECT_ENCOUNTER'
    WHEN 'aro' THEN 'ARO'
  END
)::"Tiebreak";

-- A criterion listed twice (two spellings of one) only counted the first time.
DELETE FROM "tiebreak_criteria" AS later
USING "tiebreak_criteria" AS earlier
WHERE later."tournament_id" = earlier."tournament_id"
  AND later."name" = earlier."name"
  AND later."order" > earlier."order";

-- CreateIndex
CREATE UNIQUE INDEX "tiebreak_criteria_tournament_id_name_key" ON "tiebreak_criteria"("tournament_id", "name");
