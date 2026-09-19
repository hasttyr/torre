-- AddCheckConstraint (Integrity restriction #2: whiteId != blackId)
ALTER TABLE "matches" ADD CONSTRAINT "matches_white_black_check"
  CHECK ("white_id" IS NULL OR "black_id" IS NULL OR "white_id" <> "black_id");

-- AddCheckConstraint (Integrity restriction #3: catalog of valid result values, RN-03)
ALTER TABLE "results" ADD CONSTRAINT "results_value_check"
  CHECK ("value" IN ('1-0', '0-1', '1/2-1/2', 'BYE'));
