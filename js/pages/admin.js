/* Administration: cameras, staff users, units & departments. */
(function () {
  "use strict";
  const { api, auth, ui } = window.GH;
  const { html, icon, fmt } = ui;
  const { pageHead } = window.GH.common;

  // =================================================================== cameras
  window.GH.pages.cameras = async function (page) {
    page.innerHTML = String(html`
      ${pageHead({
        title: "Cameras",
        sub: "Plate cameras, driver cameras and QR readers, and the gate each one serves.",
        actions: auth.can("cameras.manage") ? html`<button class="btn primary" data-add>${icon("plus")}Add camera</button>` : "",
      })}
      <section class="panel"><div class="toolbar">
        <div class="seg" role="group" aria-label="Health" data-h>${[["", "All"], ["on", "Online"], ["off", "Offline"], ["free", "Unassigned"]].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${v === ""}">${l}</button>`)}</div>
        <span class="spacer"></span><span class="small muted">Health is checked automatically every 30 s.</span>
      </div><div data-table>${ui.loading(8)}</div></section>`);
    let rows = [], gates = [], t = null, f = "";
    const gateName = (id) => (gates.find((g) => g.id === id) || {}).name;
    const filtered = () => rows.filter((c) => !f || (f === "on" && c.is_active) || (f === "off" && !c.is_active) || (f === "free" && !c.gate_id));
    async function load() {
      try {
        const [cams, g] = await Promise.all([api.listCameras(), api.listGates()]);
        rows = cams.data; gates = g;
        if (t) return t.setRows(filtered());
        t = ui.table(page.querySelector("[data-table]"), {
          rows: filtered(), pageSize: 15, rowLabel: "camera", onRow: auth.can("cameras.manage") ? (c) => cameraForm(c, gates, rows, load) : null,
          emptyTitle: "No cameras", emptyText: "Add cameras and assign them to gates to enable plate and QR recognition.", initialSort: { key: "gate_id", dir: "asc" },
          columns: [
            { key: "location", label: "Camera", render: (c) => html`<div class="cell-title" style="font-weight:500">${c.location || "Camera"}</div><div class="cell-sub mono">${c.serial_number || "No serial"}</div>` },
            { key: "camera_type", label: "Role", render: (c) => html`<div>${c.camera_type === "LPR" ? "Plate recognition" : "Driver"}</div><div class="cell-sub">${c.reader_type === "QRREADER" ? "QR reader device" : "Video camera"}</div>` },
            { key: "gate_id", label: "Gate", sort: (c) => gateName(c.gate_id) || "~", render: (c) => (c.gate_id ? html`<a href="#/gates/${c.gate_id}">${gateName(c.gate_id)}</a>` : ui.badge("Unassigned", "warn")) },
            { key: "ip_address", label: "Address", render: (c) => html`<span class="mono small">${c.ip_address}:${c.port}</span>` },
            { key: "is_active", label: "Health", render: (c) => (c.is_active ? ui.badge(c.latency ? `Online · ${c.latency} ms` : "Online", "ok", "wifi") : ui.badge("Offline", "bad", "wifiOff")) },
          ],
        });
      } catch (err) { page.querySelector("[data-table]").innerHTML = String(ui.errorState(err)); page.querySelector("[data-retry]").onclick = load; }
    }
    page.querySelectorAll("[data-h] button").forEach((b) => (b.onclick = () => { f = b.dataset.v; page.querySelectorAll("[data-h] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); t && t.setRows(filtered()); }));
    const add = page.querySelector("[data-add]");
    if (add) add.onclick = () => cameraForm(null, gates, rows, load);
    await load();
  };

  function cameraForm(c, gates, cams, done) {
    const d = ui.drawer({
      title: c ? "Edit camera" : "Add camera",
      subtitle: "Each gate can have one plate camera and one driver camera.",
      body: html`<form class="form" id="cam-form" novalidate>
        <div class="form-row">
          ${ui.field("camera_type", "Role", ui.select("camera_type", [["LPR", "Plate recognition (LPR)"], ["DRIVER", "Driver / QR"]], c ? c.camera_type : "LPR"), { required: true })}
          ${ui.field("reader_type", "Device", ui.select("reader_type", [["CAMERA", "Video camera"], ["QRREADER", "QR reader"]], c ? c.reader_type : "CAMERA"), { required: true, hint: "Plate cameras must be video cameras." })}
        </div>
        ${ui.field("gate_id", "Gate", ui.select("gate_id", [["", "Not assigned"], ...gates.map((g) => {
          const used = cams.filter((x) => x.gate_id === g.id && (!c || x.id !== c.id)).map((x) => x.camera_type);
          return [g.id, `${g.name}${used.length ? ` (has ${used.join(" + ")})` : ""}`];
        })], c ? c.gate_id || "" : ""))}
        <div class="form-row">
          ${ui.field("ip_address", "IP address", ui.input("ip_address", c && c.ip_address, 'required spellcheck="false" placeholder="10.20.1.11"'), { required: true })}
          ${ui.field("port", "Port", ui.input("port", c ? c.port : 554, 'required inputmode="numeric"'), { required: true })}
        </div>
        <div class="form-row">
          ${ui.field("location", "Label", ui.input("location", c && c.location, 'placeholder="e.g. Plate camera"'))}
          ${ui.field("serial_number", "Serial number", ui.input("serial_number", c && c.serial_number, 'spellcheck="false"'))}
        </div>
        <h3 class="form-section">Stream credentials</h3>
        <div class="form-row">
          ${ui.field("username", "Username", ui.input("username", "", 'autocomplete="off"'))}
          ${ui.field("password", "Password", ui.input("password", "", 'type="password" autocomplete="new-password"'))}
        </div>
        <p class="hint small muted" style="margin-top:-8px">${c ? "Credentials are never shown. Leave blank to keep the current ones." : "Stored securely and never shown again."}</p>
      </form>`,
      footer: html`${c ? html`<button class="btn danger" data-del>${icon("trash")}Delete</button><span class="spacer"></span>` : ""}<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="cam-form">${c ? "Save changes" : "Add camera"}</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (!v.ip_address) errs.ip_address = "Enter the camera's IP address.";
      if (!/^\d+$/.test(v.port || "")) errs.port = "Enter a port number.";
      if (v.camera_type === "LPR" && v.reader_type !== "CAMERA") errs.reader_type = "Plate recognition needs a video camera.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      const payload = { ...v, port: Number(v.port), gate_id: v.gate_id ? Number(v.gate_id) : null };
      if (!payload.username) delete payload.username;
      if (!payload.password) delete payload.password;
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => (c ? api.updateCamera(c.id, payload) : api.createCamera(payload)));
        ui.toast(c ? "Camera updated." : "Camera added. Health appears after the next check.");
        d.close(); done();
      } catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
    const del = d.el.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      if (!(await ui.confirm({ title: "Delete this camera?", message: "Its gate will lose automatic recognition for this role until a replacement is added.", confirmLabel: "Delete camera", tone: "danger", icon: "trash" }))) return;
      try { await api.deleteCamera(c.id); ui.toast("Camera deleted."); d.close(); done(); } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
    };
  }

  // =================================================================== users
  // Roles are not states: neutral styling (status colours stay reserved for status).
  const ROLE_TONE = { superAdmin: "outline", admin: "outline", manager: "", security: "" };
  const STATUS = { active: ["Active", "ok", "check"], blocked: ["Blocked", "bad", "lock"], suspended: ["Suspended", "warn", "clock"] };
  const nameOf = (u) => (window.GH.seed && window.GH.seed.displayName[u.username]) || u.username;

  window.GH.pages.users = async function (page) {
    const me = auth.session();
    page.innerHTML = String(html`
      ${pageHead({
        title: "Staff users",
        sub: "People who operate the system and what their role lets them do.",
        actions: auth.can("users.create") ? html`<button class="btn primary" data-add>${icon("plus")}Add staff user</button>` : "",
      })}
      <section class="panel"><div class="toolbar">
        <div class="search">${icon("search")}<input class="input" type="search" placeholder="Search name or email" aria-label="Search users" data-q></div>
        <select class="select" aria-label="Role" data-role><option value="">All roles</option>${Object.entries(auth.ROLE_LABEL).filter(([k]) => k !== "resident").map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
        <select class="select" aria-label="Status" data-status><option value="">Any status</option><option value="active">Active</option><option value="blocked">Blocked</option><option value="suspended">Suspended</option></select>
      </div><div data-table>${ui.loading(8)}</div></section>`);
    let rows = [], subs = [], t = null;
    const f = { q: "", role: "", status: "" };
    const filtered = () => rows.filter((u) => (!f.role || u.role === f.role) && (!f.status || u.status === f.status) && (!f.q || `${nameOf(u)} ${u.username} ${u.email}`.toLowerCase().includes(f.q)));
    async function load() {
      try {
        [rows, subs] = await Promise.all([api.listUsers(), api.listSubDepartments()]);
        if (t) return t.setRows(filtered());
        t = ui.table(page.querySelector("[data-table]"), {
          rows: filtered(), pageSize: 15, rowLabel: "user", initialSort: { key: "name", dir: "asc" },
          emptyTitle: "No users match", emptyText: "Change the filters.",
          columns: [
            { key: "name", label: "User", sort: nameOf, render: (u) => html`<div class="row"><span class="avatar" style="width:30px;height:30px;font-size:12px">${fmt.initials(nameOf(u))}</span><div><div class="cell-title">${nameOf(u)}${u.id === me.userId ? html` <span class="muted small">(you)</span>` : ""}</div><div class="cell-sub">${u.email}</div></div></div>` },
            { key: "role", label: "Role", render: (u) => ui.badge(auth.ROLE_LABEL[u.role], ROLE_TONE[u.role]) },
            { key: "team", label: "Team", sort: (u) => (u.sub_department || {}).name || "~", render: (u) => (u.sub_department ? u.sub_department.name : html`<span class="muted">—</span>`) },
            { key: "status", label: "Status", render: (u) => ui.badge(...STATUS[u.status]) },
            { key: "last_login_at", label: "Last sign-in", render: (u) => html`<span class="small nowrap">${u.last_login_at ? fmt.rel(u.last_login_at) : "Never"}</span>` },
            { key: "_actions", label: "", sortable: false, render: (u) => actions(u) },
          ],
        });
        bindRowActions();
      } catch (err) { page.querySelector("[data-table]").innerHTML = String(ui.errorState(err)); page.querySelector("[data-retry]").onclick = load; }
    }
    function canTouch(u) { return u.id !== me.userId && (u.role !== "superAdmin" || me.role === "superAdmin"); }
    function actions(u) {
      if (!canTouch(u)) return "";
      return html`<div class="row" style="justify-content:flex-end;gap:4px">
        ${auth.can("users.update") ? html`<button class="btn sm ghost" data-edit="${u.id}" aria-label="Edit ${nameOf(u)}">${icon("edit")}</button>
          ${u.status === "active" ? html`<button class="btn sm ghost" data-block="${u.id}" aria-label="Block ${nameOf(u)}" title="Block">${icon("userX")}</button>` : html`<button class="btn sm ghost" data-unblock="${u.id}" aria-label="Unblock ${nameOf(u)}" title="Unblock">${icon("userCheck")}</button>`}` : ""}
        ${auth.can("users.delete") ? html`<button class="btn sm ghost" data-del="${u.id}" aria-label="Delete ${nameOf(u)}" title="Delete">${icon("trash")}</button>` : ""}
      </div>`;
    }
    function bindRowActions() {
      const host = page.querySelector("[data-table]");
      host.onclick = async (e) => {
        const b = e.target.closest("button[data-edit],button[data-block],button[data-unblock],button[data-del]");
        if (!b) return;
        const u = rows.find((x) => x.id === Number(b.dataset.edit || b.dataset.block || b.dataset.unblock || b.dataset.del));
        if (b.dataset.edit) return userForm(u, subs, load);
        try {
          if (b.dataset.block) {
            if (!(await ui.confirm({ title: `Block ${nameOf(u)}?`, message: "They're signed out everywhere immediately and can't sign in until unblocked.", confirmLabel: "Block user", tone: "danger", icon: "lock" }))) return;
            await api.blockUser(u.id); ui.toast(`${nameOf(u)} blocked.`);
          } else if (b.dataset.unblock) {
            await api.unblockUser(u.id); ui.toast(`${nameOf(u)} can sign in again.`);
          } else if (b.dataset.del) {
            if (!(await ui.confirm({ title: `Delete ${nameOf(u)}?`, message: "The account is deactivated and removed from this list. Their past actions stay in the audit log.", confirmLabel: "Delete user", tone: "danger", icon: "trash" }))) return;
            await api.deleteUser(u.id); ui.toast(`${nameOf(u)} deleted.`);
          }
          load();
        } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      };
    }
    page.querySelector("[data-q]").oninput = (e) => { f.q = e.target.value.trim().toLowerCase(); t && t.setRows(filtered()); };
    page.querySelector("[data-role]").onchange = (e) => { f.role = e.target.value; t && t.setRows(filtered()); };
    page.querySelector("[data-status]").onchange = (e) => { f.status = e.target.value; t && t.setRows(filtered()); };
    const add = page.querySelector("[data-add]");
    if (add) add.onclick = () => userForm(null, subs, load);
    await load();
  };

  function userForm(u, subs, done) {
    const me = auth.session();
    const roles = Object.entries(auth.ROLE_LABEL).filter(([k]) => k !== "resident" && (k !== "superAdmin" || me.role === "superAdmin"));
    const ROLE_HELP = {
      superAdmin: "Full control, including other administrators.", admin: "Manages gates, cameras, residents, vehicles and staff.",
      manager: "Manages residents, vehicles, units and visitor passes.", security: "Operates gates, logs movements and issues visitor passes.",
    };
    const d = ui.drawer({
      title: u ? `Edit ${nameOf(u)}` : "Add staff user",
      body: html`<form class="form" id="user-form" novalidate>
        <div class="form-row">
          ${ui.field("username", "Username", ui.input("username", u && u.username, 'required autocomplete="off" spellcheck="false"'), { required: true })}
          ${ui.field("email", "Email", ui.input("email", u && u.email, 'type="email" required autocomplete="off"'), { required: true })}
        </div>
        ${u ? "" : ui.field("password", "Temporary password", ui.input("password", "", 'type="password" autocomplete="new-password" required'), { required: true, hint: "At least 8 characters. They can change it after signing in." })}
        ${ui.field("role", "Role", ui.select("role", roles, u ? u.role : "security"), { required: true, hint: ROLE_HELP[u ? u.role : "security"] })}
        ${ui.field("sub_department_id", "Team", ui.select("sub_department_id", [["", "No team"], ...subs.map((s) => [s.id, s.name])], u ? u.sub_department_id || "" : ""))}
        ${ui.field("phone", "Phone", ui.input("phone", u ? (u.phone_numbers || [])[0] : "", 'inputmode="tel" placeholder="01012345678"'))}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="user-form">${u ? "Save changes" : "Add user"}</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.role.onchange = () => (form.querySelector('[data-field="role"] .hint').textContent = ROLE_HELP[form.role.value]);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (!v.username) errs.username = "Enter a username.";
      if (!/^\S+@\S+\.\S+$/.test(v.email || "")) errs.email = "Enter a valid email.";
      if (!u && (v.password || "").length < 8) errs.password = "Use at least 8 characters.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      const payload = { username: v.username, email: v.email, role: v.role, sub_department_id: v.sub_department_id ? Number(v.sub_department_id) : null, phone_numbers: v.phone ? [v.phone] : [] };
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => (u ? api.updateUser(u.id, payload) : api.createUser({ ...payload, password: v.password })));
        ui.toast(u ? "User updated." : `${v.username} added.`);
        d.close(); done();
      } catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }

  // =================================================================== organization
  window.GH.pages.organization = async function (page) {
    let tab = "units";
    const showDepts = auth.can("users.view");
    page.innerHTML = String(html`
      ${pageHead({ title: "Units & departments", sub: "The compound's villas, buildings and apartments, and the staff organisation." })}
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="units" aria-selected="true">Units</button>
        ${showDepts ? html`<button class="tab" role="tab" data-tab="depts" aria-selected="false">Departments</button>` : ""}
      </div><div data-body></div>`);
    const body = page.querySelector("[data-body]");
    page.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; page.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); show(); }));
    function show() { body.innerHTML = String(ui.loading(8)); (tab === "units" ? units() : depts()).catch((err) => { body.innerHTML = String(ui.errorState(err)); body.querySelector("[data-retry]").onclick = show; }); }

    async function units() {
      const all = await api.listUnits();
      const canManage = auth.can("units.manage");
      const villas = all.filter((u) => u.type === "VILLA");
      const buildings = all.filter((u) => u.type === "BUILDING");
      const occupied = all.filter((u) => u.residents.length).length;
      const unitRow = (u, child = false) => html`<tr>
        <td>${child ? html`<span class="tree-indent"></span>` : ""}<span class="${u.type === "BUILDING" ? "cell-title" : ""}">${u.name}</span></td>
        <td class="small ink-2">${{ VILLA: "Villa", BUILDING: "Building", APARTMENT: "Apartment" }[u.type]}</td>
        <td>${u.type === "BUILDING" ? html`<span class="small muted">${all.filter((x) => x.parent_id === u.id).length} apartments</span>` : u.residents.length ? u.residents.map((r) => r.full_name).join(", ") : html`<span class="badge">Vacant</span>`}</td>
        <td class="small muted">${u.description || ""}</td>
        <td class="actions">${canManage && !u.residents.length && !all.some((x) => x.parent_id === u.id) ? html`<button class="btn sm ghost" data-delunit="${u.id}" aria-label="Delete ${u.name}">${icon("trash")}</button>` : ""}</td></tr>`;
      body.innerHTML = String(html`<section class="panel">
        <div class="toolbar"><span class="small ink-2"><b>${all.filter((u) => u.type !== "BUILDING").length}</b> homes · <b>${occupied}</b> occupied · one resident per unit</span><span class="spacer"></span>
          ${canManage ? html`<button class="btn sm primary" data-addunit>${icon("plus")}Add unit</button>` : ""}</div>
        <div class="table-wrap"><table class="data"><thead><tr><th>Unit</th><th>Type</th><th>Resident</th><th>Description</th><th></th></tr></thead><tbody>
          ${buildings.map((b) => html`${unitRow(b)}${all.filter((x) => x.parent_id === b.id).map((a) => unitRow(a, true))}`)}
          ${villas.map((v) => unitRow(v))}
        </tbody></table></div></section>`);
      const add = body.querySelector("[data-addunit]");
      if (add) add.onclick = () => unitForm(buildings, show);
      body.querySelectorAll("[data-delunit]").forEach((b) => (b.onclick = async () => {
        const u = all.find((x) => x.id === Number(b.dataset.delunit));
        if (!(await ui.confirm({ title: `Delete ${u.name}?`, message: "The unit is removed. This can't be undone.", confirmLabel: "Delete unit", tone: "danger", icon: "trash" }))) return;
        try { await api.deleteUnit(u.id); ui.toast(`${u.name} deleted.`); show(); } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      }));
    }

    async function depts() {
      const [ds, subs, users] = await Promise.all([api.listDepartments(), api.listSubDepartments(), api.listUsers()]);
      const canManage = auth.can("organization.manage");
      body.innerHTML = String(html`
        ${canManage ? html`<div class="row" style="margin-bottom:var(--s-4)"><span class="spacer"></span><button class="btn" data-addsub>${icon("plus")}Add team</button><button class="btn primary" data-adddept>${icon("plus")}Add department</button></div>` : ""}
        <div class="grid two">${ds.map((d) => {
          const teams = subs.filter((s) => s.department_id === d.id);
          return html`<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${d.name}</h2><div class="small muted">${d.description || ""}</div></div><span class="spacer"></span>
            ${canManage ? html`<button class="btn sm ghost" data-deldept="${d.id}" aria-label="Delete ${d.name}" ${teams.length ? ui.raw('disabled title="Remove its teams first"') : ""}>${icon("trash")}</button>` : ""}</div>
            ${teams.length ? html`<ul class="gate-list">${teams.map((s) => { const n = users.filter((u) => u.sub_department_id === s.id).length; return html`<li><div><div style="font-weight:500">${s.name}</div><div class="cell-sub">${n} staff</div></div>
              ${canManage ? html`<button class="btn sm ghost" data-delsub="${s.id}" aria-label="Delete ${s.name}" ${n ? ui.raw('disabled title="Move its staff first"') : ""}>${icon("trash")}</button>` : ""}</li>`; })}</ul>` : html`<div class="empty-inline">No teams yet.</div>`}
          </section>`;
        })}</div>`);
      const q = (s) => body.querySelector(s);
      if (q("[data-adddept]")) q("[data-adddept]").onclick = () => simpleForm("Add department", [["name", "Name", true], ["description", "Description"]], (v) => api.createDepartment(v), show);
      if (q("[data-addsub]")) q("[data-addsub]").onclick = () => simpleForm("Add team", [["name", "Name", true], ["description", "Description"]], (v) => api.createSubDepartment({ ...v, department_id: Number(v.department_id) }), show, ds);
      body.querySelectorAll("[data-deldept],[data-delsub]").forEach((b) => (b.onclick = async () => {
        const isDept = !!b.dataset.deldept;
        if (!(await ui.confirm({ title: `Delete this ${isDept ? "department" : "team"}?`, message: "This can't be undone.", confirmLabel: "Delete", tone: "danger", icon: "trash" }))) return;
        try { await (isDept ? api.deleteDepartment(Number(b.dataset.deldept)) : api.deleteSubDepartment(Number(b.dataset.delsub))); ui.toast("Deleted."); show(); } catch (err) { ui.toast(ui.errorMessage(err), "bad"); }
      }));
    }
    show();
  };

  function unitForm(buildings, done) {
    const d = ui.drawer({
      title: "Add unit",
      subtitle: "Villas and buildings stand alone; apartments belong to a building.",
      body: html`<form class="form" id="unit-form" novalidate>
        ${ui.field("type", "Type", ui.select("type", [["VILLA", "Villa"], ["BUILDING", "Building"], ["APARTMENT", "Apartment"]], "VILLA"), { required: true })}
        ${ui.field("parent_id", "Building", ui.select("parent_id", [["", "Select a building"], ...buildings.map((b) => [b.id, b.name])], ""), { hint: "Only for apartments." })}
        ${ui.field("name", "Name", ui.input("name", "", 'required placeholder="e.g. Villa 19 or B-402"'), { required: true })}
        ${ui.field("description", "Description", ui.input("description", ""))}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="unit-form">Add unit</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    const sync = () => (form.querySelector('[data-field="parent_id"]').hidden = form.type.value !== "APARTMENT");
    form.type.onchange = sync; sync();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      const errs = {};
      if (!v.name) errs.name = "Enter a name.";
      if (v.type === "APARTMENT" && !v.parent_id) errs.parent_id = "Choose the building.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      try {
        await ui.busy(d.el.querySelector("[type=submit]"), () => api.createUnit({ name: v.name, type: v.type, description: v.description || null, parent_id: v.type === "APARTMENT" ? Number(v.parent_id) : null }));
        ui.toast(`${v.name} added.`); d.close(); done();
      } catch (err) { ui.showErrors(form, err.status === 409 ? { name: err.detail } : err.fieldErrors, err.status === 409 || err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }

  function simpleForm(title, fields, submit, done, departments) {
    const d = ui.drawer({
      title,
      body: html`<form class="form" id="simple-form" novalidate>
        ${departments ? ui.field("department_id", "Department", ui.select("department_id", departments.map((x) => [x.id, x.name]), departments[0] && departments[0].id), { required: true }) : ""}
        ${fields.map(([n, l, req]) => ui.field(n, l, ui.input(n, "", req ? "required" : ""), { required: req }))}
      </form>`,
      footer: html`<button class="btn" data-cancel>Cancel</button><button class="btn primary" type="submit" form="simple-form">Save</button>`,
    });
    d.el.querySelector("[data-cancel]").onclick = d.close;
    const form = d.el.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      if (!v.name) return ui.showErrors(form, { name: "Enter a name." });
      try { await ui.busy(d.el.querySelector("[type=submit]"), () => submit(v)); ui.toast("Saved."); d.close(); done(); }
      catch (err) { ui.showErrors(form, err.fieldErrors, err.status === 422 ? null : ui.errorMessage(err)); }
    };
  }
})();
