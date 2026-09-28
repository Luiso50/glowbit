import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

import { sendOutbidEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function claimMilestones(
  transaction: Prisma.TransactionClient,
  bid: { id: string; brandId: string; amountCents: number },
) {
  const founder = await transaction.milestone.upsert({
    where: { code: "FOUNDER" },
    create: { code: "FOUNDER", title: "Marca fundadora" },
    update: {},
  });
  const firstDollar = await transaction.milestone.upsert({
    where: { code: "FIRST_DOLLAR" },
    create: { code: "FIRST_DOLLAR", title: "Primera puja de $1" },
    update: {},
  });
  const founderExists = await transaction.milestoneClaim.findFirst({
    where: { milestoneId: founder.id },
    select: { id: true },
  });

  if (!founderExists) {
    await transaction.milestoneClaim.create({
      data: { milestoneId: founder.id, brandId: bid.brandId, bidId: bid.id },
    });
  }

  if (bid.amountCents >= 100) {
    const firstDollarExists = await transaction.milestoneClaim.findFirst({
      where: { milestoneId: firstDollar.id },
      select: { id: true },
    });

    if (!firstDollarExists) {
      await transaction.milestoneClaim.create({
        data: { milestoneId: firstDollar.id, brandId: bid.brandId, bidId: bid.id },
      });
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Webhook signature is missing." }, { status: 400 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const bidId = session.metadata?.bidId;

  if (!bidId || !session.payment_intent || session.payment_status !== "paid") {
    return NextResponse.json({ error: "Checkout session is missing bid data." }, { status: 400 });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent.id;

  const result = await prisma.$transaction(async (transaction) => {
    // Every completed payment serializes through this row before changing ranks.
    await transaction.$executeRaw`
      INSERT INTO "LeaderboardState" ("id", "updatedAt")
      VALUES (1, NOW())
      ON CONFLICT ("id") DO NOTHING
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "LeaderboardState" WHERE "id" = 1 FOR UPDATE
    `;

    const bid = await transaction.bid.findUnique({ where: { id: bidId } });

    if (!bid || bid.status !== "PENDING") {
      return { shouldRefund: false as const, paymentIntentId: null as string | null, dethroned: null as null | { to: string; oldBrandName: string; newBrandName: string; newAmountCents: number } };
    }

    if (bid.stripeCheckoutSessionId !== session.id) {
      throw new Error("Checkout session does not belong to this bid.");
    }

    const leader = await transaction.leaderboardEntry.findUnique({
      where: { rank: 1 },
    });
    const leaderBid = leader
      ? await transaction.bid.findUnique({ where: { id: leader.bidId } })
      : null;
    const oldBrand = leader
      ? await transaction.brand.findUnique({ where: { id: leader.brandId } })
      : null;
    const newBrand = await transaction.brand.findUnique({ where: { id: bid.brandId } });

    if (leaderBid && bid.amountCents <= leaderBid.amountCents) {
      await transaction.bid.update({
        where: { id: bid.id },
        data: {
          status: "REFUND_PENDING",
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
        },
      });
      return { shouldRefund: true as const, paymentIntentId, dethroned: null as null | { to: string; oldBrandName: string; newBrandName: string; newAmountCents: number } };
    }

    await transaction.leaderboardEntry.deleteMany({
      where: { OR: [{ brandId: bid.brandId }, { rank: 10 }] },
    });
    await transaction.$executeRaw`
      UPDATE "LeaderboardEntry"
      SET "rank" = -"rank"
      WHERE "rank" BETWEEN 1 AND 9
    `;
    await transaction.$executeRaw`
      UPDATE "LeaderboardEntry"
      SET "rank" = -"rank" + 1
      WHERE "rank" BETWEEN -9 AND -1
    `;
    await transaction.leaderboardEntry.create({
      data: { rank: 1, brandId: bid.brandId, bidId: bid.id },
    });
    await transaction.bid.update({
      where: { id: bid.id },
      data: {
        status: "PAID",
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
    });
    await claimMilestones(transaction, bid);

    const dethroned =
      oldBrand && newBrand && oldBrand.id !== newBrand.id
        ? {
            to: oldBrand.contactEmail,
            oldBrandName: oldBrand.name,
            newBrandName: newBrand.name,
            newAmountCents: bid.amountCents,
          }
        : null;

    return { shouldRefund: false as const, paymentIntentId: null as string | null, dethroned };
  });

  if (result.shouldRefund && result.paymentIntentId) {
    await stripe.refunds.create({ payment_intent: result.paymentIntentId });
    await prisma.bid.update({
      where: { id: bidId },
      data: { status: "REFUNDED" },
    });
  }

  if (result.dethroned) {
    await sendOutbidEmail({
      ...result.dethroned,
      recoverAmountCents: result.dethroned.newAmountCents + 1,
    }).catch((error) => console.error("[webhook] outbid email failed", error));
  }

  return NextResponse.json({ received: true });
}