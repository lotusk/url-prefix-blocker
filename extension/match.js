export const DEFAULT_PREFIXES = ["youtube.com/shorts"];

export function normalizePrefix(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function isBlocked(url, prefixes) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  const path = (u.pathname + u.search).toLowerCase();

  return prefixes.some((p) => {
    const i = p.indexOf("/");
    const pHost = i === -1 ? p : p.slice(0, i);
    const pPath = i === -1 ? "" : p.slice(i);
    if (!pHost) return false;
    // Subdomains count too, so "youtube.com" also covers www. and m.
    const hostOk = host === pHost || host.endsWith("." + pHost);
    return hostOk && path.startsWith(pPath);
  });
}
