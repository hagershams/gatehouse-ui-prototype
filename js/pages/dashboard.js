/* Operations overview. Computed client-side from contract endpoints
   (no dashboard summary endpoint exists — backend gap, see contract §5). */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead, refs } = window.GH.common;

  const OUTCOME = {
    LOOP_TRIGGERED: ["Vehicle at gate", "info", "car"],
    LPR_PROCESSING: ["Reading plate…", "info", "camera"],
    PLATE_DETECTED: ["Plate read", "info", "camera"],
    QR_REQUIRED: ["Waiting for QR", "warn", "qr"],
    QR_PROCESSING: ["Reading QR…", "warn", "qr"],
    QR_DETECTED: ["QR scanned", "info", "qr"],
    QR_INVALID: ["Invalid QR", "bad", "alert"],
    QR_TIMEOUT: ["No QR shown", "bad", "clock"],
    ACCESS_GRANTED: ["Access granted", "ok", "check"],
    ACCESS_DENIED: ["Access denied", "bad", "x"],
    GATE_OPENING: ["Gate opening", "ok", "arrowUp"],
    GATE_OPENED: ["Passed", "ok", "check"],
    ERROR: ["Error", "bad", "alert"],
  };
  const REASON = { NO_PLATE_DETECTED: "no plate detected", USER_NOT_ALLOWED: "vehicle owner not allowed", NO_QR_CAMERA: "no QR camera", NO_QR_DETECTED: "no QR shown", INVALID_QR: "invalid QR", QR_TIMEOUT: "no QR shown in time" };

  window.GH.pages.dashboard = async function (page) {
    const s = auth.session();
    const today = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    page.innerHTML = String(html`
      ${pageHead({
        title: "Operations overview",
        sub: `${today} · updates live`,
        actions: auth.can("qr.issue") ? html`<a class="btn primary" href="#/visitors?issue=1">${icon("ticket")}Issue visitor pass</a>` : "",
      })}
      <div data-kpis>${kpiSkeleton()}</div>
      <div class="grid dash">
        <div class="stack" style="gap:var(--s-5)">
          <section class="panel" aria-labelledby="gates-h">
            <div class="panel-head"><h2 class="panel-title" id="gates-h">Gates</h2><span class="spacer"></span><a class="btn sm ghost" href="#/gates">All gates ${icon("chevronRight")}</a></div>
            <div data-gates>${ui.loading(4)}</div>
          </section>
          <section class="panel" aria-labelledby="traffic-h">
            <div class="panel-head"><h2 class="panel-title" id="traffic-h">Movements today, by hour</h2><span class="spacer"></span>
              <div class="legend"><span><i style="background:var(--series-1)"></i>Entries</span><span><i style="background:var(--series-2)"></i>Exits</span></div></div>
            <div class="panel-body" data-hourly>${ui.loading(3)}</div>
          </section>
        </div>
        <section class="panel" aria-labelledby="feed-h" style="align-self:start">
          <div class="panel-head"><h2 class="panel-title" id="feed-h">Live access</h2><span class="badge ok"><span class="dot"></span>Live</span><span class="spacer"></span><a class="btn sm ghost" href="#/activity">History ${icon("chevronRight")}</a></div>
          <ul class="feed" data-feed aria-live="polite" aria-label="Live access events"></ul>
        </section>
      </div>
      <section class="panel" style="margin-top:var(--s-5)" aria-labelledby="g30-h">
        <div class="panel-head"><h2 class="panel-title" id="g30-h">Traffic by gate</h2><span class="muted small">Last 30 days · entries + exits</span></div>
        <div class="panel-body" data-gatebars>${ui.loading(4)}</div>
      </section>`);

    let R, entries, gates, qrs;
    async function load() {
      [R, entries, qrs] = await Promise.all([
        refs(["gates", "cars", "residents"]),
        api.listGateEntries({ start_date: ui.startOfToday() }),
        auth.can("visitors.view") ? api.listQRCodes() : Promise.resolve([]),
      ]);
      gates = R.gates;
    }
    try { await load(); } catch (err) { page.innerHTML = String(ui.errorState(err)); page.querySelector("[data-retry]").onclick = () => window.GH.pages.dashboard(page); return; }

    // ---------- KPIs ----------
    function renderKpis() {
      const online = gates.filter((g) => g.active === true);
      const offline = gates.filter((g) => g.active === false);
      const open = online.filter((g) => g.is_open);
      const ins = entries.filter((e) => e.entry_type === "ENTRY").length;
      const outs = entries.length - ins;
      const nowIso = ui.toNaiveUtc(new Date());
      const activePasses = qrs.filter((q) => q.is_active && q.start_at <= nowIso && q.expiry_date >= nowIso).length;
      const onSite = R.cars.filter((c) => c.is_inside).length;
      page.querySelector("[data-kpis]").innerHTML = String(html`<div class="kpis" role="group" aria-label="Key figures">
        <div class="kpi"><div class="kpi-label">${icon("gate")}Gates online</div><div class="kpi-value">${online.length}<small> / ${gates.length}</small></div>
          <div class="kpi-note ${offline.length ? "bad" : ""}">${offline.length ? `${offline.map((g) => g.name).join(", ")} offline` : "All controllers responding"}${open.length ? ` · ${open.length} open` : ""}</div></div>
        <div class="kpi"><div class="kpi-label">${icon("activity")}Movements today</div><div class="kpi-value">${fmt.num(entries.length)}</div><div class="kpi-note">${fmt.num(ins)} entries · ${fmt.num(outs)} exits</div></div>
        <div class="kpi"><div class="kpi-label">${icon("car")}Vehicles on site</div><div class="kpi-value">${fmt.num(onSite)}</div><div class="kpi-note">of ${fmt.num(R.cars.length)} registered vehicles</div></div>
        <div class="kpi"><div class="kpi-label">${icon("ticket")}Visitor passes valid now</div><div class="kpi-value">${fmt.num(activePasses)}</div><div class="kpi-note">${qrs.filter((q) => q.start_at > nowIso).length} scheduled later</div></div>
      </div>`);
    }

    // ---------- gates ----------
    function renderGates() {
      const canOperate = auth.can("gates.operate");
      const host = page.querySelector("[data-gates]");
      host.innerHTML = String(html`<ul class="gate-list">${gates.map((g) => {
        const pend = window.GH.gatePending(g.id);
        return html`<li>
          <div style="min-width:0">
            <div class="row wrap"><a class="cell-title" href="#/gates/${g.id}">${g.name}</a>${ui.gateState(g, { pending: pend })}</div>
            <div class="cell-sub">${g.type === "ENTRY" ? "Entry lane" : "Exit lane"} · <span class="mono">${g.ip}</span></div>
          </div>
          <div class="row">${canOperate ? (g.active
            ? html`<button class="btn sm" data-cmd="${g.is_open ? "close" : "open"}" data-id="${g.id}" ${pend ? ui.raw("disabled") : ""}>${icon(g.is_open ? "lock" : "unlock")}${g.is_open ? "Close" : "Open"}</button>`
            : html`<button class="btn sm" data-ping="${g.id}">${icon("refresh")}Check status</button>`) : ""}</div>
        </li>`;
      })}</ul>`);
      host.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => window.GH.gateCommand(gates.find((g) => g.id === Number(b.dataset.id)), b.dataset.cmd, renderGates)));
      host.querySelectorAll("[data-ping]").forEach((b) => (b.onclick = async () => {
        const r = await window.GH.gatePing(gates.find((g) => g.id === Number(b.dataset.ping)), b);
        if (r) { gates = await api.listGates(); renderGates(); renderKpis(); }
      }));
    }

    // ---------- hourly chart ----------
    function renderHourly() {
      const buckets = Array.from({ length: 24 }, (_, h) => ({ h, in: 0, out: 0 }));
      entries.forEach((e) => { const h = ui.toDate(e.created_at).getHours(); e.entry_type === "ENTRY" ? buckets[h].in++ : buckets[h].out++; });
      const host = page.querySelector("[data-hourly]");
      if (!entries.length) { host.innerHTML = String(ui.empty("No movements yet today", "Entries and exits will appear here as vehicles pass the gates.")); return; }
      ui.hourlyChart(host, buckets);
      const peak = buckets.reduce((m, b) => (b.in + b.out > m.in + m.out ? b : m), buckets[0]);
      host.insertAdjacentHTML("beforeend", String(html`<p class="small muted" style="margin-top:8px">Busiest hour so far: <b class="ink-2">${String(peak.h).padStart(2, "0")}:00</b> with ${peak.in + peak.out} movements. Dashed line marks the current hour.</p>`));
    }

    // ---------- live feed ----------
    const feed = page.querySelector("[data-feed]");
    const cycles = new Map(); // request_id → row data
    function feedRow(c) {
      const [label, tone, ic] = OUTCOME[c.state] || [c.state, "", "info"];
      const person = c.plate ? R.person({ plate_number: c.plate, entry_by: c.method }) : null;
      return html`<li data-rid="${c.id}" class="${c.fresh ? "fresh" : ""}">
        <span class="feed-time">${fmt.time(c.at)}</span>
        <div class="feed-what">
          <div class="cell-title">${ui.plate(c.plate, "sm")}<span style="font-weight:500">${person ? person.name : "Reading…"}</span></div>
          <div class="cell-sub">${R.gateName(c.gate)}${c.method ? ` · ${c.method === "QR" ? "QR pass" : c.method === "LPR" || c.method === "NORMAL" ? "plate recognised" : "manual"}` : ""}${c.reason ? ` · ${REASON[c.reason] || c.reason}` : ""}</div>
        </div>
        ${ui.badge(label, tone, ic)}
      </li>`;
    }
    function renderFeed() { feed.innerHTML = String(html`${[...cycles.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 14).map(feedRow)}`); }
    entries.slice(0, 8).forEach((e) => cycles.set(`e${e.id}`, { id: `e${e.id}`, at: e.created_at, plate: e.plate_number, gate: e.gate_id, state: "GATE_OPENED", method: e.entry_by }));
    if (!cycles.size) feed.innerHTML = String(html`<li style="display:block" class="empty-inline">Waiting for the next vehicle…</li>`);
    else renderFeed();

    // ---------- traffic by gate ----------
    async function renderGateBars() {
      const host = page.querySelector("[data-gatebars]");
      try {
        const t = await api.gatesTraffic();
        const label = { NORMAL: "plate", QR: "QR", MANUAL: "manual", CARD: "card" };
        const rows = t.map((x) => {
          const by = {};
          [x.entries, x.exits].forEach((o) => Object.entries(o).forEach(([k, v]) => (by[k] = (by[k] || 0) + v)));
          return { label: R.gateName(x.gate_id), total: x.total_entries + x.total_exits,
            tip: `${x.total_entries} entries · ${x.total_exits} exits — ${Object.entries(by).map(([k, v]) => `${label[k] || k} ${v}`).join(", ") || "no movements"}` };
        }).sort((a, b) => b.total - a.total);
        ui.gateBars(host, rows);
      } catch (err) { host.innerHTML = String(ui.errorState(err)); }
    }

    renderKpis(); renderGates(); renderHourly(); renderFeed && renderGateBars();

    // ---------- realtime ----------
    const off = window.GH.onEvent(async (ev) => {
      if (ev.event === "GATE_STATUS_CHANGED") {
        const g = gates.find((x) => x.id === ev.gate_id);
        if (g) { g.active = ev.data.active; g.is_open = ev.data.is_open; renderGates(); renderKpis(); }
        return;
      }
      if (!ev.request_id || !OUTCOME[ev.event]) return;
      const c = cycles.get(ev.request_id) || { id: ev.request_id, at: ui.toNaiveUtc(new Date()), gate: ev.gate_id, plate: null };
      if (ev.data && ev.data.plate_number) c.plate = ev.data.plate_number;
      if (ev.data && ev.data.method) c.method = ev.data.method;
      if (ev.data && ev.data.reason) c.reason = ev.data.reason;
      c.state = ev.event;
      c.fresh = !cycles.has(ev.request_id);
      cycles.set(ev.request_id, c);
      renderFeed();
      c.fresh = false;
      if (ev.event === "GATE_OPENED") {
        entries = await api.listGateEntries({ start_date: ui.startOfToday() });
        renderKpis(); renderHourly();
      }
    });
    return off;
  };

  function kpiSkeleton() {
    return html`<div class="kpis">${[0, 1, 2, 3].map(() => html`<div class="kpi"><div class="skeleton" style="width:50%"></div><div class="skeleton" style="width:35%;height:28px;margin-top:10px"></div></div>`)}</div>`;
  }
})();
