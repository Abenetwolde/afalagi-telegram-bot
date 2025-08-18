/*
  Warnings:

  - You are about to drop the `Reputation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Reputation" DROP CONSTRAINT "Reputation_userId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "telegramId" SET DATA TYPE BIGINT;

-- DropTable
DROP TABLE "public"."Reputation";
