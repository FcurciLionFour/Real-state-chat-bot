-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScrapingSourceHealthStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'BLOCKED', 'EXPERIMENTAL');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingSourceStatus" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "ScrapingSourceHealthStatus" NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingSourceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingSourceStatus_source_key" ON "ScrapingSourceStatus"("source");

-- CreateIndex
CREATE INDEX "ScrapingSourceStatus_status_idx" ON "ScrapingSourceStatus"("status");
