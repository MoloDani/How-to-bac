-- Changing your email: the new address is parked here until it's confirmed from
-- its own inbox, so a typo can't lock you out of the account.

-- AlterEnum
ALTER TYPE "AuthTokenPurpose" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pending_email" VARCHAR(255);
