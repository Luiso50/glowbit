import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [entries, milestones] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        orderBy: { rank: "asc" },
        take: 10,
        include: { brand: true, bid: true },
      }),
      prisma.milestoneClaim.findMany({
        orderBy: { claimedAt: "asc" },
        take: 3,
        include: { milestone: true, brand: true },
      }),
    ]);

    return NextResponse.json({
      entries: entries.map((entry) => ({
        rank: entry.rank,
        amountCents: entry.bid.amountCents,
        brand: {
          name: entry.brand.name,
          storeUrl: entry.brand.storeUrl,
          videoUrl: entry.brand.videoUrl,
          logoUrl: entry.brand.logoUrl,
          description: entry.brand.description,
        },
      })),
      milestones: milestones.map((claim) => ({
        code: claim.milestone.code,
        title: claim.milestone.title,
        brandName: claim.brand.name,
      })),
    });
  } catch (error) {
    console.error("Unable to read leaderboard", error);
    return NextResponse.json({ error: "Leaderboard is unavailable." }, { status: 503 });
  }
}