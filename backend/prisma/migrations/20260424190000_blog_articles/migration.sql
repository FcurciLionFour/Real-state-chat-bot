-- CreateEnum
CREATE TYPE "BlogArticleCategory" AS ENUM ('COMPRA', 'ALQUILER', 'INVERSION', 'TIPS');

-- CreateEnum
CREATE TYPE "BlogArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "BlogArticle" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "category" "BlogArticleCategory" NOT NULL,
    "coverImageUrl" TEXT,
    "contentJson" JSONB NOT NULL,
    "status" "BlogArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "relatedSearchPrompt" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_slug_key" ON "BlogArticle"("slug");

-- CreateIndex
CREATE INDEX "BlogArticle_status_publishedAt_idx" ON "BlogArticle"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "BlogArticle_category_status_idx" ON "BlogArticle"("category", "status");

-- CreateIndex
CREATE INDEX "BlogArticle_authorId_idx" ON "BlogArticle"("authorId");

-- AddForeignKey
ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
