-- CreateEnum
CREATE TYPE "public"."OptionType" AS ENUM ('CE', 'PE');

-- AlterTable: Instrument.optionType String? -> OptionType?
-- Column has never been populated by any code path, so no data backfill needed.
ALTER TABLE "Instrument" ALTER COLUMN "optionType" TYPE "public"."OptionType" USING ("optionType"::"public"."OptionType");
