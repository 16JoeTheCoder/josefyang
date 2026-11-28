// Mobile lab check (not field data). Usage, repo root:
//   node tests/perf/mobile.mjs http://localhost:8788 out.json [routes...]
// 390x844, DPR 3, 4x CPU slowdown, ~1.6 Mbps / 150 ms RTT. Cold = fresh context; warm = reload in the same context.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { writeFileSync } from "node:fs";
const [base = "http://localhost:8788", out = "perf.json", ...rest] = process.argv.slice(2);
const routes = rest.length ? rest : ["/", "/projects", "/builds/chronos", "/games"];
const RUNS = Number(process.env.RUNS ?? 3);
const browser = await chromium.launch();
const results = [];
async function sample(page, client, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const res = performance.getEntriesByType("resource");
    const nav = performance.getEntriesByType("navigation")[0];
    const by = (t) => res.filter((r) => r.initiatorType === t || (t === "script" && r.name.endsWith(".js")));
    const sum = (a) => a.reduce((s, r) => s + (r.transferSize || 0), 0);
    const lcpE = window.__lcp;
    return {
      lcp: lcpE ? Math.round(lcpE.startTime) : null,
      lcpEl: lcpE?.element ? lcpE.element.tagName + (lcpE.element.className ? "." + String(lcpE.element.className).split(" ")[0] : "") : null,
      cls: Number((window.__cls || 0).toFixed(4)),
      ttfb: Math.round(nav.responseStart),
      htmlTransfer: nav.transferSize, htmlBytes: nav.decodedBodySize,
      transfer: nav.transferSize + sum(res),
      js: sum(by("script")), css: sum(res.filter((r) => r.name.endsWith(".css"))),
      img: sum(res.filter((r) => r.initiatorType === "img" || /\.(webp|png|jpe?g|avif)/.test(r.name))),
      media: res.filter((r) => /\.(mp4|webm)/.test(r.name)).length,
      requests: res.length + 1,
      docHeightVh: Number((document.documentElement.scrollHeight / innerHeight).toFixed(2)),
    };
  });
}
for (const route of routes) {
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls = (window.__cls || 0) + e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await ctx.newPage();
    const client = await ctx.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const cold = await sample(page, client, base + route);
    const warm = await sample(page, client, base + route);
    results.push({ route, run: i, cold, warm });
    console.log(route, i, "cold", JSON.stringify(cold));
    await ctx.close();
  }
}
await browser.close();
writeFileSync(out, JSON.stringify(results, null, 2));
