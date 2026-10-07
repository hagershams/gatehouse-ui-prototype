/* Vehicles (/cars — BD-12 pending; /plate_numbers not used by this UI). */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead } = window.GH.common;

  window.GH.pages.vehicles = async function (page) {
    page.innerHTML = String(html`
      ${pageHead({
        title: "Vehicles",
        sub: "Registered plates, their owners and whether they're on site.",
        actions: auth.can("vehicles.manage") ? html`<button class="btn primary" data-add>${icon("plus")}Register vehicle</button>` : "",
      })}
      <section class="panel">
        <div class="toolbar">
          <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search plate, make or owner" aria-label="Search vehicles" data-q></div>
          <div class="seg" role="group" aria-label="Location" data-loc>${[["", "All"], ["in", "On site"], ["out", "Away"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === ""}">${l}</button>`)}</div>
          <span class="spacer"></span><span class="small muted" data-count></span>
        </div>
        <div data-table>${ui.loading(8)}</div>
      </section>`);
    let rows = [], residents = [], t = null;
    const f = { q: "", loc: "" };
    const owner = (c) => residents.find((r) => r.id === c.owner_id);
    const filtered = () => rows.filter((c) => (!f.loc || (f.loc === "in") === !!c.is_inside) &&
      (!f.q || `${c.plate_number_full} ${c.brand} ${c.model} ${c.color} ${(owner(c) || {}).full_name || ""}`.toLowerCase().includes(f.q)));

    async function load() {
      try {
        const [cars, res] = await Promise.all([api.listCars(), api.listResidents({ limit: 1000 })]);
        rows = cars; residents = res.data;
        page.querySelector("[data-count]").textContent = `${rows.filter((c) => c.is_inside).length} of ${rows.length} on site`;
        if (t) return t.setRows(filtered());
        t = ui.table(page.querySelector("[data-table]"), {
          rows: filtered(), pageSize: 15, rowLabel: "vehicle", onRow: auth.can("vehicles.manage") ? (c) => carForm(c, residents, load) : null,
          emptyTitle: "No vehicles found", emptyText: "Try another search, or register a vehicle.", initialSort: { key: "last", dir: "desc" },
          columns: [
            { key: "plate_number_full", label: "Plate", render: (c) => ui.plate(c.plate_number_full) },
            { key: "brand", label: "Vehicle", render: (c) => html`<div class="cell-title" style="font-weight:500">${[c.brand, c.model].filter(Boolean).join(" ") || "—"}</div><div class="cell-sub">${c.color || ""}</div>` },
            { key: "owner", label: "Owner", sort: (c) => (owner(c) || {}).full_name || "~", render: (c) => {
              const o = owner(c);
              if (o) return html`<div>${o.full_name}</div><div class="cell-sub">${o.unit.name}</div>`;
              return window.GH.seed && window.GH.seed.staffVehicles[c.plate_number_full] ? html`<span class="badge info">${icon("shield")}Staff vehicle</span>` : html`<span class="muted">No owner</span>`;
            } },
            { key: "is_inside", label: "Location", render: (c) => (c.is_inside ? ui.badge("On site", "info", "home") : ui.badge("Away")) },
            { key: "last", label: "Last movement", sort: (c) => [c.last_entry_at, c.last_exit_at].filter(Boolean).sort().pop() || "",
              render: (c) => { const last = [c.last_entry_at, c.last_exit_at].filter(Boolean).sort().pop(); return html`<span class="small nowrap">${last ? fmt.rel(last) : "Never seen"}</span>`; } },
          ],
        });
      } catch (err) { page.querySelector("[data-table]").innerHTML = String(ui.errorState(err)); page.querySelector("[data-retry]").onclick = load; }
    }
    page.querySelector("[data-q]").oninput = (e) => { f.q = e.target.value.trim().toLowerCase(); t && t.setRows(filtered()); };
    page.querySelectorAll("[data-loc] button").forEach((b) => (b.onclick = () => { f.loc = b.dataset.v; page.querySelectorAll("[data-loc] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); t && t.setRows(filtered()); }));
    const add = page.querySelector("[data-add]");
    if (add) add.onclick = () => carForm(null, residents, load);
    await load();
  };

  function carForm(c, residents, done) {
    const d = ui.drawer({
      title: c ? "Edit vehicle" : "Register vehicle",
      subtitle: c ? c.plate_number_full : "Plates must be unique.",
      body: html`<form class="form" id="car-form" novalidate>
        ${ui.field("plate_number_full", "Plate number", ui.input("plate_number_full", c && c.plate_number_full, 'required dir="auto" placeholder="e.g. س ع د 4821" style="font-family:var(--font-arabic);font-size:16px"'), { required: true, hint: "Arabic letters and digits as on the plate." })}
        <div class="form-row">
          ${ui.field("brand", "Make", ui.input("brand", c && c.brand, 'placeholder="Toyota"'))}
          ${ui.field("model", "Model", ui.input("model", c && c.model, 'placeholder="Corolla"'))}
        </div>
        <div class="form-row">
          ${ui.field("color", "Colour", ui.input("color", c && c.color, 'placeholder="White"'))}
          ${ui.field("plate_country", "Country", ui.input("plate_country", c ? c.plate_country : "Egypt"))}
        </div>
        ${ui.field("owner_id", "Owner", ui.select("owner_id", [["", "No owner"], ...residents.slice().sort((a, b) => a.full_name.localeCompare(b.full_name)).map((r) => [r.id, `${r.full_name} · ${r.unit.name}`])], c ? c.owner_id || "" : ""), { hint: "The resident who owns the vehicle." })}
      </form>`,
      footer: html`${c ? html`<button class="btn danger" data-del>${icon("trash")}Delete</button><span class="spacer"></span>` : ""}<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="car-form">${c ? "Save changes" : "Register vehicle"}</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      if (!v.plate_number_full) return ui.showErrors(form, { plate_number_full: "Enter the plate number." });
      const payload = { ...v, owner_id: v.owner_id ? Number(v.owner_id) : null };
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => (c ? api.updateCar(c.id, payload) : api.createCar(payload)));
        ui.toast(c ? "Vehicle updated." : "Vehicle registered.");
        d.close(); done();
      } catch (err) {
        ui.showErrors(form, err.status === 400 && /plate/i.test(err.detail) ? { plate_number_full: err.detail } : err.fieldErrors, err.status === 400 || err.status === 422 ? null : ui.errorMessage(err));
      }
    };
    const del = d.el.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      if (!(await ui.confirm({ title: "Delete this vehicle?", message: `${c.plate_number_full} will no longer be recognised at the gates. Movement history is kept.`, confirmLabel: "Delete vehicle", tone: "danger", icon: "trash" }))) return;
      try { await api.deleteCar(c.id); ui.toast("Vehicle deleted."); d.close(); done(); } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
    };
  }
})();
