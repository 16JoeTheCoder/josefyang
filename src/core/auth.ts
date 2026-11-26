/**
 * Cloudflare Access JWT verification (architecture §14.2): defence in depth behind the Access app.
 * RS256 signature against the team's public keys, aud, exp, and email = ADMIN_EMAIL.
 */
interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
let jwksCache: { at: number; team: string; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function keys(team: string): Promise<Jwk[]> {
  if (jwksCache && jwksCache.team === team && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), team, keys: body.keys };
  return body.keys;
}

export interface AuthEnv { CF_ACCESS_AUD?: string; CF_ACCESS_TEAM_DOMAIN?: string; ADMIN_EMAIL: string; DEV_ADMIN_BYPASS?: string }

export function isLocalHost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/** ADMIN_EMAIL may hold several comma-separated addresses. */
function allowedEmails(env: AuthEnv): string[] {
  return env.ADMIN_EMAIL.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Returns the verified admin email, or null.
 * Cookies: this app sets none. Cloudflare Access issues its own host-only CF_Authorization cookie for the admin host.
 * Never add a parent-domain cookie (a Domain attribute naming josefyang.com): every game subdomain would receive
 * it, and a game could then read or replay the admin session.
 */
export async function verifyAdmin(request: Request, env: AuthEnv): Promise<string | null> {
  const url = new URL(request.url);
  // Local development only: needs the flag, a localhost URL, and no Access config (production always has CF_ACCESS_AUD).
  if (env.DEV_ADMIN_BYPASS === "1" && isLocalHost(url) && !env.CF_ACCESS_AUD) return allowedEmails(env)[0] ?? null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { kid?: string; alg?: string };
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as { aud?: string | string[]; exp?: number; nbf?: number; email?: string; iss?: string };
    if (header.alg !== "RS256") return null;
    const team = env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const jwk = (await keys(team)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.CF_ACCESS_AUD)) return null;
    if (!payload.exp || payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now + 60) return null;
    if (payload.iss && payload.iss !== `https://${team}`) return null;
    if (!payload.email || !allowedEmails(env).includes(payload.email.toLowerCase())) return null;
    return payload.email;
  } catch {
    return null;
  }
}
