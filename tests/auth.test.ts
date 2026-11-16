import { describe, expect, it } from "vitest";
import { verifyAdmin } from "../src/core/auth";

const env = { ADMIN_EMAIL: "josef@josefyang.com", CF_ACCESS_AUD: "aud", CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" };

describe("Access JWT check (architecture §14)", () => {
  it("rejects requests without a token", async () => {
    expect(await verifyAdmin(new Request("https://josefyang.com/api/admin/bootstrap"), env)).toBeNull();
  });
  it("rejects malformed tokens", async () => {
    const r = new Request("https://josefyang.com/admin", { headers: { "Cf-Access-Jwt-Assertion": "a.b" } });
    expect(await verifyAdmin(r, env)).toBeNull();
  });
  it("dev bypass never works off localhost or when Access is configured", async () => {
    expect(await verifyAdmin(new Request("https://josefyang.com/admin"), { ...env, CF_ACCESS_AUD: undefined, DEV_ADMIN_BYPASS: "1" })).toBeNull();
    expect(await verifyAdmin(new Request("http://localhost:4321/admin"), { ...env, DEV_ADMIN_BYPASS: "1" })).toBeNull();
    expect(await verifyAdmin(new Request("http://localhost:4321/admin"), { ADMIN_EMAIL: env.ADMIN_EMAIL, DEV_ADMIN_BYPASS: "1" })).toBe(env.ADMIN_EMAIL);
  });
});
