const B = "http://localhost:4321";
const call = async (m, p, body) => {
  const r = await fetch(B + p, { method: m, headers: { Origin: B, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 200) } return [r.status, j];
};
const show = (n, r) => console.log(n, r[0], JSON.stringify(r[1]).slice(0, 220));
const home = (await call("GET", "/api/admin/pages/home"))[1];
const secs = () => JSON.parse(JSON.stringify(home.sections));
let u = home.updatedAt;
show("junk sections string", await call("PATCH", "/api/admin/pages/home", { sections: "x", updatedAt: u }));
show("junk sections [1]", await call("PATCH", "/api/admin/pages/home", { sections: [1], updatedAt: u }));
show("no updatedAt", await call("PATCH", "/api/admin/pages/home", { sections: secs() }));
show("unknown module", await call("PATCH", "/api/admin/pages/home", { sections: [{ sectionId: "a", moduleId: "evil", moduleVersion: 1, content: {} }], updatedAt: u }));
show("unknown page", await call("PATCH", "/api/admin/pages/nope", { sections: [], updatedAt: u }));
show("41 sections", await call("PATCH", "/api/admin/pages/home", { sections: Array(41).fill(secs()[0]), updatedAt: u }));
let s = secs(); s[0].content.headline.value = "x".repeat(100000);
show("long string", await call("PATCH", "/api/admin/pages/home", { sections: s, updatedAt: u }));
s = secs(); s[0].content.headline.value = "<script>alert(1)</script><img src=x onerror=alert(2)>";
const xr = await call("PATCH", "/api/admin/pages/home", { sections: s, updatedAt: u }); show("xss save", xr);
if (xr[0] === 200) {
  u = xr[1].updatedAt;
  const html = await (await fetch(B + "/preview/")).text();
  console.log("preview raw <script>alert(1) present:", html.includes("<script>alert(1)</script>"), "escaped present:", html.includes("&lt;script&gt;alert(1)"), "onerror raw:", /<img src=x onerror/.test(html));
  // stale
  show("stale updatedAt", await call("PATCH", "/api/admin/pages/home", { sections: s, updatedAt: u - 5 }));
  show("prototype pollution", await call("PATCH", "/api/admin/pages/home", { sections: s.map(x=>({...x, __proto__: {a:1}})), updatedAt: u }));
  // restore
  const r2 = await call("PATCH", "/api/admin/pages/home", { sections: secs(), updatedAt: u }); show("restore", r2);
}
// settings
const st = (await call("GET", "/api/admin/settings"))[1];
console.log("settings keys", Object.keys(st));
const c = st.contacts; console.log("contacts", JSON.stringify(c).slice(0,300));
for (const bad of ["javascript:alert(1)", "data:text/html,<script>1</script>", "//evil.com", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "vbscript:x"]) {
  const v = JSON.parse(JSON.stringify(c)); if (v.github && typeof v.github === "object") v.github.value = bad; else v.github = bad;
  show("contacts github=" + bad, await call("PATCH", "/api/admin/settings/contacts", v));
}
show("settings unknown key", await call("PATCH", "/api/admin/settings/zzz", {}));
show("settings __proto__", await call("PATCH", "/api/admin/settings/__proto__", {}));
// builds slug
for (const slug of ["../x", "a/b", "A B", "x'; DROP TABLE builds;--", "a".repeat(80), "", "-a"]) show("build create title=" + slug.slice(0,20), await call("POST", "/api/admin/builds", { title: slug, templateId: "build-default" }));
show("build bad template", await call("POST", "/api/admin/builds", { title: "t", templateId: "x' OR 1=1--" }));
const bl = (await call("GET", "/api/admin/builds"))[1]; console.log("builds", bl.map(b => b.id + ":" + b.slug));
