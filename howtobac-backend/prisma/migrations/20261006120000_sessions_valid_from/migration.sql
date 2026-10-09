-- One switch that ends every session: access tokens issued before this moment
-- are refused by JwtAuthGuard. Existing rows get "now", so nobody is logged
-- out by the migration itself.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sessions_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
