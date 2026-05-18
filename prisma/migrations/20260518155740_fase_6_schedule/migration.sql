-- CreateEnum
CREATE TYPE "PublishJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "PublishJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "bull_job_id" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publish_jobs_scheduled_for_status_idx" ON "publish_jobs"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "publish_jobs_content_id_idx" ON "publish_jobs"("content_id");

-- CreateIndex
CREATE INDEX "contents_site_id_scheduled_for_idx" ON "contents"("site_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
