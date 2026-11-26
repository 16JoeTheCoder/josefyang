import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameHostPath, gameHostRewrite, mainHostRedirect } from "../src/lib/game-host";

describe("game host rewrite", () => {
  it("maps / and /<slug> onto the hub pages", () => {
    expect(gameHostRewrite("/")).toBe("/games");
    expect(gameHostRewrite("/modulus")).toBe("/games/modulus");
    expect(gameHostRewrite("/modulus/")).toBe("/games/modulus");
    expect(gameHostRewrite("/my-game-2")).toBe("/games/my-game-2");
  });
  it("leaves assets, media, api, admin and root files alone", () => {
    for (const p of ["/_astro/x.css", "/fonts/archivo.woff2", "/media/m/ab/480.webp", "/api/public/v1/posts", "/api/admin/games", "/admin", "/preview/games/x", "/favicon.svg", "/favicon.ico", "/robots.txt", "/granite.webp"]) {
      expect(gameHostRewrite(p), p).toBeNull();
    }
  });
  it("does not double-prefix or map nested paths", () => {
    expect(gameHostRewrite("/games")).toBeNull();
    expect(gameHostRewrite("/games/modulus")).toBeNull();
    expect(gameHostRewrite("/a/b")).toBeNull();
    expect(gameHostRewrite("/Not_A_Slug")).toBeNull();
  });
});

describe("main host redirect", () => {
  it("moves /games* to the game host", () => {
    expect(mainHostRedirect("/games", "", "game.josefyang.com")).toBe("https://game.josefyang.com/");
    expect(mainHostRedirect("/games/", "", "game.josefyang.com")).toBe("https://game.josefyang.com/");
    expect(mainHostRedirect("/games/modulus", "?a=1", "game.josefyang.com")).toBe("https://game.josefyang.com/modulus?a=1");
  });
  it("does nothing without GAME_HOST or for other paths", () => {
    expect(mainHostRedirect("/games", "", undefined)).toBeNull();
    expect(mainHostRedirect("/games", "", "")).toBeNull();
    expect(mainHostRedirect("/gamesx", "", "game.josefyang.com")).toBeNull();
    expect(mainHostRedirect("/devlog", "", "game.josefyang.com")).toBeNull();
  });
  it("builds the public path on the game host", () => {
    expect(gameHostPath("/games")).toBe("/");
    expect(gameHostPath("/games/modulus")).toBe("/modulus");
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

import { gameHostServes } from "../src/lib/game-host";
describe("gameHostServes", () => {
  it("serves hub pages and shared assets only", () => {
    for (const p of ["/", "/modulus", "/games", "/games/modulus", "/_astro/a.js", "/media/m/ab/orig.png", "/api/public/v1/posts", "/admin", "/granite.webp"]) expect(gameHostServes(p)).toBe(true);
    for (const p of ["/builds/chronos", "/devlog/foo", "/about/me"]) expect(gameHostServes(p)).toBe(false);
  });
});
