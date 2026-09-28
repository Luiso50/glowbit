import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 10 || first === 127 || first === 0 || first >= 224 ||
      (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }

  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function isPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;

  try {
    const addresses = await lookup(url.hostname, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

function findImageUrls(html: string, pageUrl: string) {
  const metaMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i);
  const relevanceTerms = ["camion", "camión", "carga", "ruta", "carretera", "transporte", "truck", "freight", "road", "cargo"];
  const candidates = [metaMatch?.[1] && { value: metaMatch[1], score: 1 }];

  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const context = html.slice(Math.max(0, (match.index ?? 0) - 300), (match.index ?? 0) + match[0].length + 300).toLowerCase();
    const score = relevanceTerms.reduce((total, term) => total + (context.includes(term) ? 1 : 0), 0);
    candidates.push({ value: match[1], score });
  }

  return candidates
    .filter((candidate): candidate is { value: string; score: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score)
    .flatMap((candidate) => {
    try {
      const imageUrl = new URL(candidate.value, pageUrl);
      return imageUrl.protocol === "https:" || imageUrl.protocol === "http:" ? [imageUrl.toString()] : [];
    } catch {
      return [];
    }
    });
}

async function getUsableImageUrl(value: string) {
  let currentUrl = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!await isPublicUrl(currentUrl)) return null;

    try {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "Range": "bytes=0-0", "User-Agent": "GlowBit brand image preview" },
        signal: AbortSignal.timeout(5000),
      });
      const location = response.headers.get("location");

      if (response.status >= 300 && response.status < 400 && location) {
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      response.body?.cancel();
      return response.ok && response.headers.get("content-type")?.startsWith("image/") ? currentUrl : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function extractBrandImage(storeUrl: string) {
  let currentUrl = storeUrl;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!await isPublicUrl(currentUrl)) return null;

    try {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "User-Agent": "GlowBit brand image preview" },
        signal: AbortSignal.timeout(5000),
      });
      const location = response.headers.get("location");

      if (response.status >= 300 && response.status < 400 && location) {
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;

      const candidates = findImageUrls(await response.text(), currentUrl);
      for (const candidate of candidates) {
        const imageUrl = await getUsableImageUrl(candidate);
        if (imageUrl) return `${imageUrl}#glowbit-extracted`;
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function getBrandImageUrl(storeUrl: string, logoUrl: string | null) {
  if (logoUrl?.endsWith("#glowbit-extracted") && await getUsableImageUrl(logoUrl)) return logoUrl;
  return extractBrandImage(storeUrl) ?? (logoUrl && await getUsableImageUrl(logoUrl) ? logoUrl : null);
}