-- AlterTable
-- Add reset_token and reset_token_expires to public.users for password recovery flow
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires" TIMESTAMP(3);
