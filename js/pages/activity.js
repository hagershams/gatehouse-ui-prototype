/* Activity: movement ledger (gate entries) + audit log. Read-only by design
   (editing/deleting ledger rows is excluded pending BD-17). */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead, refs, personCell, downloadCsv } = window.GH.common;

  window.GH.pages.activity = async function (page) {
    let tab = new URLSearchParams(location.hash.split("?")[1]).get("tab") || "moves";
    page.innerHTML = String(html`
      ${pageHead({
        title: "Activity",
        sub: "Every vehicle movement at the gates, and every change made by staff.",
        actions: auth.can("gates.operate") ? html`<button class="btn" data-manual>${icon("edit")}Log manual movement</button>` : "",
      })}
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="moves" aria-selected="${tab === "moves"}">Movements</button>
        <button class="tab" role="tab" data-tab="audit" aria-selected="${tab === "audit"}">Audit log</button>
      </div>
      <div data-body></div>`);
    const body = page.querySelector("[data-body]");
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
      tab = b.dataset.tab;
      page.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      show();
    }));
    const R = await refs(["gates", "cars", "residents"]);
    const manual = page.querySelector("[data-manual]");
    if (manual) manual.onclick = () => manualForm(R, () => tab === "moves" && show());

    async function show() { body.innerHTML = String(ui.loading(8)); tab === "moves" ? moves() : audit(); }

    // ---------------- movements ----------------
    async function moves() {
      const f = { range: "1", type: "", method: "", gate: "", q: "" };
      body.innerHTML = String(html`<section class="panel">
        <div class="toolbar">
          <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search plate or person" aria-label="Search plate or person" data-q></div>
          <div class="seg" role="group" aria-label="Time range" data-range>${[["1", "Today"], ["7", "7 days"], ["14", "14 days"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === "1"}">${l}</button>`)}</div>
          <select class="select" aria-label="Direction" data-type><option value="">Entries and exits</option><option value="ENTRY">Entries</option><option value="EXIT">Exits</option></select>
          <select class="select" aria-label="Method" data-method><option value="">Any method</option><option value="NORMAL">Plate (LPR)</option><option value="QR">QR pass</option><option value="MANUAL">Manual</option><option value="CARD">Card</option></select>
          <select class="select" aria-label="Gate" data-gate><option value="">All gates</option>${R.gates.map((g) => html`<option value="${g.id}">${g.name}</option>`)}</select>
          <span class="spacer"></span>
          <button class="btn sm" data-export>${icon("download")}Export CSV</button>
        </div>
        <div data-table>${ui.loading(8)}</div>
      </section>`);
      let rows = [];
      const t = { inst: null };
      const startFor = (days) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (Number(days) - 1)); return ui.toNaiveUtc(d); };
      async function fetchRows() {
        try {
          rows = await api.listGateEntries({ start_date: startFor(f.range), entry_type: f.type || undefined });
          apply();
        } catch (err) { body.querySelector("[data-table]").innerHTML = String(ui.errorState(err)); body.querySelector("[data-retry]").onclick = fetchRows; }
      }
      const filtered = () => rows.filter((e) => (!f.method || e.entry_by === f.method) && (!f.gate || e.gate_id === Number(f.gate)) &&
        (!f.q || [e.plate_number, R.person(e).name].join(" ").toLowerCase().includes(f.q)));
      function apply() {
        const data = filtered();
        if (t.inst) return t.inst.setRows(data);
        t.inst = ui.table(body.querySelector("[data-table]"), {
          rows: data, pageSize: 15, rowLabel: "movement", emptyTitle: "No movements match", emptyText: "Change the filters or widen the time range.",
          initialSort: { key: "created_at", dir: "desc" },
          columns: [
            { key: "created_at", label: "Time", render: (e) => html`<div class="nowrap">${fmt.dateTime(e.created_at)}</div>` },
            { key: "entry_type", label: "Direction", render: (e) => ui.direction(e.entry_type) },
            { key: "gate_id", label: "Gate", sort: (e) => R.gateName(e.gate_id), render: (e) => html`<a href="#/gates/${e.gate_id}">${R.gateName(e.gate_id)}</a>` },
            { key: "plate_number", label: "Plate", render: (e) => ui.plate(e.plate_number, "sm") },
            { key: "person", label: "Belongs to", sort: (e) => R.person(e).name, render: (e) => personCell(R.person(e)) },
            { key: "entry_by", label: "Method", render: (e) => ui.entryMethod(e.entry_by) },
          ],
        });
      }
      const on = (sel, ev, fn) => body.querySelector(sel).addEventListener(ev, fn);
      on("[data-q]", "input", (e) => { f.q = e.target.value.trim().toLowerCase(); apply(); });
      on("[data-type]", "change", (e) => { f.type = e.target.value; fetchRows(); });
      on("[data-method]", "change", (e) => { f.method = e.target.value; apply(); });
      on("[data-gate]", "change", (e) => { f.gate = e.target.value; apply(); });
      body.querySelectorAll("[data-range] button").forEach((b) => (b.onclick = () => {
        f.range = b.dataset.v;
        body.querySelectorAll("[data-range] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fetchRows();
      }));
      on("[data-export]", "click", () => downloadCsv(`movements-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Time (UTC)", "Direction", "Gate", "Plate", "Belongs to", "Method"],
        filtered().map((e) => [e.created_at, e.entry_type, R.gateName(e.gate_id), e.plate_number, R.person(e).name, e.entry_by])));
      fetchRows();
    }

    // ---------------- audit log ----------------
    async function audit() {
      let rows;
      try { rows = await api.listLogs(); } catch (err) { body.innerHTML = String(ui.errorState(err)); body.querySelector("[data-retry]").onclick = audit; return; }
      const users = auth.can("users.view") ? await api.listUsers().catch(() => []) : [];
      const who = (id) => { const u = users.find((x) => x.id === id); return u ? (window.GH.seed ? window.GH.seed.displayName[u.username] || u.username : u.username) : `User #${id}`; };
      const TONE = { CREATE: "ok", UPDATE: "info", DELETE: "bad", BLOCK: "bad", UNBLOCK: "ok", LOGIN: "", LOGOUT: "", OTHER: "" };
      body.innerHTML = String(html`<section class="panel">
        <div class="toolbar">
          <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search description or user" aria-label="Search audit log" data-q></div>
          <select class="select" aria-label="Action" data-action><option value="">Any action</option>${Object.keys(TONE).map((a) => html`<option>${a}</option>`)}</select>
        </div>
        <div data-table></div>
      </section>`);
      const f = { q: "", action: "" };
      const filtered = () => rows.filter((r) => (!f.action || r.action_type === f.action) && (!f.q || `${r.description} ${who(r.user_id)}`.toLowerCase().includes(f.q)));
      const t = ui.table(body.querySelector("[data-table]"), {
        rows: filtered(), pageSize: 15, rowLabel: "entry", initialSort: { key: "created_at", dir: "desc" },
        columns: [
          { key: "created_at", label: "Time", render: (r) => html`<div class="nowrap">${fmt.dateTime(r.created_at)}</div>` },
          { key: "user_id", label: "By", sort: (r) => who(r.user_id), render: (r) => html`<span class="cell-title" style="font-weight:500">${who(r.user_id)}</span>` },
          { key: "action_type", label: "Action", render: (r) => ui.badge(r.action_type.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), TONE[r.action_type]) },
          { key: "entity_name", label: "Record", render: (r) => html`<span class="mono small">${r.entity_name || "—"}${r.entity_id ? ` #${r.entity_id}` : ""}</span>` },
          { key: "description", label: "Details", sortable: false },
        ],
      });
      body.querySelector("[data-q]").oninput = (e) => { f.q = e.target.value.trim().toLowerCase(); t.setRows(filtered()); };
      body.querySelector("[data-action]").onchange = (e) => { f.action = e.target.value; t.setRows(filtered()); };
    }

    show();
  };

  /** Manual movement: entry_by is always MANUAL. */
  function manualForm(R, done) {
    const d = ui.drawer({
      title: "Log manual movement",
      subtitle: "Use when a vehicle passed without automatic recognition. Recorded under your name.",
      body: html`<form class="form" id="manual-form" novalidate>
        <div class="form-row">
          ${ui.field("gate_id", "Gate", ui.select("gate_id", [["", "Select a gate"], ...R.gates.map((g) => [g.id, g.name])], ""), { required: true })}
          ${ui.field("entry_type", "Direction", ui.select("entry_type", [["ENTRY", "Entry"], ["EXIT", "Exit"]], "ENTRY"), { required: true })}
        </div>
        ${ui.field("plate_number", "Plate", ui.input("plate_number", "", 'placeholder="e.g. س ع د 4821" dir="auto"'), { hint: "Leave empty for pedestrians or unreadable plates." })}
        ${ui.field("resident_id", "Resident (optional)", ui.select("resident_id", [["", "Not linked to a resident"], ...R.residents.map((r) => [r.id, `${r.full_name} · ${r.unit.name}`])], ""))}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="manual-form">Log movement</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      if (!v.gate_id) return ui.showErrors(form, { gate_id: "Choose the gate." });
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => api.createManualEntry({ entry_type: v.entry_type, entry_by: "MANUAL", gate_id: Number(v.gate_id), plate_number: v.plate_number || null, resident_id: v.resident_id ? Number(v.resident_id) : null }));
        ui.toast("Movement logged.");
        d.close();
        done && done();
      } catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }
})();
