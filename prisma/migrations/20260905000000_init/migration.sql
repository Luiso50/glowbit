CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'FAILED');

CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaderboardState" (
    "id" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaderboardState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "brandId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MilestoneClaim" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "Bid_stripeCheckoutSessionId_key" ON "Bid"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Bid_stripePaymentIntentId_key" ON "Bid"("stripePaymentIntentId");
CREATE INDEX "Bid_status_amountCents_idx" ON "Bid"("status", "amountCents");
CREATE INDEX "Bid_brandId_createdAt_idx" ON "Bid"("brandId", "createdAt");
CREATE UNIQUE INDEX "LeaderboardEntry_rank_key" ON "LeaderboardEntry"("rank");
CREATE UNIQUE INDEX "LeaderboardEntry_brandId_key" ON "LeaderboardEntry"("brandId");
CREATE UNIQUE INDEX "LeaderboardEntry_bidId_key" ON "LeaderboardEntry"("bidId");
CREATE INDEX "LeaderboardEntry_rank_idx" ON "LeaderboardEntry"("rank");
CREATE UNIQUE INDEX "Milestone_code_key" ON "Milestone"("code");
CREATE UNIQUE INDEX "MilestoneClaim_milestoneId_brandId_key" ON "MilestoneClaim"("milestoneId", "brandId");
CREATE UNIQUE INDEX "MilestoneClaim_milestoneId_bidId_key" ON "MilestoneClaim"("milestoneId", "bidId");

ALTER TABLE "Bid" ADD CONSTRAINT "Bid_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;