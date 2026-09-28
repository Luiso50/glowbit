"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

import { getSocialVideoEmbedUrl } from "@/lib/social-video";

type RankingEntry = {
  rank: number;
  amountCents: number;
  crownedAt?: string | null;
  brand: { name: string; storeUrl: string; videoUrl?: string | null; logoUrl?: string | null; description?: string | null };
};

type MilestoneEntry = { code: string; title: string; brandName: string };

const sampleEntries: RankingEntry[] = [
  { rank: 1, amountCents: 100, brand: { name: "Sae Soi", storeUrl: "https://example.com", description: "Skincare de Seul con formulas ligeras y una devocion por la piel luminosa." } },
];

const sampleMilestones: MilestoneEntry[] = [
  { code: "001", title: "Marca fundadora", brandName: "Sae Soi" },
  { code: "002", title: "Primera puja de $1", brandName: "Sae Soi" },
  { code: "003", title: "La más observada", brandName: "Próximamente" },
];

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatCrownDuration(iso?: string | null, nowMs?: number) {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return null;
  const diffMs = (nowMs ?? Date.now()) - start;
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "En la cima desde hace unos segundos";
  if (mins < 60) return `En la cima desde hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `En la cima desde hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "En la cima desde hace 1 día" : `En la cima desde hace ${days} días`;
}

