-- CreateEnum
CREATE TYPE "PromptField" AS ENUM ('TITLE', 'SLUG', 'BODY', 'META_DESCRIPTION', 'EXCERPT', 'TAGS', 'CATEGORY', 'IMAGE_PROMPT', 'JSON_LD', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('TEXT', 'IMAGE');

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "content_type_id" UUID,
    "field" "PromptField" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "model" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "user_prompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_log" (
    "id" UUID NOT NULL,
    "site_id" UUID,
    "prompt_template_id" UUID,
    "content_id" UUID,
    "kind" "AiUsageKind" NOT NULL DEFAULT 'TEXT',
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_templates_site_id_field_idx" ON "prompt_templates"("site_id", "field");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_site_id_content_type_id_field_locale_key" ON "prompt_templates"("site_id", "content_type_id", "field", "locale");

-- CreateIndex
CREATE INDEX "ai_usage_log_site_id_created_at_idx" ON "ai_usage_log"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_log_model_idx" ON "ai_usage_log"("model");
