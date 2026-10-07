/* Helpers shared by pages: page header and reference lookups. */
(function () {
  "use strict";
  const { api, ui } = window.GH;
  const { html } = ui;
  window.GH.pages = window.GH.pages || {}; // page registry, filled by the page files

  /** Page header with optional breadcrumb and right-aligned actions. */
  function pageHead({ title, sub, actions, crumbs }) {
    return html`<div class="page-head">
      <div style="min-width:0">
        ${crumbs ? html`<div class="breadcrumb">${crumbs.map(([href, label], i) => html`${i ? " / " : ""}<a href="${href}">${label}</a>`)}</div>` : ""}
        <h1 class="page-title">${title}</h1>
        ${sub ? html`<p class="page-sub">${sub}</p>` : ""}
      </div>
      <span class="spacer"></span>
      <div class="row wrap">${actions || ""}</div>
    </div>`;
  }

  /**
   * Reference data for display joins (gate names, plate → owner, resident names).
   * Uses only contract endpoints; each loader is skipped if the role can't read it.
   */
  async function refs(needs = ["gates", "cars", "residents"]) {
    const { auth } = window.GH;
    const out = { gates: [], cars: [], residents: [], gateById: new Map(), carByPlate: new Map(), residentById: new Map() };
    const jobs = [];
    if (needs.includes("gates") && auth.can("gates.view")) jobs.push(api.listGates().then((g) => (out.gates = g)));
    if (needs.includes("cars") && auth.can("vehicles.view")) jobs.push(api.listCars().then((c) => (out.cars = c)));
    if (needs.includes("residents") && auth.can("residents.view")) jobs.push(api.listResidents({ limit: 1000 }).then((r) => (out.residents = r.data)));
    await Promise.all(jobs);
    out.gates.forEach((g) => out.gateById.set(g.id, g));
    out.cars.forEach((c) => out.carByPlate.set(c.plate_number_full, c));
    out.residents.forEach((r) => out.residentById.set(r.id, r));
    out.gateName = (id) => (out.gateById.get(id) || {}).name || (id ? `Gate #${id}` : "—");
    /** Who a movement belongs to: QR host, or the registered owner of the plate. */
    out.person = (entry) => {
      if (entry.resident) return { name: entry.resident.full_name, note: entry.entry_by === "QR" ? "Visitor host" : "Resident" };
      const car = entry.plate_number && out.carByPlate.get(entry.plate_number);
      if (car && car.owner_id) {
        const r = out.residentById.get(car.owner_id);
        if (r) return { name: r.full_name, note: r.unit.name };
      }
      const staffId = window.GH.seed && window.GH.seed.staffVehicles[entry.plate_number];
      if (staffId) return { name: "Staff vehicle", note: "Registered to staff" };
      return entry.plate_number ? { name: "Unregistered plate", note: null, unknown: true } : { name: "—", note: null, unknown: true };
    };
    return out;
  }

  const personCell = (p) => html`<div class="${p.unknown ? "muted" : "cell-title"}" style="${p.unknown ? "" : "font-weight:500"}">${p.name}</div>${p.note ? html`<div class="cell-sub">${p.note}</div>` : ""}`;

  /** Download rows as CSV (client-side export of what's on screen). */
  function downloadCsv(filename, header, rows) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.GH.common = { pageHead, refs, personCell, downloadCsv };
})();
