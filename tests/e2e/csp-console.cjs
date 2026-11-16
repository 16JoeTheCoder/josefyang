const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const msgs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) msgs.push(m.type() + ": " + m.text().slice(0, 250)); });
  p.on("pageerror", (e) => msgs.push("pageerror: " + e.message.slice(0, 200)));
  for (const u of ["/", "/about", "/projects", "/failures", "/devlog"]) {
    await p.goto("http://localhost:4321" + u, { waitUntil: "networkidle" });
  }
  // client-side nav
  await p.goto("http://localhost:4321/", { waitUntil: "networkidle" });
  const links = await p.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")).slice(0, 6));
  console.log("links", links);
  try { await p.click("a[href='/about']", { timeout: 3000 }); await p.waitForTimeout(1000); console.log("after nav", p.url()); } catch (e) { console.log("nav fail", e.message.slice(0, 80)); }
  await p.goto("http://localhost:4321/admin", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  console.log(msgs.filter((m) => /Content Security|CSP|Refused/i.test(m)).join("\n") || "no CSP violations");
  console.log("other:", msgs.filter((m) => !/Content Security|CSP|Refused/i.test(m)).slice(0, 8));
  await b.close();
})();
