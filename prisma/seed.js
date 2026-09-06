const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const brands = [
  ["sae-soi", "Sae Soi", 5000, "Skincare de Seul con formulas ligeras y una devocion por la piel luminosa."],
  ["melted-cloud", "Melted Cloud", 4800],
  ["dewdrop-lab", "Dewdrop Lab", 4200],
  ["serein-seoul", "Serein Seoul", 3800],
  ["mori-skin", "Mori Skin", 3100],
  ["hush-beauty", "Hush Beauty", 2800],
  ["otona", "Otona", 2600],
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
  const firstFifty = await prisma.milestone.upsert({
    where: { code: "FIRST_FIFTY" },
    create: { code: "FIRST_FIFTY", title: "Primera puja de $50" },
    update: {},
  });
  const leader = seeded[0];
  await prisma.milestoneClaim.upsert({
    where: { milestoneId_bidId: { milestoneId: founder.id, bidId: leader.bid.id } },
    create: { milestoneId: founder.id, brandId: leader.brand.id, bidId: leader.bid.id },
    update: {},
  });
  await prisma.milestoneClaim.upsert({
    where: { milestoneId_bidId: { milestoneId: firstFifty.id, bidId: leader.bid.id } },
    create: { milestoneId: firstFifty.id, brandId: leader.brand.id, bidId: leader.bid.id },
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