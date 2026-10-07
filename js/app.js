/* App shell: hash router, sidebar + top bar, role-aware navigation,
   realtime bus and the shared gate-command workflow. */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon } = ui;
  const pages = (window.GH.pages = window.GH.pages || {});

  // ---------- realtime bus ----------
  const bus = new Set();
  const live = { connected: false, unsub: null };
  function startRealtime() {
    if (live.unsub) return;
    live.unsub = api.subscribe((ev) => {
      if (ev.event === "GATE_STATUS_CHANGED") resolvePending(ev);
      bus.forEach((fn) => fn(ev));
    });
    live.connected = true;
  }
  function stopRealtime() { live.unsub && live.unsub(); live.unsub = null; live.connected = false; }
  window.GH.onEvent = (fn) => { bus.add(fn); return () => bus.delete(fn); };

  // ---------- gate commands (shared by dashboard, gates, gate detail) ----------
  // Open/close is an action: the response does not confirm movement, so the UI
  // shows "Command sent" until GATE_STATUS_CHANGED reports the new physical state.
  const pending = new Map(); // gateId → { want: boolean, timer }
  window.GH.gatePending = (id) => pending.has(id);
  function resolvePending(ev) {
    const p = pending.get(ev.gate_id);
    if (!p || ev.data.is_open !== p.want) return;
    clearTimeout(p.timer);
    pending.delete(ev.gate_id);
    ui.toast(`${p.name} reported ${p.want ? "open" : "closed"}.`);
  }
  window.GH.gateCommand = async function (gate, action, onChange) {
    const open = action === "open";
    const ok = await ui.confirm({
      title: `${open ? "Open" : "Close"} ${gate.name}?`,
      message: open
        ? "The barrier will lift for the next vehicle. The command is logged under your name."
        : "The barrier will lower. Make sure the lane is clear before closing.",
      confirmLabel: open ? "Open gate" : "Close gate",
      icon: open ? "unlock" : "lock",
    });
    if (!ok) return;
    try {
      await (open ? api.openGate(gate.id) : api.closeGate(gate.id));
      const timer = setTimeout(() => {
        pending.delete(gate.id);
        ui.toast(`${gate.name} hasn't reported a new state yet. Check status or the lane camera.`, "warn");
        onChange && onChange();
      }, 15000);
      pending.set(gate.id, { want: open, timer, name: gate.name });
      ui.toast(`Command sent to ${gate.name}. Waiting for the gate to report…`, "warn");
    } catch (err) {
      ui.toast(err.status === 500 ? `${gate.name} didn't accept the command — the controller may be offline.` : ui.errorMessage(err), "bad");
    }
    onChange && onChange();
  };
  window.GH.gatePing = async function (gate, button) {
    try {
      const r = await ui.busy(button, () => api.pingGate(gate.id));
      ui.toast(r.reachable ? `${gate.name} is online · ${r.latency_ms} ms · ${r.is_open ? "open" : "closed"}` : `${gate.name} did not respond.`, r.reachable ? "ok" : "bad");
      return r;
    } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
  };

  // ---------- routes ----------
  const ROUTES = [
    { path: "dashboard", page: "dashboard", perm: "dashboard.view" },
    { path: "gates", page: "gates", perm: "gates.view" },
    { path: "gates/:id", page: "gateDetail", perm: "gates.view" },
    { path: "activity", page: "activity", perm: "logs.view" },
    { path: "residents", page: "residents", perm: "residents.view" },
    { path: "visitors", page: "visitors", perm: "visitors.view" },
    { path: "vehicles", page: "vehicles", perm: "vehicles.view" },
    { path: "cameras", page: "cameras", perm: "cameras.view" },
    { path: "users", page: "users", perm: "users.view" },
    { path: "organization", page: "organization", perm: "users.view" },
    { path: "portal", page: "portal", resident: true },
  ];
  const NAV = [
    { label: "Operations", items: [["dashboard", "Dashboard", "dashboard"], ["gates", "Gates", "gate"], ["activity", "Activity", "activity"]] },
    { label: "Community", items: [["residents", "Residents", "home"], ["visitors", "Visitors", "ticket"], ["vehicles", "Vehicles", "car"]] },
    { label: "Administration", items: [["cameras", "Cameras", "camera"], ["users", "Staff users", "users"], ["organization", "Units & departments", "building"]] },
  ];

  function match(hash) {
    const path = hash.replace(/^#\/?/, "").split("?")[0] || "";
    for (const r of ROUTES) {
      const a = r.path.split("/"), b = path.split("/");
      if (a.length !== b.length) continue;
      const params = {};
      if (a.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { route: r, params };
    }
    return null;
  }
  const homeFor = (s) => (s.type === "resident" ? "#/portal" : "#/dashboard");

  // ---------- shell ----------
  const root = document.getElementById("app");
  let cleanup = null;

  function shell(active) {
    const s = auth.session();
    const resident = s.type === "resident";
    const nav = resident
      ? [{ label: "My home", items: [["portal", "Visitor invitations", "ticket"]] }]
      : NAV.map((g) => ({ ...g, items: g.items.filter(([p]) => auth.can(ROUTES.find((r) => r.path === p).perm)) })).filter((g) => g.items.length);
    const role = resident ? "Resident" : auth.ROLE_LABEL[s.role];
    return html`
      <div class="shell">
        <nav class="sidebar" id="sidebar" aria-label="Main">
          <div class="brand">
            <div class="brand-mark">${ui.raw('<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="9" width="4" height="12" rx="1" fill="#fff"/><path d="M7 12h14" stroke="#f2b33d" stroke-width="3" stroke-linecap="round"/><path d="M3 21h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>')}</div>
            <div><div class="brand-name">Gatehouse</div><div class="brand-sub">Access control</div></div>
          </div>
          ${nav.map((g) => html`<div class="nav-group"><div class="nav-label">${g.label}</div>
            ${g.items.map(([p, label, ic]) => html`<a class="nav-link" href="#/${p}" ${active === p ? ui.raw('aria-current="page"') : ""}>${icon(ic)}<span>${label}</span>${p === "gates" ? ui.raw('<span class="count" data-offline-count></span>') : ""}</a>`)}</div>`)}
          <div class="sidebar-foot">${api.mode === "mock" ? "Prototype · demo data" : "Connected to backend"}<br>Contract v0.1</div>
        </nav>
        <div class="main">
          <header class="topbar">
            <button class="btn ghost icon-only menu-btn" data-menu aria-label="Open navigation" aria-controls="sidebar">${icon("menu")}</button>
            <span class="live-pill" title="Realtime gate events"><span class="live-dot" data-live-dot></span><span data-live-label>Live events</span></span>
            <span class="spacer"></span>
            <div class="menu">
              <button class="user-btn" data-user aria-haspopup="menu" aria-expanded="false">
                <span class="avatar">${ui.fmt.initials(s.name)}</span>
                <span class="user-meta"><span class="user-name">${s.name}</span><br><span class="user-role">${role}</span></span>
                ${icon("chevronDown")}
              </button>
              <div class="menu-pop" role="menu" hidden data-user-menu>
                <div class="small muted" style="padding:6px 8px">${s.email}</div>
                ${api.mode === "mock" ? html`<div class="small" style="padding:8px 8px 4px;font-weight:600">Switch demo role</div>
                  ${DEMO.map((d) => html`<button class="menu-item" role="menuitem" data-switch="${d.email}">${icon(d.resident ? "home" : "shield")}${d.label}${d.email === s.email ? html`<span class="spacer"></span>${icon("check")}` : ""}</button>`)}
                  <div style="border-top:1px solid var(--line);margin:6px 0"></div>
                  <a class="menu-item" role="menuitem" href="docs/user-guide.html" target="_blank" rel="noopener" data-guide style="text-decoration:none">${icon("info")}Demo guide</a>` : ""}
                <button class="menu-item" role="menuitem" data-logout>${icon("logout")}Sign out</button>
              </div>
            </div>
          </header>
          <main class="page" id="page" tabindex="-1"></main>
        </div>
      </div>`;
  }

  function bindShell() {
    const menuBtn = root.querySelector("[data-user]"), pop = root.querySelector("[data-user-menu]");
    const closeMenu = () => { pop.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); };
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      pop.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      if (open) setTimeout(() => document.addEventListener("click", closeMenu, { once: true }));
    };
    pop.addEventListener("keydown", (e) => e.key === "Escape" && (closeMenu(), menuBtn.focus()));
    root.querySelector("[data-logout]").onclick = signOut;
    root.querySelectorAll("[data-switch]").forEach((b) => (b.onclick = () => demoLogin(DEMO.find((d) => d.email === b.dataset.switch))));
    const sidebar = root.querySelector("#sidebar");
    root.querySelector("[data-menu]").onclick = () => sidebar.classList.toggle("open");
    sidebar.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => sidebar.classList.remove("open")));
    refreshOfflineCount();
  }
  async function refreshOfflineCount() {
    const el = root.querySelector("[data-offline-count]");
    if (!el) return;
    try {
      const gates = await api.listGates();
      const off = gates.filter((g) => g.active === false).length;
      el.textContent = off ? `${off} offline` : "";
      el.classList.toggle("alert", off > 0);
    } catch { /* non-critical */ }
  }

  // Mock-only deep link for reviews: index.html?as=security#/gates opens signed in as that demo role.
  const AS = { superAdmin: 0, admin: 1, manager: 2, security: 3, resident: 4 };
  let deepLinkDone = false;
  async function deepLink() {
    if (deepLinkDone || api.mode !== "mock") return;
    deepLinkDone = true;
    const as = new URLSearchParams(location.search).get("as");
    const d = as in AS ? DEMO[AS[as]] : null;
    const cur = auth.session();
    if (d && (!cur || cur.email !== d.email)) { auth.clear(); await signIn(d.email, "demo1234"); }
  }

  async function render() {
    await deepLink();
    const s = auth.session();
    if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
    if (!s) {
      stopRealtime();
      if (!location.hash.startsWith("#/login")) { location.replace("#/login"); return; }
      root.innerHTML = "";
      cleanup = pages.login(root);
      return;
    }
    const m = match(location.hash);
    if (!m) { location.replace(homeFor(s)); return; }
    startRealtime();
    const { route, params } = m;
    const allowed = route.resident ? s.type === "resident" : s.type === "admin" && auth.can(route.perm);
    const active = route.path.split("/")[0];
    root.innerHTML = String(shell(active));
    bindShell();
    const page = root.querySelector("#page");
    if (!allowed) { page.innerHTML = String(ui.forbiddenState()); return; }
    try {
      cleanup = await pages[route.page](page, params);
    } catch (err) {
      console.error(err);
      page.innerHTML = String(ui.errorState(err));
    }
    page.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- auth flows ----------
  const DEMO = [
    { label: "Super admin · Omar Hassan", email: "omar.hassan@gate-system.com" },
    { label: "Administrator · Mona Adel", email: "mona.adel@gate-system.com" },
    { label: "Manager · Karim Fathy", email: "karim.fathy@gate-system.com" },
    { label: "Security officer · Youssef Nabil", email: "youssef.nabil@gate-system.com" },
    { label: "Resident · Wael Kamel", email: "resident@gate-system.com", resident: true },
  ];
  window.GH.DEMO = DEMO;

  /** Staff and residents share one sign-in form: try staff login, then resident login. */
  async function signIn(email, password) {
    try {
      const r = await api.staffLogin(email, password);
      const claims = auth.decode(r.access_token);
      auth.save({ token: r.access_token, type: "admin", role: r.role, userId: Number(claims.sub), name: nameFromEmail(email), username: email.split("@")[0], email });
      return;
    } catch (err) {
      if (err.status !== 401) throw err; // disabled staff account etc. — don't fall through
    }
    const r = await api.residentLogin(email, password);
    auth.save({ token: r.access_token, type: "resident", role: null, userId: r.user.id, name: r.user.full_name, username: null, email });
  }
  function nameFromEmail(email) {
    const db = api.lookup && api.lookup.db;
    const u = db && db.users.find((x) => x.email === email);
    if (u) return window.GH.seed.displayName[u.username] || u.username;
    return email.split("@")[0].split(/[._]/).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
  }
  async function demoLogin(d) {
    auth.clear();
    await signIn(d.email, "demo1234");
    location.hash = homeFor(auth.session());
    render();
  }
  function signOut() {
    auth.clear();
    location.hash = "#/login";
  }
  window.GH.signIn = signIn;
  window.GH.homeFor = homeFor;

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);
})();
