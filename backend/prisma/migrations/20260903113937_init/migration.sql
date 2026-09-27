-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'state_official', 'public_viewer');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('landslide', 'flood', 'coastal_erosion', 'cloudburst');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('immediate', 'short_term', 'medium_term');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "stateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_zones" (
    "id" TEXT NOT NULL,
    "hazardType" "HazardType" NOT NULL,
    "severityScore" DOUBLE PRECISION NOT NULL,
    "stateCode" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "geom" geometry(Polygon,4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hazard_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "kutchaHousingShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elderlyChildShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "connectivityScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "geom" geometry(Point,4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitation_exposure" (
    "habitationId" TEXT NOT NULL,
    "hazardScores" JSONB NOT NULL,
    "vulnerabilityScore" DOUBLE PRECISION NOT NULL,
    "exposureScore" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habitation_exposure_pkey" PRIMARY KEY ("habitationId")
);

-- CreateTable
CREATE TABLE "relocation_sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "suitabilityScore" DOUBLE PRECISION NOT NULL,
    "capacityPersons" INTEGER NOT NULL,
    "subScores" JSONB NOT NULL,
    "geom" geometry(Polygon,4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relocation_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_events" (
    "id" TEXT NOT NULL,
    "habitationId" TEXT NOT NULL,
    "hazardType" "HazardType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "disaster_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioritization_results" (
    "habitationId" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "componentScores" JSONB NOT NULL,
    "suggestedSiteIds" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prioritization_results_pkey" PRIMARY KEY ("habitationId")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "habitationId" TEXT NOT NULL,
    "previousTier" "Tier" NOT NULL,
    "newTier" "Tier",
    "justification" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "hazard_zones_stateCode_idx" ON "hazard_zones"("stateCode");

-- CreateIndex
CREATE INDEX "hazard_zones_districtCode_idx" ON "hazard_zones"("districtCode");

-- CreateIndex
CREATE INDEX "habitations_stateCode_idx" ON "habitations"("stateCode");

-- CreateIndex
CREATE INDEX "habitations_districtCode_idx" ON "habitations"("districtCode");

-- CreateIndex
CREATE INDEX "relocation_sites_stateCode_idx" ON "relocation_sites"("stateCode");

-- CreateIndex
CREATE INDEX "disaster_events_habitationId_idx" ON "disaster_events"("habitationId");

-- CreateIndex
CREATE INDEX "prioritization_results_tier_idx" ON "prioritization_results"("tier");

-- CreateIndex
CREATE INDEX "audit_log_habitationId_idx" ON "audit_log"("habitationId");

-- CreateIndex (GiST spatial indexes; Prisma's Unsupported("geometry") type
-- can't declare these natively, so they're added by hand per README section 7)
CREATE INDEX "hazard_zones_geom_idx" ON "hazard_zones" USING GIST ("geom");

CREATE INDEX "habitations_geom_idx" ON "habitations" USING GIST ("geom");

CREATE INDEX "relocation_sites_geom_idx" ON "relocation_sites" USING GIST ("geom");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitation_exposure" ADD CONSTRAINT "habitation_exposure_habitationId_fkey" FOREIGN KEY ("habitationId") REFERENCES "habitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_events" ADD CONSTRAINT "disaster_events_habitationId_fkey" FOREIGN KEY ("habitationId") REFERENCES "habitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prioritization_results" ADD CONSTRAINT "prioritization_results_habitationId_fkey" FOREIGN KEY ("habitationId") REFERENCES "habitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_habitationId_fkey" FOREIGN KEY ("habitationId") REFERENCES "habitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
