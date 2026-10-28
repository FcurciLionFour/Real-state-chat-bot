-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('BUY', 'RENT');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('USD', 'ARS');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'PH', 'LAND', 'OFFICE', 'LOCAL', 'GARAGE');

-- CreateEnum
CREATE TYPE "SearchRunStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'STALE', 'REMOVED', 'FETCH_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSearchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchState" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "parentSearchRunId" TEXT,
    "filtersSnapshotJson" JSONB NOT NULL,
    "queryText" TEXT NOT NULL,
    "requestedPage" INTEGER NOT NULL DEFAULT 1,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "sourcesUsedJson" JSONB NOT NULL,
    "status" "SearchRunStatus" NOT NULL,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyCache" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "canonicalHash" TEXT NOT NULL,
    "rawPayloadJson" JSONB NOT NULL,
    "normalizedPayloadJson" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "locationText" TEXT,
    "operation" "OperationType",
    "propertyType" "PropertyType",
    "priceAmount" DECIMAL(14,2),
    "priceCurrency" "CurrencyCode",
    "expensesAmount" DECIMAL(14,2),
    "rooms" DECIMAL(4,1),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaTotal" DECIMAL(10,2),
    "areaCovered" DECIMAL(10,2),
    "featuresJson" JSONB NOT NULL,
    "imagesJson" JSONB NOT NULL,
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "publishedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRunProperty" (
    "id" TEXT NOT NULL,
    "searchRunId" TEXT NOT NULL,
    "propertyCacheId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rankScore" DECIMAL(10,4) NOT NULL,
    "rankReasonJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRunProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyCacheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SearchState_conversationId_key" ON "SearchState"("conversationId");

-- CreateIndex
CREATE INDEX "SearchState_updatedAt_idx" ON "SearchState"("updatedAt");

-- CreateIndex
CREATE INDEX "SearchRun_conversationId_idx" ON "SearchRun"("conversationId");

-- CreateIndex
CREATE INDEX "SearchRun_conversationId_createdAt_idx" ON "SearchRun"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchRun_status_idx" ON "SearchRun"("status");

-- CreateIndex
CREATE INDEX "SearchRun_parentSearchRunId_idx" ON "SearchRun"("parentSearchRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyCache_sourceUrl_key" ON "PropertyCache"("sourceUrl");

-- CreateIndex
CREATE INDEX "PropertyCache_canonicalHash_idx" ON "PropertyCache"("canonicalHash");

-- CreateIndex
CREATE INDEX "PropertyCache_source_externalId_idx" ON "PropertyCache"("source", "externalId");

-- CreateIndex
CREATE INDEX "PropertyCache_city_neighborhood_idx" ON "PropertyCache"("city", "neighborhood");

-- CreateIndex
CREATE INDEX "PropertyCache_operation_propertyType_idx" ON "PropertyCache"("operation", "propertyType");

-- CreateIndex
CREATE INDEX "PropertyCache_priceCurrency_priceAmount_idx" ON "PropertyCache"("priceCurrency", "priceAmount");

-- CreateIndex
CREATE INDEX "PropertyCache_scrapedAt_idx" ON "PropertyCache"("scrapedAt" DESC);

-- CreateIndex
CREATE INDEX "PropertyCache_listingStatus_idx" ON "PropertyCache"("listingStatus");

-- CreateIndex
CREATE INDEX "SearchRunProperty_propertyCacheId_idx" ON "SearchRunProperty"("propertyCacheId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRunProperty_searchRunId_propertyCacheId_key" ON "SearchRunProperty"("searchRunId", "propertyCacheId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRunProperty_searchRunId_position_key" ON "SearchRunProperty"("searchRunId", "position");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_propertyCacheId_key" ON "Favorite"("userId", "propertyCacheId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchState" ADD CONSTRAINT "SearchState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_parentSearchRunId_fkey" FOREIGN KEY ("parentSearchRunId") REFERENCES "SearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunProperty" ADD CONSTRAINT "SearchRunProperty_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunProperty" ADD CONSTRAINT "SearchRunProperty_propertyCacheId_fkey" FOREIGN KEY ("propertyCacheId") REFERENCES "PropertyCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_propertyCacheId_fkey" FOREIGN KEY ("propertyCacheId") REFERENCES "PropertyCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;

