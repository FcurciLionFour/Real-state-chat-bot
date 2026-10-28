-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER';

-- CreateEnum
CREATE TYPE "OwnerPropertyOperationType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "OwnerPropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'OFFICE', 'STORE');

-- CreateEnum
CREATE TYPE "OwnerPropertyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "OwnerProperty" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyCacheId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'OWNER_SUBMITTED',
    "operationType" "OwnerPropertyOperationType" NOT NULL,
    "propertyType" "OwnerPropertyType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "address" TEXT,
    "showExactAddress" BOOLEAN NOT NULL DEFAULT false,
    "currency" "CurrencyCode" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "expenses" DECIMAL(14,2),
    "acceptsCredit" BOOLEAN NOT NULL DEFAULT false,
    "rooms" DECIMAL(4,1),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "coveredAreaM2" DECIMAL(10,2),
    "totalAreaM2" DECIMAL(10,2),
    "floor" TEXT,
    "age" INTEGER,
    "features" JSONB NOT NULL,
    "images" JSONB NOT NULL,
    "mainImageUrl" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactWhatsapp" TEXT,
    "status" "OwnerPropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OwnerProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerProperty_ownerId_updatedAt_idx" ON "OwnerProperty"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "OwnerProperty_status_submittedAt_idx" ON "OwnerProperty"("status", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "OwnerProperty_operationType_propertyType_idx" ON "OwnerProperty"("operationType", "propertyType");

-- CreateIndex
CREATE INDEX "OwnerProperty_city_neighborhood_idx" ON "OwnerProperty"("city", "neighborhood");

-- CreateIndex
CREATE INDEX "OwnerProperty_propertyCacheId_idx" ON "OwnerProperty"("propertyCacheId");

-- AddForeignKey
ALTER TABLE "OwnerProperty" ADD CONSTRAINT "OwnerProperty_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerProperty" ADD CONSTRAINT "OwnerProperty_propertyCacheId_fkey" FOREIGN KEY ("propertyCacheId") REFERENCES "PropertyCache"("id") ON DELETE SET NULL ON UPDATE CASCADE;
