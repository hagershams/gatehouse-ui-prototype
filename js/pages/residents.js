/* Residents: table + detail drawer + forms.
   Rules from the backend: one resident per unit (409), unit can't change after
   creation, phone numbers are replaced as a set, status allowed/notAllowed. */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead } = window.GH.common;

  const statusBadge = (s) => (s === "allowed" ? ui.badge("Access allowed", "ok", "check") : ui.badge("Access suspended", "bad", "lock"));

  window.GH.pages.residents = async function (page) {
    page.innerHTML = String(html`
      ${pageHead({
        title: "Residents",
        sub: "People who live in the compound, their units, phones and vehicles.",
        actions: auth.can("residents.create") ? html`<button class="btn primary" data-add>${icon("plus")}Add resident</button>` : "",
      })}
      <section class="panel">
        <div class="toolbar">
          <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search name, unit or phone" aria-label="Search residents" data-q></div>
          <div class="seg" role="group" aria-label="Access" data-status>${[["", "All"], ["allowed", "Allowed"], ["notAllowed", "Suspended"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === ""}">${l}</button>`)}</div>
        </div>
        <div data-table>${ui.loading(8)}</div>
      </section>`);

    let rows = [], units = [], t = null;
    const f = { q: "", status: "" };
    const filtered = () => rows.filter((r) => (!f.status || r.status === f.status) &&
      (!f.q || [r.full_name, r.unit.name, ...r.phone_numbers.map((p) => p.phone_number)].join(" ").toLowerCase().includes(f.q)));

    async function load() {
      try {
        const [res, u] = await Promise.all([api.listResidents({ limit: 1000 }), api.listUnits()]);
        rows = res.data; units = u;
        if (t) return t.setRows(filtered());
        t = ui.table(page.querySelector("[data-table]"), {
          rows: filtered(), pageSize: 15, rowLabel: "resident", onRow: (r) => detail(r.id),
          emptyTitle: "No residents found", emptyText: "Try a different search, or add a resident.",
          initialSort: { key: "full_name", dir: "asc" },
          columns: [
            { key: "full_name", label: "Resident", render: (r) => html`<div class="row"><span class="avatar" style="width:30px;height:30px;font-size:12px">${fmt.initials(r.full_name)}</span><div><div class="cell-title">${r.full_name}</div><div class="cell-sub">${r.phone_numbers.map((p) => p.phone_number).join(", ") || "No phone"}</div></div></div>` },
            { key: "unit", label: "Unit", sort: (r) => r.unit.name, render: (r) => html`<div>${r.unit.name}</div><div class="cell-sub">${unitLabel(r.unit)}</div>` },
            { key: "vehicles", label: "Vehicles", sort: (r) => r.plate_numbers.length, render: (r) => (r.plate_numbers.length ? html`<div class="row wrap">${r.plate_numbers.map((p) => ui.plate(p.plate_number_full, "sm"))}</div>` : html`<span class="muted">None</span>`) },
            { key: "status", label: "Access", render: (r) => statusBadge(r.status) },
          ],
        });
      } catch (err) {
        page.querySelector("[data-table]").innerHTML = String(ui.errorState(err));
        page.querySelector("[data-retry]").onclick = load;
      }
    }
    const unitLabel = (u) => (u.type === "APARTMENT" ? `Apartment · ${(units.find((x) => x.id === u.parent_id) || {}).name || "building"}` : u.type === "VILLA" ? "Villa" : u.type);

    page.querySelector("[data-q]").oninput = (e) => { f.q = e.target.value.trim().toLowerCase(); t && t.setRows(filtered()); };
    page.querySelectorAll("[data-status] button").forEach((b) => (b.onclick = () => {
      f.status = b.dataset.v;
      page.querySelectorAll("[data-status] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      t && t.setRows(filtered());
    }));
    const add = page.querySelector("[data-add]");
    if (add) add.onclick = () => residentForm(null, units, rows, load);

    // ---------------- detail drawer ----------------
    async function detail(id) {
      const d = ui.drawer({ title: "Resident", body: ui.loading(6) });
      let r;
      try { r = await api.getResident(id); } catch (err) { d.body.innerHTML = String(ui.errorState(err)); return; }
      const canUpdate = auth.can("residents.update"), canDelete = auth.can("residents.delete");
      d.el.querySelector(".drawer-title").textContent = r.full_name;
      d.body.innerHTML = String(html`
        <div class="row wrap" style="margin-bottom:var(--s-5)">${statusBadge(r.status)}<span class="badge outline">${icon("home")}${r.unit.name}</span></div>
        <dl class="dl">
          <dt>Unit</dt><dd>${r.unit.name} · ${unitLabel(r.unit)}</dd>
          <dt>Phone</dt><dd>${r.phone_numbers.length ? r.phone_numbers.map((p) => html`<div class="mono">${p.phone_number}</div>`) : html`<span class="muted">—</span>`}</dd>
          <dt>National ID</dt><dd class="mono">${r.national_id || html`<span class="muted">Not recorded</span>`}</dd>
          <dt>Notes</dt><dd>${r.notes || html`<span class="muted">—</span>`}</dd>
        </dl>
        <h3 class="form-section" style="margin:var(--s-6) 0 var(--s-3)">Vehicles</h3>
        ${r.plate_numbers.length ? html`<div class="stack">${r.plate_numbers.map((p) => html`<div class="row">${ui.plate(p.plate_number_full)}<span class="spacer"></span>${p.is_inside ? ui.badge("On site", "info") : ui.badge("Away")}</div>`)}</div>`
          : html`<p class="muted small">No vehicles registered.${auth.can("vehicles.manage") ? html` <a href="#/vehicles">Register one</a>` : ""}</p>`}
        <div class="notice" style="margin-top:var(--s-6)">${icon("info")}<div>Resident vehicles are recognised by plate, but entry currently also requires a QR pass (policy BD-1 under review).</div></div>
        ${canUpdate ? html`<h3 class="form-section" style="margin:var(--s-6) 0 var(--s-3)">Access</h3>
          <div class="stack">
            <div class="row"><div style="flex:1"><div style="font-weight:500">${r.status === "allowed" ? "Suspend access" : "Restore access"}</div><div class="small muted">${r.status === "allowed" ? "The resident can no longer sign in to the resident app." : "Lets the resident sign in again."}</div></div>
              <button class="btn ${r.status === "allowed" ? "danger" : ""}" data-sub>${r.status === "allowed" ? "Suspend" : "Restore"}</button></div>
            <div class="row"><div style="flex:1"><div style="font-weight:500">Resident app sign-in</div><div class="small muted">Set the email and password the resident uses to invite visitors.</div></div>
              <button class="btn" data-cred>${icon("key")}Set sign-in</button></div>
          </div>` : ""}`);
      if (d.foot === null && (canUpdate || canDelete)) {
        d.el.insertAdjacentHTML("beforeend", String(html`<div class="drawer-foot">${canDelete ? html`<button class="btn danger" data-del>${icon("trash")}Delete</button>` : ""}<span class="spacer"></span>${canUpdate ? html`<button class="btn primary" data-edit>${icon("edit")}Edit details</button>` : ""}</div>`));
      }
      const q = (s) => d.el.querySelector(s);
      if (q("[data-edit]")) q("[data-edit]").onclick = () => { d.close(); residentForm(r, units, rows, load); };
      if (q("[data-sub]")) q("[data-sub]").onclick = async () => {
        const suspend = r.status === "allowed";
        if (suspend && !(await ui.confirm({ title: `Suspend ${r.full_name}?`, message: "They won't be able to sign in to the resident app or create visitor passes until access is restored.", confirmLabel: "Suspend access", tone: "danger", icon: "lock" }))) return;
        try { await api.setResidentSubscription(r.id, !suspend); ui.toast(suspend ? "Access suspended." : "Access restored."); d.close(); load(); detail(r.id); }
        catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      };
      if (q("[data-cred]")) q("[data-cred]").onclick = () => { d.close(); credentialsForm(r); };
      if (q("[data-del]")) q("[data-del]").onclick = async () => {
        if (!(await ui.confirm({ title: `Delete ${r.full_name}?`, message: `This removes the resident and frees ${r.unit.name}. Vehicles that belong only to them are removed too. This can't be undone.`, confirmLabel: "Delete resident", tone: "danger", icon: "trash" }))) return;
        try { await api.deleteResident(r.id); ui.toast(`${r.full_name} deleted.`); d.close(); load(); }
        catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      };
    }

    await load();
  };

  // ---------------- forms ----------------
  function residentForm(r, units, residents, done) {
    const taken = new Set(residents.map((x) => x.unit_id));
    const free = units.filter((u) => u.type !== "BUILDING" && u.is_active && !taken.has(u.id));
    const parentName = (u) => (units.find((x) => x.id === u.parent_id) || {}).name;
    const unitOpts = [["", "Select a free unit"], ...free.map((u) => [u.id, u.type === "APARTMENT" ? `${u.name} · ${parentName(u)}` : u.name])];
    const phones = r ? r.phone_numbers.map((p) => p.phone_number) : [""];
    const d = ui.drawer({
      title: r ? `Edit ${r.full_name}` : "Add resident",
      subtitle: r ? null : "Each villa or apartment can have one registered resident.",
      body: html`<form class="form" id="res-form" novalidate>
        ${ui.field("full_name", "Full name", ui.input("full_name", r && r.full_name, 'required autocomplete="off"'), { required: true })}
        ${r ? html`<div class="field"><label>Unit</label><div class="input" style="display:flex;align-items:center;background:var(--surface-sunken)">${r.unit.name}</div><div class="hint">The unit can't be changed. To move a resident, delete and add them again.</div></div>`
          : ui.field("unit_id", "Unit", ui.select("unit_id", unitOpts, ""), { required: true, hint: `${free.length} free units. Buildings can't be assigned directly — choose an apartment.` })}
        <div class="field" data-field="phone_numbers"><label>Phone numbers</label><div class="stack" data-phones style="gap:8px">${phones.map((p) => phoneRow(p))}</div>
          <button type="button" class="btn sm ghost" data-addphone style="margin-top:6px;align-self:flex-start">${icon("plus")}Add another number</button></div>
        <div class="form-row">
          ${ui.field("national_id", "National ID", ui.input("national_id", r && r.national_id, 'inputmode="numeric" placeholder="14 digits"'), { hint: "Optional." })}
          ${ui.field("status", "Access", ui.select("status", [["allowed", "Allowed"], ["notAllowed", "Suspended"]], r ? r.status : "allowed"))}
        </div>
        ${ui.field("notes", "Notes", html`<textarea class="input" id="f-notes" name="notes">${r ? r.notes || "" : ""}</textarea>`)}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="res-form">${r ? "Save changes" : "Add resident"}</button>`,
    });
    const form = d.el.querySelector("form");
    d.el.querySelector("[data-cancel]").onclick = d.close;
    d.el.querySelector("[data-addphone]").onclick = () => { d.el.querySelector("[data-phones]").insertAdjacentHTML("beforeend", String(phoneRow(""))); bindPhones(); d.el.querySelector("[data-phones] .row:last-child input").focus(); };
    function bindPhones() { d.el.querySelectorAll("[data-rmphone]").forEach((b) => (b.onclick = () => b.closest(".row").remove())); }
    bindPhones();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const phoneList = [...form.querySelectorAll("[name=phone]")].map((i) => i.value.trim()).filter(Boolean);
      const errs = {};
      if (!v.full_name) errs.full_name = "Enter the resident's name.";
      if (!r && !v.unit_id) errs.unit_id = "Choose the unit they live in.";
      if (v.national_id && !/^\d{14}$/.test(v.national_id)) errs.national_id = "National IDs are 14 digits.";
      if (phoneList.some((p) => !/^\+?\d{8,15}$/.test(p))) errs.phone_numbers = "Use digits only, e.g. 01012345678.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      const payload = { full_name: v.full_name, phone_numbers: phoneList, status: v.status, notes: v.notes || null, national_id: v.national_id ? Number(v.national_id) : null };
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => (r ? api.updateResident(r.id, payload) : api.createResident({ ...payload, unit_id: Number(v.unit_id) })));
        ui.toast(r ? "Resident updated." : `${v.full_name} added.`);
        d.close();
        done();
      } catch (err) {
        const map = err.status === 409 ? { unit_id: err.detail } : err.fieldErrors;
        ui.showErrors(form, map, err.status === 422 || err.status === 409 ? null : ui.errorMessage(err));
      }
    };
  }
  const phoneRow = (p) => html`<div class="row"><input class="input" name="phone" value="${p}" inputmode="tel" placeholder="01012345678" aria-label="Phone number"><button type="button" class="btn ghost icon-only" data-rmphone aria-label="Remove number">${icon("x")}</button></div>`;

  function credentialsForm(r) {
    const d = ui.drawer({
      title: "Resident app sign-in",
      subtitle: `${r.full_name} · ${r.unit.name}`,
      body: html`<form class="form" id="cred-form" novalidate>
        ${ui.field("email", "Email", ui.input("email", "", 'type="email" autocomplete="off" required'), { required: true })}
        ${ui.field("password", "Temporary password", ui.input("password", "", 'type="password" autocomplete="new-password" required'), { required: true, hint: "At least 8 characters. Share it securely; the resident can change it after signing in." })}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="cred-form">Save sign-in</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (!/^\S+@\S+\.\S+$/.test(v.email || "")) errs.email = "Enter a valid email.";
      if ((v.password || "").length < 8) errs.password = "Use at least 8 characters.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      try { await ui.busy(d.el.querySelector("[type=submit]"), () => api.setResidentCredentials(r.id, v.email, v.password)); ui.toast("Sign-in saved."); d.close(); }
      catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }
})();
