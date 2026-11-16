const B = "http://localhost:4321";
const call = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: { Origin: B, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 200) } return [r.status, j]; };
const show = (n, r) => console.log(n, r[0], JSON.stringify(r[1]).slice(0, 200));
// restore home page
const hp = (await call("GET", "/api/admin/pages/home"))[1];
const orig = JSON.parse(JSON.stringify(hp.sections)); orig[0].content.headline.value = "Josef Yang builds hardware and software";
show("restore home", await call("PATCH", "/api/admin/pages/home", { sections: orig, updatedAt: hp.updatedAt }));
const orig_gh = (await call("GET", "/api/admin/settings"))[1].contacts.value.github;
for (const bad of ["javascript:alert(1)", "data:text/html,<script>1</script>", "//evil.com", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "vbscript:x", "http://ok.example/x", "https://github.com/x\"onmouseover=\"alert(1)"]) {
  const st = (await call("GET", "/api/admin/settings"))[1].contacts;
  st.value.github = bad;
  show("github=" + bad, await call("PATCH", "/api/admin/settings/contacts", { value: st.value, updatedAt: st.updatedAt }));
}
const st = (await call("GET", "/api/admin/settings"))[1].contacts; st.value.github = orig_gh;
show("restore", await call("PATCH", "/api/admin/settings/contacts", { value: st.value, updatedAt: st.updatedAt }));
