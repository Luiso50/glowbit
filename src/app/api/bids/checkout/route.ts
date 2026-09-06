import { NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getSocialVideoEmbedUrl } from "@/lib/social-video";

export const runtime = "nodejs";

type BidRequest = {
  brandName?: string;
  storeUrl?: string;
  contactEmail?: string;
  videoUrl?: string;
  amountCents?: number;
};

function isHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.APP_URL) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let body: BidRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const brandName = body.brandName?.trim();
  const contactEmail = body.contactEmail?.trim().toLowerCase();
  const amountCents = body.amountCents;
  const slug = brandName ? slugify(brandName) : "";

  if (
    !brandName ||
    brandName.length > 80 ||
    !slug ||
    !contactEmail ||
    !isEmail(contactEmail) ||
    !isHttpUrl(body.storeUrl) ||
    (body.videoUrl && !getSocialVideoEmbedUrl(body.videoUrl)) ||
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents < 100
  ) {
    return NextResponse.json({ error: "Invalid bid details." }, { status: 400 });
  }

  const leader = await prisma.leaderboardEntry.findUnique({ where: { rank: 1 } });
  const leaderBid = leader
    ? await prisma.bid.findUnique({ where: { id: leader.bidId } })
    : null;

  if (leaderBid && amountCents <= leaderBid.amountCents) {
    return NextResponse.json(
      { error: "Your bid must exceed the current leader.", minimumCents: leaderBid.amountCents + 1 },
      { status: 409 },
    );
  }

  const existingBrand = await prisma.brand.findUnique({ where: { slug } });
  if (existingBrand && existingBrand.contactEmail !== contactEmail) {
    return NextResponse.json(
      { error: "Esta marca ya existe. Usa el email de contacto registrado." },
      { status: 409 },
    );
  }

  const brand = existingBrand ?? await prisma.brand.create({
    data: {
      name: brandName,
      slug,
      storeUrl: body.storeUrl!,
      videoUrl: body.videoUrl,
      contactEmail,
    },
  });
  const bid = await prisma.bid.create({
    data: { brandId: brand.id, amountCents, currency: "usd" },
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contactEmail,
      metadata: { bidId: bid.id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: `GlowBit bid: ${brand.name}` },
        },
      }],
      success_url: `${process.env.APP_URL}/?bid=success`,
      cancel_url: `${process.env.APP_URL}/?bid=cancelled`,
    });

    await prisma.bid.update({
      where: { id: bid.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    await prisma.bid.update({ where: { id: bid.id }, data: { status: "FAILED" } });
    console.error("Unable to create Stripe Checkout session", error);
    return NextResponse.json({ error: "Unable to start payment." }, { status: 502 });
  }
}