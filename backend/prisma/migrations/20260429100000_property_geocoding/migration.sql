ALTER TABLE "PropertyCache"
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7),
ADD COLUMN "geoPrecision" TEXT,
ADD COLUMN "geocodingProvider" TEXT,
ADD COLUMN "geocodedAt" TIMESTAMP(3);

CREATE INDEX "PropertyCache_latitude_longitude_idx" ON "PropertyCache"("latitude", "longitude");
