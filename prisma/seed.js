const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const brands = [
  ["sae-soi", "Sae Soi", 100, "Skincare de Seul con formulas ligeras y una devocion por la piel luminosa."],
];

async function main() {
  const seeded = [];

  for (const [slug, name, amountCents, description] of brands) {
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: {
        slug,
        name,
        storeUrl: "https://example.com",
        contactEmail: "hello@example.com",
        description,
      },
      update: { name, description },
    });
    let bid = await prisma.bid.findFirst({
      where: { brandId: brand.id, amountCents, status: "PAID" },
      orderBy: { createdAt: "desc" },
    });

    if (!bid) {
      bid = await prisma.bid.create({
        data: { brandId: brand.id, amountCents, status: "PAID", paidAt: new Date() },
      });
    }
    seeded.push({ brand, bid });
  }

  for (const [index, item] of seeded.entries()) {
    await prisma.leaderboardEntry.upsert({
      where: { rank: index + 1 },
      create: { rank: index + 1, brandId: item.brand.id, bidId: item.bid.id },
      update: { brandId: item.brand.id, bidId: item.bid.id },
    });
  }

  const founder = await prisma.milestone.upsert({
    where: { code: "FOUNDER" },
    create: { code: "FOUNDER", title: "Marca fundadora" },
    update: {},
  });
  const firstDollar = await prisma.milestone.upsert({
    where: { code: "FIRST_DOLLAR" },
    create: { code: "FIRST_DOLLAR", title: "Primera puja de $1" },
    update: {},
  });
  const leader = seeded[0];
  await prisma.milestoneClaim.upsert({
    where: { milestoneId_bidId: { milestoneId: founder.id, bidId: leader.bid.id } },
    create: { milestoneId: founder.id, brandId: leader.brand.id, bidId: leader.bid.id },
    update: {},
  });
  await prisma.milestoneClaim.upsert({
    where: { milestoneId_bidId: { milestoneId: firstDollar.id, bidId: leader.bid.id } },
    create: { milestoneId: firstDollar.id, brandId: leader.brand.id, bidId: leader.bid.id },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });