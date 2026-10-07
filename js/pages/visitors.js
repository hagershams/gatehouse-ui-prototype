/* Visitors: QR passes, visit log, walk-in (ID document) visitors,
   plus the resident portal which reuses the pass form. */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead } = window.GH.common;

  /** Pass status derived from the contract fields (no extra API). */
  function passStatus(q) {
    const now = ui.toNaiveUtc(new Date());
    const visits = Math.floor((q.used_count || 0) / 2);
    if (q.max_uses && q.used_count >= q.max_uses * 2) return ["Used up", "", "check"];
    if (q.expiry_date < now) return ["Expired", "", "clock"];
    if (!q.is_active) return ["Inactive", "", "lock"];
    if (q.start_at > now) return ["Scheduled", "info", "clock"];
    return [visits ? "In use" : "Valid", "ok", "check"];
  }
  const usage = (q) => {
    const max = q.max_uses || 1;
    const used = Math.min(max, q.used_count / 2);
    return html`<div class="row" style="gap:8px"><div class="progress" style="width:64px" role="img" aria-label="${used} of ${max} visits used"><span style="width:${(used / max) * 100}%"></span></div><span class="small mono">${Math.floor(used)}/${max}</span></div>`;
  };

  window.GH.pages.visitors = async function (page) {
    let tab = "passes";
    const wantsIssue = new URLSearchParams(location.hash.split("?")[1]).get("issue") === "1";
    page.innerHTML = String(html`
      ${pageHead({
        title: "Visitors",
        sub: "Visitor passes, visits and walk-in visitors identified by their documents.",
        actions: auth.can("qr.issue") ? html`<button class="btn primary" data-issue>${icon("ticket")}Issue visitor pass</button>` : "",
      })}
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="passes" aria-selected="true">Visitor passes</button>
        <button class="tab" role="tab" data-tab="visits" aria-selected="false">Visit log</button>
        <button class="tab" role="tab" data-tab="walkins" aria-selected="false">Walk-in visitors</button>
      </div>
      <div data-body></div>`);
    const body = page.querySelector("[data-body]");
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
      tab = b.dataset.tab;
      page.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      show();
    }));
    let residents = [];
    try { residents = (await api.listResidents({ limit: 1000 })).data; } catch { /* host names fall back to ids */ }
    const host = (id) => residents.find((r) => r.id === id);
    const issueBtn = page.querySelector("[data-issue]");
    if (issueBtn) issueBtn.onclick = () => passForm({ residents, staff: true, done: () => tab === "passes" && show() });
    if (wantsIssue && issueBtn) { history.replaceState(null, "", "#/visitors"); issueBtn.click(); }

    async function show() {
      body.innerHTML = String(ui.loading(8));
      try { tab === "passes" ? await passes() : tab === "visits" ? await visits() : await walkins(); }
      catch (err) { body.innerHTML = String(ui.errorState(err)); body.querySelector("[data-retry]").onclick = show; }
    }

    async function passes() {
      const rows = await api.listQRCodes();
      body.innerHTML = String(html`<section class="panel"><div class="toolbar">
        <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search visitor or host" aria-label="Search passes" data-q></div>
        <div class="seg" role="group" aria-label="Status" data-st>${[["", "All"], ["Valid", "Valid now"], ["Scheduled", "Scheduled"], ["Expired", "Expired"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === ""}">${l}</button>`)}</div>
      </div><div data-table></div></section>`);
      const f = { q: "", st: "" };
      const filtered = () => rows.filter((q) => {
        const st = passStatus(q)[0];
        const h = host(q.resident_id);
        return (!f.st || (f.st === "Valid" ? st === "Valid" || st === "In use" : st === f.st)) &&
          (!f.q || `${q.visitor_full_name} ${q.visitor_phone_number} ${h ? h.full_name : ""}`.toLowerCase().includes(f.q));
      });
      const t = ui.table(body.querySelector("[data-table]"), {
        rows: filtered(), pageSize: 12, rowLabel: "pass", onRow: (q) => passDetail(q, host(q.resident_id)),
        emptyTitle: "No visitor passes", emptyText: "Passes issued by staff or residents appear here.", initialSort: { key: "start_at", dir: "desc" },
        columns: [
          { key: "visitor_full_name", label: "Visitor", render: (q) => html`<div class="cell-title">${q.visitor_full_name}</div><div class="cell-sub mono">${q.visitor_phone_number}</div>` },
          { key: "host", label: "Host", sort: (q) => (host(q.resident_id) || {}).full_name, render: (q) => { const h = host(q.resident_id); return h ? html`<div>${h.full_name}</div><div class="cell-sub">${h.unit.name}</div>` : html`<span class="muted">Resident #${q.resident_id}</span>`; } },
          { key: "start_at", label: "Valid", render: (q) => html`<div class="nowrap small">${fmt.dateTime(q.start_at)}</div><div class="cell-sub nowrap">until ${fmt.dateTime(q.expiry_date)}</div>` },
          { key: "used_count", label: "Visits", render: usage },
          { key: "status", label: "Status", sort: (q) => passStatus(q)[0], render: (q) => { const [l, tn, ic] = passStatus(q); return ui.badge(l, tn, ic); } },
          { key: "created_by_type", label: "Issued by", render: (q) => html`<span class="small ink-2">${q.created_by_type === "user" ? "Staff" : "Resident"}</span>` },
        ],
      });
      body.querySelector("[data-q]").oninput = (e) => { f.q = e.target.value.trim().toLowerCase(); t.setRows(filtered()); };
      body.querySelectorAll("[data-st] button").forEach((b) => (b.onclick = () => { f.st = b.dataset.v; body.querySelectorAll("[data-st] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); t.setRows(filtered()); }));
    }

    async function visits() {
      const rows = await api.listVisitorLogs();
      body.innerHTML = String(html`<section class="panel"><div data-table></div></section>`);
      ui.table(body.querySelector("[data-table]"), {
        rows, pageSize: 15, rowLabel: "visit", emptyTitle: "No visits yet", emptyText: "Each time a visitor pass is scanned at a gate, a visit is recorded here.",
        initialSort: { key: "entry_time", dir: "desc" },
        columns: [
          { key: "visitor_full_name", label: "Visitor", render: (v) => html`<div class="cell-title">${v.visitor_full_name || "—"}</div><div class="cell-sub mono">${v.visitor_phone_number || ""}</div>` },
          { key: "resident", label: "Visiting", sort: (v) => (v.resident || {}).full_name, render: (v) => (v.resident ? v.resident.full_name : html`<span class="muted">—</span>`) },
          { key: "entry_time", label: "Arrived", render: (v) => html`<span class="nowrap">${fmt.dateTime(v.entry_time)}</span>` },
          { key: "exit_time", label: "Left", render: (v) => (v.exit_time ? html`<span class="nowrap">${fmt.dateTime(v.exit_time)}</span>` : ui.badge("Still inside", "info")) },
          { key: "duration", label: "Stayed", sort: (v) => (v.exit_time ? ui.toDate(v.exit_time) - ui.toDate(v.entry_time) : Infinity), render: (v) => {
            const end = v.exit_time ? ui.toDate(v.exit_time) : new Date();
            const m = Math.round((end - ui.toDate(v.entry_time)) / 60000);
            return html`<span class="mono small">${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`}</span>`;
          } },
          { key: "created_by", label: "Pass from", sort: (v) => (v.created_by || {}).name, render: (v) => html`<span class="small ink-2">${v.created_by ? v.created_by.name : "—"}</span>` },
        ],
      });
    }

    async function walkins() {
      const rows = await api.listIdentityVisitors();
      const DOC = { national_id: "National ID", driving_license: "Driving licence", passport: "Passport" };
      const ST = { inside: ["On site", "info"], exited: ["Left", ""], blocked: ["Blocked", "bad"] };
      body.innerHTML = String(html`<div class="notice" style="margin-bottom:var(--s-4)">${icon("idCard")}<div>Walk-in visitors are registered at the gate by scanning an ID card, driving licence or passport. Exit recording isn't supported by the backend yet (BD-13).</div></div>
        <section class="panel"><div data-table></div></section>`);
      ui.table(body.querySelector("[data-table]"), {
        rows, pageSize: 12, rowLabel: "visitor", emptyTitle: "No walk-in visitors", emptyText: "Scanned visitors appear here.", initialSort: { key: "last_entry_time", dir: "desc" },
        columns: [
          { key: "full_name", label: "Visitor", render: (v) => html`<div class="cell-title">${v.full_name || "Unknown"}</div><div class="cell-sub">${v.nationality_en || ""}</div>` },
          { key: "document_type", label: "Document", render: (v) => html`<div>${DOC[v.document_type]}</div><div class="cell-sub mono">${v.national_id || v.license_number || "—"}</div>` },
          { key: "plate_number", label: "Plate", render: (v) => (v.plate_number ? ui.plate(v.plate_number, "sm") : html`<span class="muted">On foot</span>`) },
          { key: "last_entry_time", label: "Last arrival", render: (v) => html`<span class="nowrap">${fmt.dateTime(v.last_entry_time)}</span>` },
          { key: "entries_count", label: "Visits", align: "right", render: (v) => html`<span class="mono">${v.entries_count || 0}</span>` },
          { key: "status", label: "Status", render: (v) => ui.badge(...ST[v.status]) },
        ],
      });
    }

    show();
  };

  // ---------------- pass detail ----------------
  function passDetail(q, h) {
    const [l, tn, ic] = passStatus(q);
    ui.drawer({
      title: q.visitor_full_name,
      subtitle: h ? `Visiting ${h.full_name} · ${h.unit.name}` : null,
      body: html`<div class="row wrap" style="margin-bottom:var(--s-5)">${ui.badge(l, tn, ic)}</div>
        <div class="qr-preview">${ui.qrPreview(q.token)}<span class="mono xs muted" style="margin-top:8px">${q.token}</span></div>
        <dl class="dl" style="margin-top:var(--s-5)">
          <dt>Phone</dt><dd class="mono">${q.visitor_phone_number}</dd>
          <dt>National ID</dt><dd class="mono">${q.visitor_national_id}</dd>
          <dt>Valid from</dt><dd>${fmt.dateTime(q.start_at)}</dd>
          <dt>Valid until</dt><dd>${fmt.dateTime(q.expiry_date)}</dd>
          <dt>Visits</dt><dd>${usage(q)}</dd>
          <dt>Issued</dt><dd>${fmt.dateTime(q.created_at)} by ${q.created_by_type === "user" ? "staff" : "the resident"}</dd>
        </dl>
        <p class="small muted" style="margin-top:var(--s-5)">One visit = one entry and one exit. Passes can't be revoked yet (backend gap) — they stop working when they expire or are used up.</p>`,
    });
  }

  // ---------------- issue form (staff + resident) ----------------
  function toLocalInput(d) { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
  function passForm({ residents, staff, done }) {
    const start = new Date(); start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 86400000); end.setHours(23, 59, 0, 0);
    const d = ui.drawer({
      title: "Issue visitor pass",
      subtitle: "The visitor shows the QR code at the gate. Each visit uses one entry and one exit.",
      body: html`<form class="form" id="pass-form" novalidate>
        ${staff ? ui.field("resident_id", "Host resident", ui.select("resident_id", [["", "Who is the visitor coming to see?"], ...residents.filter((r) => r.status === "allowed").sort((a, b) => a.full_name.localeCompare(b.full_name)).map((r) => [r.id, `${r.full_name} · ${r.unit.name}`])], ""), { required: true }) : ""}
        ${ui.field("visitor_full_name", "Visitor's full name", ui.input("visitor_full_name", "", 'required autocomplete="off"'), { required: true })}
        <div class="form-row">
          ${ui.field("visitor_phone_number", "Visitor's phone", ui.input("visitor_phone_number", "", 'inputmode="tel" required placeholder="01012345678"'), { required: true })}
          ${ui.field("visitor_national_id", "Visitor's national ID", ui.input("visitor_national_id", "", 'inputmode="numeric" required placeholder="14 digits"'), { required: true })}
        </div>
        <div class="form-row">
          ${ui.field("start_at", "Valid from", ui.input("start_at", toLocalInput(start), 'type="datetime-local" required'), { required: true })}
          ${ui.field("expiry_date", "Valid until", ui.input("expiry_date", toLocalInput(end), 'type="datetime-local" required'), { required: true })}
        </div>
        ${ui.field("max_uses", "Number of visits", ui.select("max_uses", [[1, "1 visit"], [2, "2 visits"], [3, "3 visits"], [5, "5 visits"], [10, "10 visits"]], 1))}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="pass-form">${icon("ticket")}Issue pass</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (staff && !v.resident_id) errs.resident_id = "Choose the host resident.";
      if (!v.visitor_full_name) errs.visitor_full_name = "Enter the visitor's name.";
      if (!/^\+?\d{8,15}$/.test(v.visitor_phone_number || "")) errs.visitor_phone_number = "Enter a phone number using digits.";
      if (!/^\d{14}$/.test(v.visitor_national_id || "")) errs.visitor_national_id = "National IDs are 14 digits.";
      const s = new Date(v.start_at), x = new Date(v.expiry_date);
      if (!(x > s)) errs.expiry_date = "Must be after the start time.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      const payload = {
        visitor_full_name: v.visitor_full_name, visitor_phone_number: v.visitor_phone_number, visitor_national_id: v.visitor_national_id,
        start_at: ui.toNaiveUtc(s), expiry_date: ui.toNaiveUtc(x), max_uses: Number(v.max_uses),
        ...(staff ? { resident_id: Number(v.resident_id) } : {}),
      };
      try {
        const res = await ui.busy(d.el.querySelector("[type=submit]"), () => (staff ? api.issueQR(payload) : api.residentIssueQR(payload)));
        d.close();
        issued(res, payload);
        done && done();
      } catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }
  function issued(res, payload) {
    const d = ui.drawer({
      title: "Pass ready",
      subtitle: `For ${payload.visitor_full_name}, visiting ${res.resident_name}`,
      body: html`<div class="qr-preview">${ui.qrPreview(res.token)}<span class="mono xs muted" style="margin-top:8px">${res.token}</span></div>
        <dl class="dl" style="margin-top:var(--s-5)"><dt>Valid</dt><dd>${fmt.dateTime(res.start_at)} → ${fmt.dateTime(res.expiry_date)}</dd><dt>Visits</dt><dd>${res.max_uses}</dd></dl>
        <p class="small muted" style="margin-top:var(--s-4)">Send the QR image to the visitor (WhatsApp or SMS). In this prototype the image is a visual preview; the backend generates the scannable PNG.</p>`,
      footer: html`<button class="btn" data-copy>${icon("copy")}Copy pass code</button><button class="btn primary" data-done>Done</button>`,
    });
    d.el.querySelector("[data-done]").onclick = d.close;
    d.el.querySelector("[data-copy]").onclick = async () => { try { await navigator.clipboard.writeText(res.token); ui.toast("Pass code copied."); } catch { ui.toast("Couldn't copy — select the code instead.", "warn"); } };
    ui.toast("Visitor pass issued.");
  }

  // ---------------- resident portal ----------------
  window.GH.pages.portal = async function (page) {
    const s = auth.session();
    page.innerHTML = String(html`
      ${pageHead({ title: `Welcome, ${s.name.split(" ")[0]}`, sub: "Invite visitors and see the passes you've created.", actions: html`<button class="btn primary" data-issue>${icon("ticket")}Invite a visitor</button>` })}
      <section class="panel"><div class="panel-head"><h2 class="panel-title">My visitor passes</h2></div><div data-table>${ui.loading(5)}</div></section>`);
    async function load() {
      try {
        const rows = await api.listQRCodes();
        ui.table(page.querySelector("[data-table]"), {
          rows, pageSize: 10, rowLabel: "pass", onRow: (q) => passDetail(q, null), initialSort: { key: "start_at", dir: "desc" },
          emptyTitle: "You haven't invited anyone yet", emptyText: "Create a pass and send the QR code to your visitor.",
          columns: [
            { key: "visitor_full_name", label: "Visitor", render: (q) => html`<div class="cell-title">${q.visitor_full_name}</div><div class="cell-sub mono">${q.visitor_phone_number}</div>` },
            { key: "start_at", label: "Valid", render: (q) => html`<span class="small nowrap">${fmt.dateTime(q.start_at)} → ${fmt.dateTime(q.expiry_date)}</span>` },
            { key: "used_count", label: "Visits", render: usage },
            { key: "status", label: "Status", sort: (q) => passStatus(q)[0], render: (q) => { const [l, tn, ic] = passStatus(q); return ui.badge(l, tn, ic); } },
          ],
        });
      } catch (err) { page.querySelector("[data-table]").innerHTML = String(ui.errorState(err)); page.querySelector("[data-retry]").onclick = load; }
    }
    page.querySelector("[data-issue]").onclick = () => passForm({ residents: [], staff: false, done: load });
    load();
  };
})();
