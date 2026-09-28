import { NextResponse } from "next/server";

import { getBrandImageUrl } from "@/lib/brand-image";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

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

    const entriesWithImages = await Promise.all(entries.map(async (entry) => {
      const logoUrl = await getBrandImageUrl(entry.brand.storeUrl, entry.brand.logoUrl);

      if (logoUrl && !entry.brand.logoUrl) {
        await prisma.brand.update({ where: { id: entry.brand.id }, data: { logoUrl } });
      }

      return {
        rank: entry.rank,
        amountCents: entry.bid.amountCents,
        crownedAt: (entry.bid.paidAt ?? entry.updatedAt).toISOString(),
        brand: {
          name: entry.brand.name,
          storeUrl: entry.brand.storeUrl,
          videoUrl: entry.brand.videoUrl,
          logoUrl,
          description: entry.brand.description,
        },
      };
    }));

    return NextResponse.json({
      entries: entriesWithImages,
      milestones: milestones.map((claim) => ({
        code: claim.milestone.code,
        title: claim.milestone.title,
        brandName: claim.brand.name,
      })),
    });
  } catch (error) {
    console.error("Unable to read leaderboard", error);
    return NextResponse.json({ error: "Unable to load leaderboard." }, { status: 503 });
  }
}