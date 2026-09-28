type OutbidEmailParams = {
  to: string;
  oldBrandName: string;
  newBrandName: string;
  newAmountCents: number;
  recoverAmountCents: number;
};

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export async function sendOutbidEmail(params: OutbidEmailParams) {
  const appUrl = process.env.APP_URL ?? "https://glowbit.vercel.app";
  const from = process.env.EMAIL_FROM ?? "GlowBit <notificaciones@glowbit.app>";
  const subject = "Te superaron en GlowBit 👑";
  const recoverUrl = `${appUrl}/#top`;
  const text = [
    `Hola ${params.oldBrandName},`,
    "",
    `${params.newBrandName} acaba de reclamar la corona con ${formatUSD(params.newAmountCents)}.`,
    "",
    `Recupérala por ${formatUSD(params.recoverAmountCents)} aquí: ${recoverUrl}`,
    "",
    "- El equipo de GlowBit",
  ].join("\n");
  const html = `
    <div style="font-family: sans-serif; max-width: 520px">
      <h2>Te superaron en GlowBit 👑</h2>
      <p><strong>${params.newBrandName}</strong> acaba de reclamar la corona con <strong>${formatUSD(params.newAmountCents)}</strong>.</p>
      <p><a href="${recoverUrl}" style="display:inline-block;padding:12px 20px;background:#000;color:#fff;text-decoration:none;border-radius:8px">Recuperar por ${formatUSD(params.recoverAmountCents)}</a></p>
      <p style="color:#666;font-size:12px">GlowBit - La marca que todos quieren mirar.</p>
    </div>
  `;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("[email:dev] Outbid email", { to: params.to, subject, text });
    return { sent: false, reason: "no-resend-key" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: params.to, subject, html, text }),
    });

    if (!response.ok) {
      console.error("[email] Resend failed", await response.text());
      return { sent: false, reason: "resend-error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("[email] send failed", error);
    return { sent: false, reason: "exception" };
  }
}
