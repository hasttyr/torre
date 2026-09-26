-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "pairing_number" INTEGER;

-- AlterTable
ALTER TABLE "standings" ADD COLUMN     "rank" INTEGER;

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "bye_points" DECIMAL(2,1) NOT NULL DEFAULT 1;

-- AddCheckConstraint (HU28: a bye is worth a full point, half a point or nothing)
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_bye_points_check"
  CHECK ("bye_points" IN (0, 0.5, 1));
