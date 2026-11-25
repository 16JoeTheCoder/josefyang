# Game contract

How a game plugs into josefyang.com. Each game is its own small web app on its own subdomain (for example `modulus.josefyang.com`), installable as a PWA. The hub at `game.josefyang.com` lists them and links out; the hub never hosts a game.

## 1. Hosting

- Own repo, own Cloudflare Workers project (static assets are fine), own custom domain `<slug>.josefyang.com`.
- The `<slug>` is the same slug you give the game in Admin → Games. It is also the `game` value used to fetch its devlogs.
- Deploy with `npx wrangler deploy` from the game repo. Add the custom domain in Cloudflare dashboard → Workers & Pages → the game's Worker → Settings → Domains & Routes → Add → Custom domain.

## 2. PWA requirements

Needed for "Install app" on Android Chrome and "Add to Home Screen" on iOS Safari.

- `manifest.webmanifest` served as `application/manifest+json`: `name`, `short_name`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color`, `theme_color`, `icons`.
- Icons: `192×192` PNG, `512×512` PNG, and a `512×512` PNG with `"purpose": "maskable"` (keep the artwork inside the central 80%).
- `apple-touch-icon` 180×180 PNG: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
- In `<head>`: `<meta name="theme-color" content="...">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="Name">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Service worker registered at `/sw.js` (scope `/`) that pre-caches an offline shell (HTML, JS, CSS, icons) on `install`, serves it cache-first, and falls back to the cached shell when a navigation fails offline. Bump a cache version string on every release so old caches are deleted in `activate`.
- HTTPS only (custom domains on Cloudflare already are).

## 3. Register the game in Admin → Games

Admin → Games → "New game name" → Create game, then fill the form and press Publish. Images are uploaded through the normal picker (Choose or upload):

| Field | Size | Notes |
|---|---|---|
| Icon | 512 × 512, square | Shown 64–120 px. Use the same artwork as the PWA icon. |
| Cover | 1600 × 900 (16:9) | Hub card and top of the game page. |
| Screenshots (up to 8) | 1600 × 900 (16:9) | Each needs alt text and an optional caption. |
| Trailer + poster | short MP4, poster 1600 × 900 | Video upload arrives with project packs; poster is required once a trailer is set. |

Also set: Game address (`https://<slug>.josefyang.com`), Status, Platforms, Genres (up to 3), Play button label. Alt text is required on every image before Publish is allowed. Order on the hub: Admin → Games → Move up / Move down. Hub headings and the install notes: Admin → Game hub text.

## 4. Fetch the game's devlogs

Public, CORS-enabled for `https://*.josefyang.com` and localhost, cached 5 minutes:

`GET https://josefyang.com/api/public/v1/posts?site=games&game=<slug>` (optional `type=note|article`, `limit`)

```json
{
  "format": "josefyang-posts/1",
  "posts": [{
    "slug": "ring-physics", "title": "Rings that snap", "type": "note",
    "excerpt": "…", "date": "2026-11-20", "tags": ["physics"],
    "url": "https://josefyang.com/devlog/ring-physics",
    "cover": { "src": "/media/m/ab12cd34/960.webp", "w": 1600, "h": 900, "alt": "…" },
    "build": { "slug": "modulus", "title": "Modulus" },
    "game": "modulus", "html": "<p>…</p>", "readMinutes": 3
  }]
}
```

`cover.src` is relative to `https://josefyang.com`. `html` is sanitised, ready to inject. Link titles to `url` (the canonical page).

```js
const FEED = "https://josefyang.com/api/public/v1/posts?site=games&game=modulus";
export async function devlogs() {
  try {
    const res = await fetch(FEED);
    if (!res.ok) throw new Error(res.status);
    const { posts } = await res.json();
    localStorage.setItem("devlogs", JSON.stringify({ at: Date.now(), posts }));
    return posts;
  } catch {
    const old = JSON.parse(localStorage.getItem("devlogs") || "null");
    return old ? old.posts : []; // offline: last good copy
  }
}
```

The service worker should not cache the feed itself; the HTTP cache plus the localStorage copy above is enough.

## 5. Link back to the hub

Put a visible link to `https://game.josefyang.com` (for example "More games") in the game's menu or footer, and to `https://josefyang.com` for the author.

## 6. Cookies and storage

- Never set a cookie with a `Domain` attribute for `.josefyang.com`. It would be sent to every game and to the main site. Leave cookies host-only, or use `localStorage` (per origin, so safe).
- The admin runs on `josefyang.com`; Cloudflare Access keeps its own host-only cookie there. The main app sets no cookies of its own (checked by `tests/game-host.test.ts`).

## 7. CSP tips

Set headers on the game's Worker (`public/_headers` for static assets):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://josefyang.com; connect-src 'self' https://josefyang.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Add `https://josefyang.com` to `img-src` only if you show devlog cover images. Avoid `'unsafe-eval'`. Do not allow the hub to frame the game (`frame-ancestors 'none'`); the hub links out.

## 8. One-time Cloudflare setup for game.josefyang.com (Josef)

The hub is served by the same Worker as josefyang.com (`josefyang-site`), selected by hostname.

1. **Custom domain.** In the browser: Cloudflare dashboard → Workers & Pages → `josefyang-site` → Settings → Domains & Routes → Add → Custom domain → type `game.josefyang.com` → Add domain. Cloudflare creates the DNS record and certificate itself, so there is nothing to add under DNS (the zone josefyang.com must be on this Cloudflare account).
2. **Confirm the variable.** `wrangler.jsonc` already sets `"GAME_HOST": "game.josefyang.com"`. Deploy from the VS Code terminal at the repo: `npm run build` then `npx wrangler deploy`. (CI does this if it deploys on push.)
3. **Access must not cover the hub.** Zero Trust → Access → Applications → the admin application → check its destinations are only `josefyang.com/admin*`, `josefyang.com/api/admin*` and `josefyang.com/preview*`. `game.josefyang.com` must not appear.
4. **Each game.** Repeat step 1 for each game's own Worker with `<slug>.josefyang.com`.
5. **Check.** Open `https://game.josefyang.com` (hub), `https://josefyang.com/games` (should redirect there), and `https://game.josefyang.com/<slug>`.
