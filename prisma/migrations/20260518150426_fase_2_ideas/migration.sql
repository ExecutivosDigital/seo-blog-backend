-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('PENDING', 'EXPANDED', 'DISCARDED');

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "content_type_id" UUID NOT NULL,
    "title_seed" TEXT NOT NULL,
    "briefing" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "status" "IdeaStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ideas_site_id_status_idx" ON "ideas"("site_id", "status");

-- CreateIndex
CREATE INDEX "ideas_site_id_content_type_id_idx" ON "ideas"("site_id", "content_type_id");

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
