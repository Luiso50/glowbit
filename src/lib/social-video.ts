export function getSocialVideoEmbedUrl(videoUrl: string | undefined | null) {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "tiktok.com") {
      const match = url.pathname.match(/^\/@[^/]+\/video\/(\d+)/);
      return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
    }

    if (hostname === "instagram.com") {
      const match = url.pathname.match(/^\/(?:p|reel|reels)\/([^/]+)/);
      return match ? `https://www.instagram.com/reel/${match[1]}/embed/captioned/` : null;
    }
  } catch {
    return null;
  }

  return null;
}