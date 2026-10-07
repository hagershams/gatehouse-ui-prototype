/* Shared UI toolkit: escaping, icons, formatting, status renderers, overlays,
   data table, states and charts. Plain DOM + template strings. */
(function () {
  "use strict";

  // ---------- escaping ----------
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = (s) => new Raw(s);
  /** Tagged template: interpolations are escaped unless wrapped in raw() or produced by html``. Arrays are joined. */
  function html(strings, ...vals) {
    let out = strings[0];
    vals.forEach((v, i) => {
      const part = Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join("") : v instanceof Raw ? v.s : v === false || v == null ? "" : esc(v);
      out += part + strings[i + 1];
    });
    return raw(out);
  }

  // ---------- icons (24px grid, stroke) ----------
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    gate: '<path d="M4 21V9"/><path d="M4 11h16"/><path d="M8 11l2-2M12 11l2-2M16 11l2-2"/><path d="M20 21v-6"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
    ticket: '<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    car: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
    camera: '<path d="M4 7h10l2 3h4v8H4z"/><circle cx="11" cy="13" r="3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    building: '<path d="M4 21V5l8-2v18"/><path d="M12 9h8v12"/><path d="M8 8v.01M8 12v.01M8 16v.01M16 13v.01M16 17v.01"/><path d="M2 21h20"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5.5 12.5a10 10 0 0 1 13 0"/><path d="M9 16a5 5 0 0 1 6 0"/><path d="M12 19.5v.01"/>',
    wifiOff: '<path d="M3 3l18 18"/><path d="M9 16a5 5 0 0 1 6 0"/><path d="M5.5 12.5a10 10 0 0 1 4-2.3M14.5 10.2a10 10 0 0 1 4 2.3"/><path d="M2 9a15 15 0 0 1 5-3.1M11 4.8A15 15 0 0 1 22 9"/><path d="M12 19.5v.01"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    signIn: '<path d="M10 4H5v16h5"/><path d="M14 16l4-4-4-4"/><path d="M18 12H9"/>',
    signOut: '<path d="M14 4h5v16h-5"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h9"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    userCheck: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="m16 11 2 2 4-4"/>',
    userX: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="m17 8 4 4M21 8l-4 4"/>',
    idCard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M15 10h3M15 14h3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  };
  const icon = (name, cls = "") => raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`);

  // ---------- formatting (backend timestamps are naive UTC) ----------
  const toDate = (iso) => (iso ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z") : null);
  const toNaiveUtc = (d) => d.toISOString().slice(0, 19);
  const fmt = {
    time: (iso) => (iso ? toDate(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "—"),
    date: (iso) => (iso ? toDate(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—"),
    dateTime: (iso) => (iso ? toDate(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "—"),
    rel(iso) {
      if (!iso) return "never";
      const s = (Date.now() - toDate(iso).getTime()) / 1000;
      if (s < 0) { const m = Math.round(-s / 60); return m < 60 ? `in ${m} min` : m < 1440 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} d`; }
      if (s < 45) return "just now";
      if (s < 3600) return `${Math.round(s / 60)} min ago`;
      if (s < 86400) return `${Math.round(s / 3600)} h ago`;
      return `${Math.round(s / 86400)} d ago`;
    },
    num: (n) => (n == null ? "—" : Number(n).toLocaleString()),
    initials: (name) => String(name || "?").split(/[\s.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""),
  };
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return toNaiveUtc(d); };

  // ---------- domain renderers ----------
  function plate(text, size = "") {
    if (!text) return html`<span class="plate none ${size}" aria-label="No plate read"><span class="plate-band"><span>EGYPT</span><span>مصر</span></span><span class="plate-text">—</span></span>`;
    return html`<span class="plate ${size}" title="${text}"><span class="plate-band"><span>EGYPT</span><span>مصر</span></span><span class="plate-text">${text}</span></span>`;
  }

  /** Barrier glyph: arm down = closed, raised = open, dashed = unknown. */
  const barrier = (state) => raw(`<svg class="barrier ${state}" viewBox="0 0 28 16" aria-hidden="true"><rect class="post" x="2" y="6" width="5" height="10" rx="1"/><line class="arm" x1="5" y1="12" x2="26" y2="12"/></svg>`);

  /** active = connectivity; is_open = last reported physical state (Unknown while offline). */
  function gateState(gate, { pending } = {}) {
    const online = gate.active === true;
    const conn = gate.active == null
      ? html`<span class="badge">${icon("clock")}Not checked</span>`
      : online ? html`<span class="badge ok">${icon("wifi")}Online</span>` : html`<span class="badge bad">${icon("wifiOff")}Offline</span>`;
    let phys;
    if (pending) phys = html`<span class="badge warn"><span class="spin" style="width:10px;height:10px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></span>Command sent</span>`;
    else if (!online) phys = html`<span class="badge outline">${barrier("unknown")}Unknown</span>`;
    else if (gate.is_open) phys = html`<span class="badge open">${barrier("open")}Open</span>`;
    else phys = html`<span class="badge">${barrier("closed")}Closed</span>`;
    return html`<span class="gate-state">${conn}${phys}</span>`;
  }

  const ENTRY_BY = { NORMAL: ["Plate (LPR)", "car"], QR: ["QR code", "qr"], MANUAL: ["Manual", "edit"], CARD: ["Card", "idCard"] };
  const entryMethod = (by) => { const [label, ic] = ENTRY_BY[by] || [by, "info"]; return html`<span class="row ink-2 nowrap">${icon(ic)}${label}</span>`; };
  const direction = (type) => (type === "ENTRY"
    ? html`<span class="badge info">${icon("signIn")}Entry</span>`
    : html`<span class="badge">${icon("signOut")}Exit</span>`);
  const badge = (text, tone = "", ic = null) => html`<span class="badge ${tone}">${ic ? icon(ic) : ""}${text}</span>`;

  // ---------- toasts ----------
  function toast(message, tone = "ok") {
    let host = document.querySelector(".toasts");
    if (!host) { host = document.createElement("div"); host.className = "toasts"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite"); document.body.append(host); }
    const el = document.createElement("div");
    el.className = `toast ${tone}`;
    el.innerHTML = String(html`${icon(tone === "bad" ? "alert" : tone === "warn" ? "info" : "check")}<div>${message}</div>`);
    host.append(el);
    setTimeout(() => el.remove(), tone === "bad" ? 6500 : 4000);
  }
  function errorMessage(err) {
    if (!err) return "Something went wrong.";
    if (err.status === 403) return "You don't have permission to do that.";
    if (err.status === 422) return "Some fields need attention.";
    if (err.status >= 500) return `${typeof err.detail === "string" ? err.detail : "The server could not complete the request"}. Try again.`;
    return typeof err.detail === "string" ? err.detail : err.message;
  }

  // ---------- focus trap helpers ----------
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function trap(container, onEscape) {
    const prev = document.activeElement;
    const handler = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onEscape(); }
      if (e.key !== "Tab") return;
      const els = [...container.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); prev && prev.focus && prev.focus(); };
  }

  // ---------- drawer ----------
  /** Opens a side drawer. render(body) fills it; returns { close, el, body, foot }. */
  function drawer({ title, subtitle, body, footer, onClose }) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const el = document.createElement("aside");
    el.className = "drawer";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "drawer-title");
    el.innerHTML = String(html`
      <div class="drawer-head">
        <div style="flex:1;min-width:0"><h2 class="drawer-title" id="drawer-title">${title}</h2>${subtitle ? html`<p class="muted small" style="margin-top:2px">${subtitle}</p>` : ""}</div>
        <button class="btn ghost icon-only" data-close aria-label="Close">${icon("x")}</button>
      </div>
      <div class="drawer-body">${body || ""}</div>
      ${footer ? html`<div class="drawer-foot">${footer}</div>` : ""}`);
    document.body.append(overlay, el);
    let release;
    const close = () => { release && release(); overlay.remove(); el.remove(); onClose && onClose(); };
    release = trap(el, close);
    overlay.addEventListener("click", close);
    el.querySelector("[data-close]").addEventListener("click", close);
    setTimeout(() => (el.querySelector(".drawer-body " + FOCUSABLE) || el.querySelector("[data-close]")).focus(), 30);
    return { close, el, body: el.querySelector(".drawer-body"), foot: el.querySelector(".drawer-foot") };
  }

  // ---------- confirm dialog ----------
  function confirm({ title, message, confirmLabel = "Confirm", tone = "warn", icon: ic = "alert" }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay top";
      const el = document.createElement("div");
      el.className = "dialog";
      el.setAttribute("role", "alertdialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "dlg-title");
      el.innerHTML = String(html`
        <div class="dialog-body">
          <div class="dialog-icon ${tone === "danger" ? "danger" : ""}">${icon(ic, "lg")}</div>
          <div><h2 id="dlg-title">${title}</h2><p>${message}</p></div>
        </div>
        <div class="dialog-foot">
          <button class="btn" data-no>Cancel</button>
          <button class="btn ${tone === "danger" ? "danger solid" : "primary"}" data-yes>${confirmLabel}</button>
        </div>`);
      document.body.append(overlay, el);
      let release;
      const done = (v) => { release(); overlay.remove(); el.remove(); resolve(v); };
      release = trap(el, () => done(false));
      el.querySelector("[data-no]").onclick = () => done(false);
      el.querySelector("[data-yes]").onclick = () => done(true);
      overlay.onclick = () => done(false);
      el.querySelector("[data-yes]").focus();
    });
  }

  // ---------- states ----------
  const loading = (rows = 5) => html`<div class="panel-body stack" aria-busy="true" aria-label="Loading">${Array.from({ length: rows }, (_, i) => html`<div class="skeleton" style="width:${[92, 78, 85, 64, 88][i % 5]}%"></div>`)}</div>`;
  const empty = (title, text, action = "") => html`<div class="state">${icon("search")}<h3>${title}</h3><p>${text}</p>${action}</div>`;
  const errorState = (err, retryAttr = "data-retry") => html`<div class="state error" role="alert">${icon("alert")}<h3>Couldn't load this</h3><p>${errorMessage(err)}</p><button class="btn" ${raw(retryAttr)}>${icon("refresh")}Try again</button></div>`;
  const forbiddenState = () => html`<div class="state">${icon("lock")}<h3>You don't have access to this page</h3><p>Your role doesn't include this area. Ask an administrator if you need it.</p><a class="btn" href="#/dashboard">Go to dashboard</a></div>`;

  // ---------- data table ----------
  /**
   * Client-side sortable/paginated table.
   * columns: [{ key, label, render(row) → html, sort(row) → value, align, width }]
   */
  function table(host, { columns, rows, pageSize = 12, onRow, emptyTitle = "Nothing here yet", emptyText = "", rowLabel = "row", initialSort }) {
    const st = { rows, page: 0, sort: initialSort || null };
    function sorted() {
      if (!st.sort) return st.rows;
      const col = columns.find((c) => c.key === st.sort.key);
      const val = col.sort || ((r) => r[col.key]);
      return [...st.rows].sort((a, b) => {
        const x = val(a), y = val(b);
        const c = x == null ? 1 : y == null ? -1 : typeof x === "number" ? x - y : String(x).localeCompare(String(y));
        return st.sort.dir === "asc" ? c : -c;
      });
    }
    function render() {
      if (!st.rows.length) { host.innerHTML = String(empty(emptyTitle, emptyText)); return; }
      const all = sorted();
      const pages = Math.max(1, Math.ceil(all.length / pageSize));
      st.page = Math.min(st.page, pages - 1);
      const slice = all.slice(st.page * pageSize, st.page * pageSize + pageSize);
      host.innerHTML = String(html`
        <div class="table-wrap"><table class="data">
          <thead><tr>${columns.map((c) => {
            const active = st.sort && st.sort.key === c.key;
            const aria = active ? (st.sort.dir === "asc" ? "ascending" : "descending") : "none";
            const inner = c.sortable === false || !c.label ? html`${c.label || ""}` : html`<button data-sort="${c.key}">${c.label}${active ? icon(st.sort.dir === "asc" ? "arrowUp" : "arrowDown") : ""}</button>`;
            return html`<th class="${c.align === "right" ? "num" : ""}" aria-sort="${aria}" style="${c.width ? `width:${c.width}` : ""}">${inner}</th>`;
          })}</tr></thead>
          <tbody>${slice.map((r, i) => html`<tr class="${onRow ? "clickable" : ""}" data-i="${st.page * pageSize + i}" ${onRow ? raw('tabindex="0"') : ""}>${columns.map((c) => html`<td class="${c.align === "right" ? "num" : ""} ${c.key === "_actions" ? "actions" : ""}">${c.render ? c.render(r) : r[c.key] ?? "—"}</td>`)}</tr>`)}</tbody>
        </table></div>
        ${all.length > pageSize ? html`<div class="pager"><span>${st.page * pageSize + 1}–${Math.min(all.length, (st.page + 1) * pageSize)} of ${fmt.num(all.length)} ${rowLabel}s</span><span class="spacer"></span>
          <button class="btn sm icon-only" data-page="-1" ${st.page === 0 ? raw("disabled") : ""} aria-label="Previous page">${icon("chevronLeft")}</button>
          <span>Page ${st.page + 1} of ${pages}</span>
          <button class="btn sm icon-only" data-page="1" ${st.page >= pages - 1 ? raw("disabled") : ""} aria-label="Next page">${icon("chevronRight")}</button></div>` : html`<div class="pager"><span>${fmt.num(all.length)} ${rowLabel}${all.length === 1 ? "" : "s"}</span></div>`}`);
      host.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => {
        const key = b.dataset.sort;
        st.sort = st.sort && st.sort.key === key ? { key, dir: st.sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
        render();
      }));
      host.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => { st.page += Number(b.dataset.page); render(); }));
      if (onRow) {
        host.querySelectorAll("tbody tr").forEach((tr) => {
          const open = (e) => { if (e.target.closest("button,a")) return; onRow(all[Number(tr.dataset.i)]); };
          tr.addEventListener("click", open);
          tr.addEventListener("keydown", (e) => e.key === "Enter" && open(e));
        });
      }
    }
    render();
    return { setRows(r) { st.rows = r; st.page = 0; render(); }, render };
  }

  // ---------- forms ----------
  const field = (name, label, control, { hint, required } = {}) =>
    html`<div class="field" data-field="${name}"><label for="f-${name}">${label}${required ? html` <span class="muted" aria-hidden="true">*</span>` : ""}</label>${control}${hint ? html`<div class="hint">${hint}</div>` : ""}</div>`;
  const input = (name, value = "", attrs = "") => html`<input class="input" id="f-${name}" name="${name}" value="${value ?? ""}" ${raw(attrs)}>`;
  const select = (name, options, value, attrs = "") => html`<select class="select" id="f-${name}" name="${name}" ${raw(attrs)}>${options.map(([v, l]) => html`<option value="${v}" ${String(v) === String(value ?? "") ? raw("selected") : ""}>${l}</option>`)}</select>`;
  function formValues(form) {
    const out = {};
    new FormData(form).forEach((v, k) => (out[k] = typeof v === "string" ? v.trim() : v));
    return out;
  }
  /** Shows server/client errors on fields: { field: message } or a form-level message. */
  function showErrors(form, errors, formMessage) {
    form.querySelectorAll(".field.invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".error")?.remove(); });
    form.querySelector(".form-error")?.remove();
    let first = null;
    Object.entries(errors || {}).forEach(([name, msg]) => {
      const f = form.querySelector(`[data-field="${name}"]`);
      if (!f) return;
      f.classList.add("invalid");
      f.insertAdjacentHTML("beforeend", String(html`<div class="error" id="err-${name}">${icon("alert")}${msg}</div>`));
      const ctl = f.querySelector("input,select,textarea");
      ctl && ctl.setAttribute("aria-describedby", `err-${name}`);
      first = first || ctl;
    });
    if (formMessage) form.insertAdjacentHTML("afterbegin", String(html`<div class="form-error" role="alert">${formMessage}</div>`));
    first && first.focus();
  }
  async function busy(button, fn) {
    const label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spin"></span>' + button.textContent;
    try { return await fn(); } finally { button.disabled = false; button.innerHTML = label; }
  }

  // ---------- QR preview (visual only; the real image is served by the backend) ----------
  function qrPreview(token) {
    let h = 0;
    for (const c of token) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const n = 25, cell = 8, cells = [];
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = (h * 1103515245 + 12345) >>> 0;
      if (h % 100 < 47) cells.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
    }
    const f = (x, y) => `<rect x="${x * cell}" y="${y * cell}" width="${7 * cell}" height="${7 * cell}" fill="none" stroke="#14201c" stroke-width="${cell}" transform="translate(${cell / 2} ${cell / 2}) scale(${6 / 7})"/><rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}"/>`;
    return raw(`<svg viewBox="-8 -8 ${n * cell + 16} ${n * cell + 16}" role="img" aria-label="QR code preview"><rect x="-8" y="-8" width="${n * cell + 16}" height="${n * cell + 16}" fill="#fff"/><g fill="#14201c">${cells.join("")}${f(0, 0)}${f(n - 7, 0)}${f(0, n - 7)}</g></svg>`);
  }

  // ---------- charts ----------
  /** Grouped columns: entries vs exits per hour. Two series → legend + hover tooltip. */
  function hourlyChart(host, buckets) {
    const W = 720, H = 220, L = 34, B = 24, T = 10;
    const max = Math.max(4, ...buckets.map((b) => Math.max(b.in, b.out)));
    const step = Math.ceil(max / 4);
    const top = step * 4;
    const plotW = W - L - 4, plotH = H - B - T;
    const slot = plotW / buckets.length, bw = Math.max(3, Math.min(10, slot / 2 - 2));
    const y = (v) => T + plotH - (v / top) * plotH;
    const ticks = [0, step, step * 2, step * 3, step * 4];
    const nowH = new Date().getHours();
    let marks = "";
    buckets.forEach((b, i) => {
      const x0 = L + i * slot + slot / 2 - bw - 1;
      const rr = Math.min(3, bw / 2); // rounded data-end, anchored at the baseline
      const col = (v, x, color) => {
        if (v <= 0) return "";
        const top = Math.min(y(v), y(0) - rr);
        return `<path d="M${x},${y(0)} V${top + rr} q0,-${rr} ${rr},-${rr} h${bw - 2 * rr} q${rr},0 ${rr},${rr} V${y(0)} Z" fill="${color}"/>`;
      };
      marks += `<g class="bar-group" data-i="${i}"><rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${plotH}"/>${col(b.in, x0, "var(--series-1)")}${col(b.out, x0 + bw + 2, "var(--series-2)")}</g>`;
    });
    host.innerHTML = `
      <div class="chart">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entries and exits per hour today">
          <g class="axis">${ticks.map((t) => `<line class="gridline" x1="${L}" x2="${W - 4}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
          ${buckets.map((b, i) => (i % 3 === 0 ? `<text x="${L + i * slot + slot / 2}" y="${H - 6}" text-anchor="middle">${String(b.h).padStart(2, "0")}:00</text>` : "")).join("")}</g>
          <line x1="${L + nowH * slot + slot}" x2="${L + nowH * slot + slot}" y1="${T}" y2="${T + plotH}" stroke="var(--line-strong)" stroke-dasharray="3 3"/>
          ${marks}
        </svg>
        <div class="tooltip" hidden></div>
      </div>`;
    const tip = host.querySelector(".tooltip");
    const svg = host.querySelector("svg");
    host.querySelectorAll(".bar-group").forEach((g) => {
      g.addEventListener("mouseenter", () => {
        const b = buckets[Number(g.dataset.i)];
        const r = g.querySelector(".hit").getBoundingClientRect(), hr = host.getBoundingClientRect();
        tip.innerHTML = `<b>${String(b.h).padStart(2, "0")}:00–${String(b.h + 1).padStart(2, "0")}:00</b><br>Entries ${b.in} · Exits ${b.out}`;
        tip.style.left = `${r.left - hr.left + r.width / 2}px`;
        tip.style.top = `${Math.max(0, r.top - hr.top + (svg.getBoundingClientRect().height * 0.15))}px`;
        tip.hidden = false;
      });
      g.addEventListener("mouseleave", () => (tip.hidden = true));
    });
  }

  /** Horizontal bars, one series: totals per gate; tooltip shows the method breakdown. */
  function gateBars(host, rows) {
    const max = Math.max(1, ...rows.map((r) => r.total));
    host.innerHTML = String(html`${rows.map((r) => html`
      <div class="hbar" tabindex="0" data-tip="${r.tip}">
        <span class="nowrap" style="overflow:hidden;text-overflow:ellipsis">${r.label}</span>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(r.total / max) * 100}%"></div></div>
        <span class="num mono small" style="text-align:right">${fmt.num(r.total)}</span>
      </div>`)}<div class="tooltip" hidden></div>`);
    host.style.position = "relative";
    const tip = host.querySelector(".tooltip");
    host.querySelectorAll(".hbar").forEach((b) => {
      const show = () => { const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect(); tip.textContent = b.dataset.tip; tip.style.left = `${r.left - hr.left + r.width / 2}px`; tip.style.top = `${r.top - hr.top}px`; tip.hidden = false; };
      b.addEventListener("mouseenter", show); b.addEventListener("focus", show);
      b.addEventListener("mouseleave", () => (tip.hidden = true)); b.addEventListener("blur", () => (tip.hidden = true));
    });
  }

  window.GH.ui = {
    esc, html, raw, icon, fmt, toDate, toNaiveUtc, startOfToday, plate, barrier, gateState, entryMethod, direction, badge,
    toast, errorMessage, drawer, confirm, loading, empty, errorState, forbiddenState, table, field, input, select,
    formValues, showErrors, busy, qrPreview, hourlyChart, gateBars,
  };
})();