export default function Home() {
  const [isBidOpen, setIsBidOpen] = useState(false);
  const [amount, setAmount] = useState("1.01");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [entries, setEntries] = useState(sampleEntries);
  const [milestones, setMilestones] = useState(sampleMilestones);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const leader = entries[0];
  const crownDuration = formatCrownDuration(leader.crownedAt, nowMs);
  const videoEmbedUrl = getSocialVideoEmbedUrl(leader.brand.videoUrl);
  const minimumCents = leader.amountCents + 1;
  const minimumBid = minimumCents / 100;
  const isValid = Number(amount) >= minimumBid;

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { entries?: RankingEntry[]; milestones?: MilestoneEntry[] } | null) => {
        if (data?.entries?.length) {
          setEntries(data.entries);
          const nextMinimumCents = data.entries[0].amountCents + 1;
          setAmount((currentAmount) => Math.round(Number(currentAmount) * 100) < nextMinimumCents
            ? (nextMinimumCents / 100).toFixed(2)
            : currentAmount);
        }
        if (data?.milestones?.length) setMilestones(data.milestones);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const bidResult = new URLSearchParams(window.location.search).get("bid");
    const notice = bidResult === "success"
      ? "Pago recibido. Confirmaremos tu puesto en cuanto Stripe procese la puja."
      : bidResult === "cancelled"
        ? "El pago se ha cancelado. Tu puja no se ha registrado."
        : "";
    if (notice) {
      window.setTimeout(() => setPaymentNotice(notice), 0);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setSubmissionError("");

    try {
      const response = await fetch("/api/bids/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: formData.get("brandName"),
          storeUrl: formData.get("storeUrl"),
          contactEmail: formData.get("contactEmail"),
          videoUrl: formData.get("videoUrl") || undefined,
          amountCents: Math.round(Number(amount) * 100),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.checkoutUrl) {
        setSubmissionError(result.error ?? "No se pudo crear la puja.");
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setSubmissionError("No se pudo conectar con el pago. Intentalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return <main>
    <nav className="nav shell"><a className="wordmark" href="#top">GLOW<span>BIT</span></a><p>THE GLOW LIST / ASIA</p><button className="nav-action" onClick={() => setIsBidOpen(true)}>Reclamar corona</button></nav>
    {paymentNotice && <p className="payment-notice shell" role="status">{paymentNotice}</p>}
    <section className="hero shell" id="top"><div className="hero-copy"><p className="eyebrow">AHORA MISMO / 001</p><h1>La marca que todos quieren mirar.</h1><p className="intro">Una lista viva de las marcas de belleza indie que estan definiendo el proximo brillo.</p><button className="primary-button" onClick={() => setIsBidOpen(true)}>Ver la corona actual <span>+</span></button></div><div className="hero-image" aria-label={`Contenido de ${leader.brand.name}`}>{leader.brand.logoUrl ? <Image className="hero-brand-image" src={leader.brand.logoUrl} alt={`Imagen de ${leader.brand.name}`} fill sizes="(max-width: 700px) 100vw, 56vw" unoptimized /> : videoEmbedUrl ? <iframe className="hero-video" src={videoEmbedUrl} title={`Video de ${leader.brand.name}`} allowFullScreen /> : <><div className="product-shadow" /><div className="product-cap" /><div className="product-bottle"><span>{leader.brand.name}</span></div><div className="shine" /></>}</div></section>
    <section className="leader shell"><div className="leader-label"><span>01</span><p>THE GLOW<br />QUEEN</p></div><div className="leader-body"><p className="eyebrow">LIDER DEL MOMENTO</p><h2>{leader.brand.name}</h2><p>{leader.brand.description ?? "Una marca que esta definiendo el proximo brillo."}</p><a href={leader.brand.storeUrl} target="_blank" rel="noreferrer">Visitar la tienda <span>↗</span></a></div><div className="leader-bid"><p>PUJA GANADORA</p><strong>{formatCurrency(leader.amountCents)}</strong>{crownDuration && <p className="crown-duration">{crownDuration}</p>}<button onClick={() => setIsBidOpen(true)}>Superar por {formatCurrency(minimumCents)}</button></div></section>
    <section className="ranking shell"><div className="section-heading"><p className="eyebrow">LAS QUE ARDEN</p><h2>The Hot 10</h2><p>Las marcas que no se conforman con pasar desapercibidas.</p></div><div className="ranking-list">{entries.slice(1).map((entry) => <article className="ranking-row" key={entry.rank}><span className="rank">{String(entry.rank).padStart(2, "0")}</span><span className="brand-mark">{initials(entry.brand.name)}</span><h3>{entry.brand.name}</h3><span className="row-bid">{formatCurrency(entry.amountCents)}</span><a href={entry.brand.storeUrl} target="_blank" rel="noreferrer" aria-label={`Visitar ${entry.brand.name}`}>↗</a></article>)}</div></section>
    <section className="milestones"><div className="shell milestones-grid"><div><p className="eyebrow">PARA SIEMPRE</p><h2>Glow<br />Milestones</h2></div>{milestones.map((milestone, index) => <Milestone key={milestone.code} number={String(index + 1).padStart(3, "0")} label={milestone.title} name={milestone.brandName} />)}</div></section>
    <footer className="shell"><span>GLOWBIT / 2026</span><span>HECHO PARA MARCAS CON ALGO QUE DECIR.</span></footer>
    {isBidOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crear una puja"><form className="bid-modal" onSubmit={handleSubmit}><button type="button" className="close" aria-label="Cerrar" onClick={() => setIsBidOpen(false)}>×</button><p className="eyebrow">RECLAMA LA CORONA</p><h2>Tu brillo, en lo más alto.</h2><label>Nombre de marca<input name="brandName" required placeholder="Tu marca" /></label><label>URL de tu tienda<input name="storeUrl" type="url" required placeholder="https://" /></label><label>Email de contacto<input name="contactEmail" type="email" required placeholder="hola@tumarca.com" /></label><label>URL de TikTok o Instagram (opcional)<input name="videoUrl" type="url" placeholder="https://tiktok.com/@marca/video/..." /></label><label>Monto de la puja (USD)<input type="number" min={minimumBid} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><p className={isValid ? "validation valid" : "validation"}>La puja mínima es {formatCurrency(minimumCents)}</p>{submissionError && <p className="validation">{submissionError}</p>}<button className="primary-button" type="submit" disabled={!isValid || isSubmitting}>{isSubmitting ? "Preparando pago..." : "Continuar al pago"}<span>→</span></button></form></div>}
  </main>;
}

function Milestone({ number, label, name }: { number: string; label: string; name: string }) {
  return <div className="milestone"><span>{number}</span><p>{label}</p><strong>{name}</strong></div>;
}