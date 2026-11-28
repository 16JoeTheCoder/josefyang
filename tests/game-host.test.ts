import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogUrl, mainHostOf, privateHostAllowed, routeRequest } from "../src/lib/game-host";
import { affectedCatalogPaths, affectedMainPaths } from "../src/core/purge";
import { boundedPaths, cacheKeyUrl, PURGE_LIMIT, QUERY_KEYS, ttlFor } from "../src/core/cache";

const G = "game.example.test";
const main = (pathname: string, search = "", method = "GET", gameHost: string | null = G) => routeRequest({ pathname, search, method, gameHost: gameHost ?? undefined, host: "main.example.test" });
const cat = (pathname: string, search = "", method = "GET") => routeRequest({ pathname, search, method, gameHost: G, host: G });

describe("main host: journey and legacy paths", () => {
  it("serves the journey at /games and normalises the slash", () => {
    expect(main("/games")).toEqual({ kind: "pass" });
    expect(main("/games/", "?a=1")).toEqual({ kind: "redirect", location: "/games?a=1" });
  });
  it("redirects /game and /game/ to /games for GET and HEAD, keeping the query exactly", () => {
    for (const m of ["GET", "HEAD"]) {
      expect(main("/game", "", m)).toEqual({ kind: "redirect", location: "/games" });
      expect(main("/game/", "?a=1&b=%20x", m)).toEqual({ kind: "redirect", location: "/games?a=1&b=%20x" });
    }
    expect(main("/game", "", "POST")).toEqual({ kind: "pass" });
  });
  it("sends /games/<slug> to the catalog detail with the query", () => {
    expect(main("/games/modulus", "?ref=x")).toEqual({ kind: "redirect", location: `https://${G}/modulus?ref=x` });
    expect(main("/games/modulus/")).toEqual({ kind: "redirect", location: `https://${G}/modulus` });
    expect(main("/games/a/b")).toEqual({ kind: "pass" });
    expect(main("/games/Not_A_Slug")).toEqual({ kind: "pass" });
  });
  it("keeps internal /hub routes off the main host when a game host exists", () => {
    expect(main("/hub")).toEqual({ kind: "redirect", location: `https://${G}/` });
    expect(main("/hub/modulus", "?q=1")).toEqual({ kind: "redirect", location: `https://${G}/modulus?q=1` });
  });
  it("local contract without GAME_HOST: journey at /games, catalog at /hub", () => {
    expect(main("/games", "", "GET", null)).toEqual({ kind: "pass" });
    expect(main("/games/modulus", "?a=1", "GET", null)).toEqual({ kind: "redirect", location: "/hub/modulus?a=1" });
    expect(main("/hub", "", "GET", null)).toEqual({ kind: "pass" });
    expect(main("/hub/modulus", "", "GET", null)).toEqual({ kind: "pass" });
    expect(main("/game", "", "HEAD", null)).toEqual({ kind: "redirect", location: "/games" });
    expect(catalogUrl(undefined)).toBe("/hub");
    expect(catalogUrl(G, "x")).toBe(`https://${G}/x`);
  });
  it("leaves the portfolio alone", () => {
    for (const p of ["/", "/projects", "/builds/chronos", "/devlog", "/gamesx", "/about"]) expect(main(p)).toEqual({ kind: "pass" });
  });
});

describe("singular catalog host", () => {
  it("maps / and /<slug> onto the catalog and never into the journey", () => {
    expect(cat("/")).toEqual({ kind: "rewrite", to: "/hub" });
    expect(cat("/modulus")).toEqual({ kind: "rewrite", to: "/hub/modulus" });
    expect(cat("/modulus/")).toEqual({ kind: "rewrite", to: "/hub/modulus" });
  });
  it("redirects legacy /games* and internal /hub* spellings to the root form", () => {
    expect(cat("/games")).toEqual({ kind: "redirect", location: "/" });
    expect(cat("/games/modulus", "?a=1")).toEqual({ kind: "redirect", location: "/modulus?a=1" });
    expect(cat("/hub/modulus")).toEqual({ kind: "redirect", location: "/modulus" });
  });
  it("shares assets and public APIs, hides admin and preview, 404s the portfolio", () => {
    for (const p of ["/_astro/x.css", "/fonts/a.woff2", "/media/m/ab/480.webp", "/api/public/v1/posts", "/favicon.svg", "/robots.txt", "/granite.webp"]) expect(cat(p), p).toEqual({ kind: "pass" });
    for (const p of ["/admin", "/admin/x", "/preview/games", "/api/admin/games"]) expect(cat(p), p).toEqual({ kind: "notfound" });
    for (const p of ["/builds/chronos", "/devlog/foo", "/a/b", "/devlog/rss.xml", "/builds/x/a.png"]) expect(cat(p), p).toEqual({ kind: "notfound" });
    // Astro.rewrite("/404") for an unknown game must not loop back into the catalog.
    expect(cat("/404")).toEqual({ kind: "pass" });
  });
});

describe("private host boundary", () => {
  it("allows only the main host and localhost", () => {
    const m = mainHostOf("https://main.example.test");
    expect(privateHostAllowed("main.example.test", m)).toBe(true);
    for (const h of ["localhost", "127.0.0.1", "[::1]"]) expect(privateHostAllowed(h, m)).toBe(true);
    for (const h of [G, "www.main.example.test", "josefyang-site.example.workers.dev"]) expect(privateHostAllowed(h, m)).toBe(false);
    expect(mainHostOf(undefined)).toBe("josefyang.com");
  });
});

describe("freshness policy", () => {
  it("editorial HTML has a finite 60 s TTL", () => { expect(ttlFor("/")).toBe(60); expect(ttlFor("/games")).toBe(60); });
  it("cache keys keep only parameters that change the HTML (none today) and carry the build id", () => {
    QUERY_KEYS["/test-q"] = ["cat", "tag"];
    const a = cacheKeyUrl("https://x.test/test-q?tag=b&cat=a");
    expect(a).toBe(cacheKeyUrl("https://x.test/test-q?cat=a&tag=b&utm_source=z"));
    expect(a).not.toBe(cacheKeyUrl("https://x.test/test-q"));
    delete QUERY_KEYS["/test-q"];
    expect(cacheKeyUrl("https://x.test/devlog?a=1&a=2")).toBe(cacheKeyUrl("https://x.test/devlog"));
    expect(a).toContain("__build=");
  });
  it("purges are bounded and always include the main journey", () => {
    expect(affectedMainPaths()).toContain("/games");
    expect(boundedPaths(Array.from({ length: 500 }, (_, i) => `/p${i}`))).toHaveLength(PURGE_LIMIT);
    expect(affectedCatalogPaths(G, ["m"])).toEqual({ origin: `https://${G}`, paths: ["/", "/m"] });
    expect(affectedCatalogPaths(undefined, ["m"])).toEqual({ paths: ["/hub", "/hub/m"] });
  });
});

describe("cookies", () => {
  it("nothing in src sets a cookie scoped to a parent domain", () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|astro)$/.test(n) && /[;\s]Domain\s*=/i.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(__dirname, "../src"));
    expect(hits).toEqual([]);
  });
});

