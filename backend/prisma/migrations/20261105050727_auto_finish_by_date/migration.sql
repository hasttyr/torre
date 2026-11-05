-- A tournament past its end date closes on its own
-- (docs/decisions/010-cierre-automatico-por-fecha.md).

-- The automatic close is recorded with no user: the system did it.
-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;

-- The games still without a result at the close are recorded as FIDE's
-- double forfeit, "0F-0F": the result catalog (RN-03) admits it.
ALTER TABLE "results" DROP CONSTRAINT "results_value_check";
ALTER TABLE "results" ADD CONSTRAINT "results_value_check"
  CHECK ("value" IN ('1-0', '0-1', '1/2-1/2', 'BYE', '0F-0F'));
