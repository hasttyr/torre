-- Forfeits recorded by hand (docs/decisions/011-incomparecencias.md): whoever
-- records results can write that one side didn't show up (1F-0F, 0F-1F) or
-- neither did (0F-0F, until now only written by the automatic close).
ALTER TABLE "results" DROP CONSTRAINT "results_value_check";
ALTER TABLE "results" ADD CONSTRAINT "results_value_check"
  CHECK ("value" IN ('1-0', '0-1', '1/2-1/2', 'BYE', '1F-0F', '0F-1F', '0F-0F'));
