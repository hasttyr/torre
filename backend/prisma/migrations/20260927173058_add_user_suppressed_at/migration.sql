-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suppressed_at" TIMESTAMP(3);

-- Accounts suppressed before this column existed (HU22 anonymizes them to
-- "eliminado-<id>@torre.invalid"): mark them, and make their old password
-- unusable, so an administrator can no longer reactivate them.
UPDATE "users"
SET "suppressed_at" = "updated_at", "password_hash" = '!suppressed'
WHERE "email" LIKE 'eliminado-%@torre.invalid';
