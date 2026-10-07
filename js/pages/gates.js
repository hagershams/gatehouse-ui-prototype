/* Gates board + gate detail.
   active  = connectivity (server-controlled, never editable)
   is_open = last reported physical state (Unknown while offline)
   Open/close are commands; the new state arrives via GATE_STATUS_CHANGED. */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead, refs, personCell } = window.GH.common;

  // ---------------------------------------------------------------- board
  window.GH.pages.gates = async function (page) {
    let gates = [], filter = "all", lastMove = new Map();
    page.innerHTML = String(html`
      ${pageHead({
        title: "Gates",
        sub: "Connectivity and barrier state for every lane. States update live.",
        actions: auth.can("gates.manage") ? html`<button class="btn primary" data-add>${icon("plus")}Add gate</button>` : "",
      })}
      <div class="row wrap" style="margin-bottom:var(--s-4)">
        <div class="seg" role="group" aria-label="Filter gates" data-filter>
          ${[["all", "All"], ["online", "Online"], ["offline", "Offline"], ["open", "Open now"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === "all"}">${l}</button>`)}
        </div>
        <span class="spacer"></span>
        <span class="small muted" data-summary></span>
      </div>
      <div data-board>${ui.loading(4)}</div>
      <p class="small muted" style="margin-top:var(--s-5)">${icon("info")} <b>Online/Offline</b> is whether the gate controller answered its last health check (every 30 s). <b>Open/Closed</b> is the barrier position the controller last reported; it shows <b>Unknown</b> while the gate is offline.</p>`);

    const board = page.querySelector("[data-board]");
    async function load() {
      try {
        const [g, e] = await Promise.all([api.listGates(), api.listGateEntries({ start_date: ui.toNaiveUtc(new Date(Date.now() - 86400000 * 2)) })]);
        gates = g;
        lastMove = new Map();
        e.forEach((x) => !lastMove.has(x.gate_id) && lastMove.set(x.gate_id, x.created_at));
        draw();
      } catch (err) {
        board.innerHTML = String(ui.errorState(err));
        board.querySelector("[data-retry]").onclick = load;
      }
    }
    function draw() {
      const shown = gates.filter((g) => filter === "all" || (filter === "online" && g.active) || (filter === "offline" && g.active === false) || (filter === "open" && g.active && g.is_open));
      page.querySelector("[data-summary]").textContent = `${gates.filter((g) => g.active).length} of ${gates.length} online · ${gates.filter((g) => g.active && g.is_open).length} open`;
      if (!shown.length) { board.innerHTML = String(ui.empty("No gates match this filter", "Try another filter.")); return; }
      const canOp = auth.can("gates.operate");
      board.innerHTML = String(html`<div class="gate-board">${shown.map((g) => {
        const pend = window.GH.gatePending(g.id);
        const lpr = g.cameras.find((c) => c.camera_type === "LPR"), drv = g.cameras.find((c) => c.camera_type === "DRIVER");
        const cam = (c, label) => (c ? html`<span class="row" style="gap:4px">${icon(c.is_active ? "check" : "x")}${label}${c.is_active ? "" : " offline"}</span>` : html`<span class="row" style="gap:4px">${icon("x")}No ${label}</span>`);
        return html`<article class="gate-tile ${g.active === false ? "offline" : ""} ${pend ? "pending" : ""}" aria-label="${g.name}">
          <div class="gate-tile-head">
            <div style="flex:1;min-width:0"><div class="gate-name"><a href="#/gates/${g.id}">${g.name}</a></div>
              <div class="gate-meta"><span>${g.type === "ENTRY" ? "Entry lane" : "Exit lane"}</span><span class="mono">${g.ip}</span></div></div>
          </div>
          ${ui.gateState(g, { pending: pend })}
          <div class="gate-meta">${cam(lpr, "plate camera")}${cam(drv, drv && drv.reader_type === "QRREADER" ? "QR reader" : "driver camera")}</div>
          <div class="gate-meta"><span>${icon("clock")} Last movement ${fmt.rel(lastMove.get(g.id))}</span></div>
          ${pend ? html`<div class="cmd-note">${icon("info")}Waiting for the gate to report its new position…</div>` : ""}
          <div class="gate-actions">
            ${canOp ? (g.active
              ? html`<button class="btn ${g.is_open ? "" : "primary"}" data-cmd="${g.is_open ? "close" : "open"}" data-id="${g.id}" ${pend ? ui.raw("disabled") : ""}>${icon(g.is_open ? "lock" : "unlock")}${g.is_open ? "Close gate" : "Open gate"}</button>`
              : html`<button class="btn" disabled title="The controller is not responding">${icon("unlock")}Open gate</button>`) : ""}
            <button class="btn" data-ping="${g.id}">${icon("refresh")}Check status</button>
          </div>
        </article>`;
      })}</div>`);
      board.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => window.GH.gateCommand(gates.find((g) => g.id === Number(b.dataset.id)), b.dataset.cmd, draw)));
      board.querySelectorAll("[data-ping]").forEach((b) => (b.onclick = async () => { if (await window.GH.gatePing(gates.find((g) => g.id === Number(b.dataset.ping)), b)) { gates = await api.listGates(); draw(); } }));
    }
    page.querySelectorAll("[data-filter] button").forEach((b) => (b.onclick = () => {
      filter = b.dataset.v;
      page.querySelectorAll("[data-filter] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }));
    const add = page.querySelector("[data-add]");
    if (add) add.onclick = () => gateForm(null, load);
    await load();
    return window.GH.onEvent((ev) => {
      if (ev.event !== "GATE_STATUS_CHANGED") return;
      const g = gates.find((x) => x.id === ev.gate_id);
      if (g) { g.active = ev.data.active; g.is_open = ev.data.is_open; draw(); }
    });
  };

  // ---------------------------------------------------------------- detail
  window.GH.pages.gateDetail = async function (page, params) {
    const id = Number(params.id);
    page.innerHTML = String(ui.loading(6));
    let gate, R, entries, traffic;
    try {
      [gate, R, entries, traffic] = await Promise.all([
        api.getGate(id), refs(["cars", "residents", "gates"]),
        api.listGateEntries({ start_date: ui.toNaiveUtc(new Date(Date.now() - 7 * 86400000)) }),
        api.gatesTraffic(),
      ]);
    } catch (err) {
      page.innerHTML = String(err.status === 404 ? ui.empty("Gate not found", "It may have been deleted.", html`<a class="btn" href="#/gates">Back to gates</a>`) : ui.errorState(err));
      const r = page.querySelector("[data-retry]"); if (r) r.onclick = () => window.GH.pages.gateDetail(page, params);
      return;
    }
    const mine = entries.filter((e) => e.gate_id === id);
    const t = traffic.find((x) => x.gate_id === id) || { entries: {}, exits: {}, total_entries: 0, total_exits: 0 };
    let lastPing = null;

    function draw() {
      const pend = window.GH.gatePending(id);
      const canOp = auth.can("gates.operate"), canManage = auth.can("gates.manage");
      page.innerHTML = String(html`
        ${pageHead({
          crumbs: [["#/gates", "Gates"]],
          title: gate.name,
          sub: html`${gate.type === "ENTRY" ? "Entry lane" : "Exit lane"}${gate.desc ? ` · ${gate.desc}` : ""}`,
          actions: html`
            <button class="btn" data-ping>${icon("refresh")}Check status</button>
            ${canManage ? html`<button class="btn" data-edit>${icon("edit")}Edit</button>` : ""}
            ${canOp ? (gate.active
              ? html`<button class="btn primary" data-cmd="${gate.is_open ? "close" : "open"}" ${pend ? ui.raw("disabled") : ""}>${icon(gate.is_open ? "lock" : "unlock")}${gate.is_open ? "Close gate" : "Open gate"}</button>`
              : html`<button class="btn primary" disabled title="The controller is not responding">${icon("unlock")}Open gate</button>`) : ""}`,
        })}
        <div class="grid detail">
          <div class="stack" style="gap:var(--s-5)">
            <section class="panel">
              <div class="panel-body">
                <div class="row wrap" style="gap:var(--s-6)">
                  <div><div class="small muted">Connectivity</div><div style="margin-top:6px">${gate.active == null ? ui.badge("Not checked yet", "", "clock") : gate.active ? ui.badge("Online", "ok", "wifi") : ui.badge("Offline", "bad", "wifiOff")}</div></div>
                  <div><div class="small muted">Barrier</div><div style="margin-top:6px">${pend ? ui.badge("Command sent", "warn", "clock") : !gate.active ? html`<span class="badge outline">${ui.barrier("unknown")}Unknown while offline</span>` : gate.is_open ? html`<span class="badge open">${ui.barrier("open")}Open</span>` : html`<span class="badge">${ui.barrier("closed")}Closed</span>`}</div></div>
                  <div><div class="small muted">Last check</div><div style="margin-top:8px" class="small">${lastPing ? html`${fmt.time(lastPing.checked_at)} · ${lastPing.reachable ? `${lastPing.latency_ms} ms` : "no response"}` : html`<span class="muted">Run “Check status”</span>`}</div></div>
                  <div><div class="small muted">Last 30 days</div><div style="margin-top:8px" class="small"><b>${fmt.num(t.total_entries)}</b> entries · <b>${fmt.num(t.total_exits)}</b> exits</div></div>
                </div>
                ${gate.active === false ? html`<div class="notice warn" style="margin-top:var(--s-4)">${icon("alert")}<div><b>The controller isn't responding.</b> Commands can't be sent and the barrier position is unknown. Check power and network at the lane, then use “Check status”.</div></div>` : ""}
                ${pend ? html`<div class="notice warn" style="margin-top:var(--s-4)">${icon("clock")}<div>Command sent. Waiting for the gate to report its new position — this usually takes a few seconds.</div></div>` : ""}
              </div>
            </section>
            <section class="panel">
              <div class="panel-head"><h2 class="panel-title">Movements · last 7 days</h2><span class="spacer"></span><a class="btn sm ghost" href="#/activity">All activity ${icon("chevronRight")}</a></div>
              <div data-moves></div>
            </section>
          </div>
          <div class="stack" style="gap:var(--s-5)">
            <section class="panel">
              <div class="panel-head"><h2 class="panel-title">Gate details</h2></div>
              <div class="panel-body"><dl class="dl">
                <dt>Direction</dt><dd>${gate.type === "ENTRY" ? "Entry" : "Exit"}</dd>
                <dt>Controller</dt><dd class="mono">${gate.ip}</dd>
                <dt>Description</dt><dd>${gate.desc || html`<span class="muted">—</span>`}</dd>
                <dt>Added</dt><dd>${fmt.date(gate.created_at)}</dd>
              </dl></div>
            </section>
            <section class="panel">
              <div class="panel-head"><h2 class="panel-title">Cameras</h2><span class="spacer"></span>${auth.can("cameras.view") ? html`<a class="btn sm ghost" href="#/cameras">Manage</a>` : ""}</div>
              ${gate.cameras.length ? html`<ul class="gate-list">${gate.cameras.map((c) => html`<li><div><div class="cell-title" style="font-weight:500">${c.camera_type === "LPR" ? "Plate camera" : c.reader_type === "QRREADER" ? "QR reader" : "Driver camera"}</div>
                <div class="cell-sub mono">${c.ip_address}:${c.port}${c.serial_number ? ` · ${c.serial_number}` : ""}</div></div>
                ${c.is_active ? ui.badge(c.latency ? `Online · ${c.latency} ms` : "Online", "ok") : ui.badge("Offline", "bad")}</li>`)}</ul>`
                : html`<div class="empty-inline">No cameras assigned. Vehicles at this gate can't be recognised automatically.</div>`}
            </section>
            <section class="panel">
              <div class="panel-head"><h2 class="panel-title">How vehicles got through</h2><span class="muted small">30 days</span></div>
              <div class="panel-body"><dl class="dl">${[["NORMAL", "Plate (LPR)"], ["QR", "QR pass"], ["MANUAL", "Manual"], ["CARD", "Card"]].map(([k, l]) => html`<dt>${l}</dt><dd class="mono">${fmt.num((t.entries[k] || 0) + (t.exits[k] || 0))}</dd>`)}</dl></div>
            </section>
            ${canManage ? html`<button class="btn danger" data-delete style="align-self:flex-start">${icon("trash")}Delete gate</button>` : ""}
          </div>
        </div>`);

      ui.table(page.querySelector("[data-moves]"), {
        rows: mine, pageSize: 10, rowLabel: "movement", emptyTitle: "No movements in the last 7 days", emptyText: "Vehicles passing this gate will appear here.",
        columns: [
          { key: "created_at", label: "Time", render: (e) => html`<div class="nowrap">${fmt.dateTime(e.created_at)}</div>` },
          { key: "plate_number", label: "Plate", render: (e) => ui.plate(e.plate_number, "sm") },
          { key: "person", label: "Belongs to", sortable: false, render: (e) => personCell(R.person(e)) },
          { key: "entry_by", label: "Method", render: (e) => ui.entryMethod(e.entry_by) },
        ],
        initialSort: { key: "created_at", dir: "desc" },
      });
      bind();
    }
    function bind() {
      const q = (s) => page.querySelector(s);
      q("[data-ping]").onclick = async (e) => { const r = await window.GH.gatePing(gate, e.currentTarget); if (r) { lastPing = r; gate = await api.getGate(id); draw(); } };
      const cmd = q("[data-cmd]"); if (cmd) cmd.onclick = () => window.GH.gateCommand(gate, cmd.dataset.cmd, draw);
      const ed = q("[data-edit]"); if (ed) ed.onclick = () => gateForm(gate, async () => { gate = await api.getGate(id); draw(); });
      const del = q("[data-delete]");
      if (del) del.onclick = async () => {
        if (!(await ui.confirm({ title: `Delete ${gate.name}?`, message: "Its cameras will be unassigned. Movement history is kept.", confirmLabel: "Delete gate", tone: "danger", icon: "trash" }))) return;
        try { await api.deleteGate(id); ui.toast(`${gate.name} deleted.`); location.hash = "#/gates"; } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      };
    }
    draw();
    return window.GH.onEvent((ev) => {
      if (ev.event === "GATE_STATUS_CHANGED" && ev.gate_id === id) { gate.active = ev.data.active; gate.is_open = ev.data.is_open; draw(); }
    });
  };

  // ---------------------------------------------------------------- form
  function gateForm(gate, done) {
    const d = ui.drawer({
      title: gate ? `Edit ${gate.name}` : "Add gate",
      subtitle: "Connectivity and barrier state are reported by the controller and can't be edited.",
      body: html`<form class="form" id="gate-form" novalidate>
        ${ui.field("name", "Name", ui.input("name", gate && gate.name, 'required placeholder="e.g. North Gate · Entry"'), { required: true })}
        ${ui.field("type", "Direction", ui.select("type", [["ENTRY", "Entry lane"], ["EXIT", "Exit lane"]], gate ? gate.type : "ENTRY"), { required: true, hint: "Used to record entries and exits for recognised vehicles." })}
        ${ui.field("ip", "Controller address", ui.input("ip", gate && gate.ip, 'required placeholder="10.20.0.11" spellcheck="false"'), { required: true, hint: "IP or host name of the gate controller. Must be unique." })}
        ${ui.field("desc", "Description", html`<textarea class="input" id="f-desc" name="desc" placeholder="Optional">${gate ? gate.desc || "" : ""}</textarea>`)}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" form="gate-form" type="submit">${gate ? "Save changes" : "Add gate"}</button>`,
    });
    const form = d.el.querySelector("form");
    d.el.querySelector("[data-cancel]").onclick = d.close;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (!v.name) errs.name = "Enter a name.";
      if (!v.ip) errs.ip = "Enter the controller address.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      try {
        await ui.busy(d.el.querySelector("button[type=submit]"), () => (gate ? api.updateGate(gate.id, v) : api.createGate(v)));
        ui.toast(gate ? "Gate updated." : `${v.name} added. Its status appears after the first health check.`);
        d.close();
        done && done();
      } catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }
})();
