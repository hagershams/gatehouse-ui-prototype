/* API layer. One function per endpoint of docs/architecture/ui-api-contract.md.
   Two adapters share the same function names:
     - mock (default): in-memory, enforces the intended RBAC with 403s, simulates realtime events.
     - live (?mode=live): fetch() against /api on the same origin (served by a proxy).
   Pages only ever call GH.api.<fn>(), so switching adapters needs no page changes. */
(function () {
  "use strict";
  const { auth } = window.GH;

  class ApiError extends Error {
    constructor(status, detail) {
      super(typeof detail === "string" ? detail : `Request failed (${status})`);
      this.status = status;
      this.detail = detail;
    }
    /** 422 → { field: message } using the last element of `loc`. */
    get fieldErrors() {
      if (this.status !== 422 || !Array.isArray(this.detail)) return {};
      const out = {};
      for (const d of this.detail) out[String(d.loc[d.loc.length - 1])] = d.msg;
      return out;
    }
  }

  const realtimeHandlers = new Set();
  const emit = (event) => realtimeHandlers.forEach((fn) => { try { fn(event); } catch (e) { console.error(e); } });

  // =====================================================================
  // MOCK ADAPTER
  // =====================================================================
  function createMock() {
    const S = window.GH.seed;
    const db = {
      users: S.users, departments: S.departments, subDepartments: S.subDepartments, units: S.units, residents: S.residents,
      cars: S.cars, gates: S.gates, cameras: S.cameras, gateEntries: S.gateEntries, qrCodes: S.qrCodes,
      visitorLogs: S.visitorLogs, identityVisitors: S.identityVisitors, logs: S.auditLogs,
    };
    const PASSWORD = "demo1234";
    const nextId = (xs) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const now = () => S.iso(new Date());
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const delay = () => wait(140 + Math.random() * 260);

    function fakeToken(payload) {
      const enc = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
      return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.mock`;
    }
    function current() {
      const s = auth.session();
      if (!s) throw new ApiError(401, "Not authenticated");
      return s;
    }
    function need(permission) {
      const s = current();
      if (s.type !== "admin" || !(auth.ROLE_PERMISSIONS[s.role] || []).includes(permission)) {
        throw new ApiError(403, "You don't have permission to perform this action");
      }
      return s;
    }
    function find(list, id, label) {
      const item = list.find((x) => x.id === Number(id));
      if (!item) throw new ApiError(404, `${label} not found`);
      return item;
    }
    function required(body, fields) {
      const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
      if (missing.length) throw new ApiError(422, missing.map((f) => ({ loc: ["body", f], msg: "Field required", type: "missing" })));
    }
    function audit(action_type, entity_name, entity_id, verb) {
      const s = auth.session();
      db.logs.unshift({ id: nextId(db.logs), user_id: s ? s.userId : 0, action_type, entity_name, entity_id, description: `${s ? s.username : "system"} ${verb}`, created_at: now() });
    }
    const gateView = (g) => ({ ...clone(g), cameras: db.cameras.filter((c) => c.gate_id === g.id).map((c) => ({
      id: c.id, location: c.location, ip_address: c.ip_address, port: c.port, latency: c.latency, serial_number: c.serial_number,
      camera_type: c.camera_type, reader_type: c.reader_type, is_active: c.is_active, gate_id: c.gate_id })) });
    const unitView = (u) => ({ ...clone(u), residents: db.residents.filter((r) => r.unit_id === u.id).map((r) => ({ id: r.id, full_name: r.full_name })) });
    const residentView = (r) => {
      const { _email, ...rest } = r;
      return { ...clone(rest), unit: unitView(db.units.find((u) => u.id === r.unit_id)),
        plate_numbers: db.cars.filter((c) => c.owner_id === r.id).map((c) => ({ id: c.id, plate_number_full: c.plate_number_full, is_inside: c.is_inside })) };
    };
    const setGateState = (gate, patch) => {
      const before = { active: gate.active, is_open: gate.is_open };
      Object.assign(gate, patch, { updated_at: now() });
      if (before.active !== gate.active || before.is_open !== gate.is_open) {
        emit({ event: "GATE_STATUS_CHANGED", gate_id: gate.id, data: { active: gate.active, is_open: gate.is_open } });
      }
    };

    const api = {
      mode: "mock",

      // ---------------- auth ----------------
      async staffLogin(email, password) {
        await delay();
        required({ email, password }, ["email", "password"]);
        const u = db.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
        if (!u || password !== PASSWORD) throw new ApiError(401, "Invalid credentials");
        if (u.status !== "active" || u.is_active === false) throw new ApiError(403, "Account is not active");
        u.last_login_at = now();
        return { access_token: fakeToken({ sub: String(u.id), type: "admin", role: u.role }), token_type: "bearer", role: u.role,
          permissions: auth.ROLE_PERMISSIONS[u.role] };
      },
      async residentLogin(email, password) {
        await delay();
        const r = db.residents.find((x) => x._email && x._email === String(email).toLowerCase());
        if (!r || password !== PASSWORD) throw new ApiError(401, "Invalid email or password");
        if (r.status !== "allowed") throw new ApiError(403, "User not allowed");
        return { access_token: fakeToken({ sub: String(r.id), type: "resident" }), token_type: "bearer", user: { id: r.id, full_name: r.full_name, email: r._email } };
      },
      async me() {
        await delay();
        const s = current();
        return { id: s.userId, username: s.type === "admin" ? s.username : null, role: s.role, type: s.type };
      },

      // ---------------- gates ----------------
      async listGates() { await delay(); need("gates.view"); return db.gates.map(gateView); },
      async getGate(id) { await delay(); need("gates.view"); return gateView(find(db.gates, id, "Gate")); },
      async createGate(body) {
        await delay(); need("gates.manage"); required(body, ["name", "type", "ip"]);
        if (db.gates.some((g) => g.ip === body.ip)) throw new ApiError(400, "Gate with this IP already exists");
        if (db.gates.some((g) => g.name === body.name)) throw new ApiError(400, "Gate with this name already exists");
        const g = { id: nextId(db.gates), name: body.name, type: body.type, ip: body.ip, desc: body.desc || null, active: null, is_open: false, lat: null, lng: null,
          entries_today: null, exits_today: null, last_entry: null, last_exit: null, created_at: now(), updated_at: now(), cameras: [] };
        db.gates.push(g);
        return gateView(g);
      },
      async updateGate(id, body) {
        await delay(); need("gates.manage");
        const g = find(db.gates, id, "Gate");
        if (body.ip && db.gates.some((x) => x.ip === body.ip && x.id !== g.id)) throw new ApiError(400, "Gate with this IP already exists");
        ["name", "type", "ip", "desc"].forEach((k) => body[k] !== undefined && (g[k] = body[k]));
        g.updated_at = now();
        return gateView(g);
      },
      async deleteGate(id) {
        await delay(); need("gates.manage");
        const g = find(db.gates, id, "Gate");
        db.cameras.forEach((c) => c.gate_id === g.id && (c.gate_id = null));
        db.gates.splice(db.gates.indexOf(g), 1);
        return { message: "Gate deleted successfully" };
      },
      async pingGate(id) {
        await wait(700 + Math.random() * 600); need("gates.view");
        const g = find(db.gates, id, "Gate");
        const reachable = g.id !== 4; // South Gate · Exit is down in the demo
        setGateState(g, { active: reachable, is_open: reachable ? g.is_open : false });
        return { gate_id: g.id, ip: g.ip, reachable, is_open: g.is_open, latency_ms: reachable ? Math.round(18 + Math.random() * 40) : null, checked_at: now() };
      },
      async openGate(id) { return command(id, true); },
      async closeGate(id) { return command(id, false); },
      async gatesTraffic() {
        await delay(); need("dashboard.view");
        const since = S.iso(new Date(Date.now() - 30 * 86400000));
        return db.gates.map((g) => {
          const rows = db.gateEntries.filter((e) => e.gate_id === g.id && e.created_at >= since);
          const tally = (type) => rows.filter((e) => e.entry_type === type).reduce((m, e) => ((m[e.entry_by] = (m[e.entry_by] || 0) + 1), m), {});
          const entries = tally("ENTRY"); const exits = tally("EXIT");
          const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
          return { gate_id: g.id, entries, exits, total_entries: sum(entries), total_exits: sum(exits) };
        });
      },

      // ---------------- cameras ----------------
      async listCameras(params = {}) {
        await delay(); need("cameras.view");
        let rows = db.cameras;
        if (params.gate_id) rows = rows.filter((c) => c.gate_id === Number(params.gate_id));
        return { total: rows.length, count: rows.length, data: clone(rows) };
      },
      async createCamera(body) {
        await delay(); need("cameras.manage"); required(body, ["ip_address", "port", "camera_type", "reader_type"]);
        if (body.camera_type === "LPR" && body.reader_type !== "CAMERA") throw new ApiError(400, "LPR cameras must use reader type CAMERA");
        if (body.gate_id && db.cameras.some((c) => c.gate_id === Number(body.gate_id) && c.camera_type === body.camera_type)) {
          throw new ApiError(400, `This gate already has a ${body.camera_type} camera`);
        }
        const { username, password, ...rest } = body; // credentials are write-only
        const c = { id: nextId(db.cameras), mac_address: null, channel: 1, NVR_link1: null, NVR_link2: null, subURL: null, notes: null, latency: null,
          serial_number: null, location: null, ...rest, gate_id: rest.gate_id ? Number(rest.gate_id) : null, port: Number(rest.port), is_active: false, created_at: now(), updated_at: now() };
        db.cameras.push(c);
        audit("CREATE", "CAMERA", c.id, `added camera #${c.id}`);
        return clone(c);
      },
      async updateCamera(id, body) {
        await delay(); need("cameras.manage");
        const c = find(db.cameras, id, "Camera");
        const gid = body.gate_id === undefined ? c.gate_id : body.gate_id ? Number(body.gate_id) : null;
        const type = body.camera_type || c.camera_type;
        if (gid && db.cameras.some((x) => x.id !== c.id && x.gate_id === gid && x.camera_type === type)) throw new ApiError(400, `This gate already has a ${type} camera`);
        const { username, password, ...rest } = body;
        Object.assign(c, rest, { gate_id: gid, updated_at: now() });
        if (rest.port !== undefined) c.port = Number(rest.port);
        audit("UPDATE", "CAMERA", c.id, `updated camera #${c.id}`);
        return clone(c);
      },
      async deleteCamera(id) {
        await delay(); need("cameras.manage");
        const c = find(db.cameras, id, "Camera");
        db.cameras.splice(db.cameras.indexOf(c), 1);
        audit("DELETE", "CAMERA", c.id, `deleted camera #${c.id}`);
        return { message: "Camera deleted" };
      },

      // ---------------- movements ----------------
      async listGateEntries(f = {}) {
        await delay(); need("logs.view");
        return clone(db.gateEntries.filter((e) =>
          (!f.start_date || e.created_at >= f.start_date) && (!f.end_date || e.created_at <= f.end_date) &&
          (!f.plate_number || (e.plate_number || "").includes(f.plate_number)) && (!f.resident_id || e.resident_id === Number(f.resident_id)) &&
          (!f.entry_type || e.entry_type === f.entry_type)));
      },
      async createManualEntry(body) {
        await delay(); need("gates.operate"); required(body, ["entry_type", "gate_id"]);
        const host = body.resident_id ? find(db.residents, body.resident_id, "Resident") : null;
        const e = { id: nextId(db.gateEntries), entry_type: body.entry_type, entry_by: "MANUAL", entry_by_table_id: null, image_url: null,
          plate_number: body.plate_number || null, resident_id: host ? host.id : null, resident: host ? { id: host.id, full_name: host.full_name } : null,
          gate_id: Number(body.gate_id), created_at: now() };
        db.gateEntries.unshift(e);
        audit("CREATE", "GATE_ENTRY", e.id, `logged manual ${e.entry_type.toLowerCase()} #${e.id}`);
        return clone(e);
      },

      // ---------------- residents & units ----------------
      async listResidents(f = {}) {
        await delay(); need("residents.view");
        let rows = db.residents;
        if (f.status) rows = rows.filter((r) => r.status === f.status);
        if (f.name) rows = rows.filter((r) => r.full_name.toLowerCase().includes(String(f.name).toLowerCase()));
        const skip = Number(f.skip || 0); const limit = Number(f.limit || 10);
        const data = rows.slice(skip, skip + limit).map(residentView);
        return { total: rows.length, count: data.length, data };
      },
      async getResident(id) { await delay(); need("residents.view"); return residentView(find(db.residents, id, "Resident")); },
      async createResident(body) {
        await delay(); need("residents.create"); required(body, ["full_name", "unit_id"]);
        const unit = find(db.units, body.unit_id, "Unit");
        if (!unit.is_active) throw new ApiError(400, "Unit is inactive");
        if (unit.type === "BUILDING") throw new ApiError(400, "Residents cannot be assigned to a building; choose a villa or apartment");
        if (db.residents.some((r) => r.unit_id === unit.id)) throw new ApiError(409, "This unit already has a resident");
        const phones = (body.phone_numbers || []).filter(Boolean);
        if (phones.some((p) => db.residents.some((r) => r.phone_numbers.some((x) => x.phone_number === p)))) throw new ApiError(400, "Phone number already exists");
        const r = { id: nextId(db.residents), full_name: body.full_name, status: body.status || "allowed", notes: body.notes || null,
          national_id: body.national_id || null, unit_id: unit.id, unit, phone_numbers: phones.map((p, i) => ({ id: Date.now() + i, phone_number: p })), plate_numbers: [], _email: null };
        db.residents.push(r);
        audit("CREATE", "RESIDENT", r.id, `added resident #${r.id}`);
        return residentView(r);
      },
      async updateResident(id, body) {
        await delay(); need("residents.update");
        const r = find(db.residents, id, "Resident");
        const allowed = ["full_name", "phone_numbers", "status", "notes", "national_id"];
        const extra = Object.keys(body).filter((k) => !allowed.includes(k));
        if (extra.length) throw new ApiError(422, extra.map((k) => ({ loc: ["body", k], msg: "Extra inputs are not permitted", type: "extra_forbidden" })));
        if (body.phone_numbers) r.phone_numbers = body.phone_numbers.filter(Boolean).map((p, i) => ({ id: Date.now() + i, phone_number: p }));
        ["full_name", "status", "notes", "national_id"].forEach((k) => body[k] !== undefined && (r[k] = body[k]));
        audit("UPDATE", "RESIDENT", r.id, `updated resident #${r.id}`);
        return residentView(r);
      },
      async deleteResident(id) {
        await delay(); need("residents.delete");
        const r = find(db.residents, id, "Resident");
        db.residents.splice(db.residents.indexOf(r), 1);
        db.cars = db.cars.filter((c) => c.owner_id !== r.id);
        audit("DELETE", "RESIDENT", r.id, `deleted resident #${r.id}`);
        return { message: "Resident deleted" };
      },
      async setResidentSubscription(id, subscribed) {
        await delay(); need("residents.update");
        const r = find(db.residents, id, "Resident");
        r.status = subscribed ? "allowed" : "notAllowed";
        audit("UPDATE", "RESIDENT", r.id, `${subscribed ? "allowed" : "suspended"} resident #${r.id}`);
        return residentView(r);
      },
      async setResidentCredentials(id, email, password) {
        await delay(); need("residents.update"); required({ email, password }, ["email", "password"]);
        const r = find(db.residents, id, "Resident");
        r._email = String(email).toLowerCase();
        return residentView(r);
      },
      async listUnits() { await delay(); need("residents.view"); return db.units.map(unitView); },
      async createUnit(body) {
        await delay(); need("units.manage"); required(body, ["name", "type"]);
        const parent = body.parent_id ? find(db.units, body.parent_id, "Parent unit") : null;
        if (body.type === "APARTMENT" && (!parent || parent.type !== "BUILDING")) throw new ApiError(400, "An apartment must belong to a building");
        if (body.type !== "APARTMENT" && parent) throw new ApiError(400, `A ${body.type.toLowerCase()} cannot have a parent unit`);
        if (db.units.some((u) => u.name === body.name && u.parent_id === (parent ? parent.id : null))) throw new ApiError(409, "A unit with this name already exists here");
        const u = { id: nextId(db.units), name: body.name, type: body.type, description: body.description || null, parent_id: parent ? parent.id : null, is_active: true, created_at: now(), updated_at: now(), residents: [] };
        db.units.push(u);
        return unitView(u);
      },
      async updateUnit(id, body) {
        await delay(); need("units.manage");
        const u = find(db.units, id, "Unit");
        ["name", "description", "is_active"].forEach((k) => body[k] !== undefined && (u[k] = body[k]));
        return unitView(u);
      },
      async deleteUnit(id) {
        await delay(); need("units.manage");
        const u = find(db.units, id, "Unit");
        if (db.units.some((x) => x.parent_id === u.id)) throw new ApiError(400, "Remove the apartments in this building first");
        if (db.residents.some((r) => r.unit_id === u.id)) throw new ApiError(400, "This unit has a resident");
        db.units.splice(db.units.indexOf(u), 1);
        return { message: "Unit deleted" };
      },

      // ---------------- vehicles ----------------
      async listCars() { await delay(); need("vehicles.view"); return clone(db.cars); },
      async createCar(body) {
        await delay(); need("vehicles.manage"); required(body, ["plate_number_full"]);
        if (db.cars.some((c) => c.plate_number_full === body.plate_number_full)) throw new ApiError(400, "Plate number already exists");
        const c = { id: nextId(db.cars), plate_number_full: body.plate_number_full, plate_country: body.plate_country || "Egypt", color: body.color || null,
          brand: body.brand || null, model: body.model || null, owner_id: body.owner_id ? Number(body.owner_id) : null, is_inside: false,
          last_entry_at: null, last_exit_at: null, created_at: now() };
        db.cars.push(c);
        audit("CREATE", "CAR", c.id, `registered vehicle #${c.id}`);
        return clone(c);
      },
      async updateCar(id, body) {
        await delay(); need("vehicles.manage");
        const c = find(db.cars, id, "Car");
        if (body.plate_number_full && db.cars.some((x) => x.id !== c.id && x.plate_number_full === body.plate_number_full)) throw new ApiError(400, "Plate number already exists");
        Object.assign(c, body);
        if (body.owner_id !== undefined) c.owner_id = body.owner_id ? Number(body.owner_id) : null;
        audit("UPDATE", "CAR", c.id, `updated vehicle #${c.id}`);
        return clone(c);
      },
      async deleteCar(id) {
        await delay(); need("vehicles.manage");
        const c = find(db.cars, id, "Car");
        db.cars.splice(db.cars.indexOf(c), 1);
        audit("DELETE", "CAR", c.id, `removed vehicle #${c.id}`);
        return { message: "Car deleted" };
      },

      // ---------------- visitors ----------------
      async listQRCodes() {
        await delay();
        const s = current();
        if (s.type === "resident") return clone(db.qrCodes.filter((q) => q.resident_id === s.userId)); // intended scoping (gap: own-QR list)
        need("visitors.view");
        return clone(db.qrCodes);
      },
      async issueQR(body) { await delay(); need("qr.issue"); return issue(body, "user"); },
      async residentIssueQR(body) {
        await delay();
        const s = current();
        if (s.type !== "resident") throw new ApiError(403, "Only residents can create visitor QR codes here");
        return issue({ ...body, resident_id: s.userId }, "resident");
      },
      async listVisitorLogs() { await delay(); need("visitors.view"); return clone(db.visitorLogs); },
      async listIdentityVisitors() { await delay(); need("visitors.view"); return clone(db.identityVisitors); },

      // ---------------- administration ----------------
      async listUsers(p = {}) {
        await delay(); need("users.view");
        return clone(db.users.filter((u) => !u._deleted &&
          (!p.search || (u.username + u.email).toLowerCase().includes(p.search.toLowerCase())) &&
          (!p.role || u.role === p.role) && (!p.status || u.status === p.status)));
      },
      async createUser(body) {
        await delay(); need("users.create"); required(body, ["username", "email", "password", "role"]);
        if (body.role === "superAdmin" && current().role !== "superAdmin") throw new ApiError(403, "Only a super admin can create super admins");
        if (db.users.some((u) => u.username === body.username || u.email === body.email)) throw new ApiError(400, "Username or email already exists");
        const sd = body.sub_department_id ? find(db.subDepartments, body.sub_department_id, "Sub-department") : null;
        const u = { id: nextId(db.users), username: body.username, email: body.email, role: body.role, status: "active", is_active: true, last_login_at: null,
          phone_numbers: body.phone_numbers || [], sub_department_id: sd ? sd.id : null,
          sub_department: sd ? { id: sd.id, name: sd.name, department_id: sd.department_id } : null, created_at: now(), updated_at: now() };
        db.users.push(u);
        audit("CREATE", "USER", u.id, `created user #${u.id}`);
        return clone(u);
      },
      async updateUser(id, body) {
        await delay(); need("users.update");
        const u = find(db.users, id, "User");
        if ((body.role === "superAdmin" || u.role === "superAdmin") && current().role !== "superAdmin") throw new ApiError(403, "Only a super admin can manage super admins");
        if (body.sub_department_id !== undefined) {
          const sd = body.sub_department_id ? find(db.subDepartments, body.sub_department_id, "Sub-department") : null;
          u.sub_department_id = sd ? sd.id : null;
          u.sub_department = sd ? { id: sd.id, name: sd.name, department_id: sd.department_id } : null;
        }
        ["username", "email", "role", "phone_numbers"].forEach((k) => body[k] !== undefined && (u[k] = body[k]));
        u.updated_at = now();
        audit("UPDATE", "USER", u.id, `updated user #${u.id}`);
        return clone(u);
      },
      async blockUser(id) { return setUserStatus(id, "blocked"); },
      async unblockUser(id) { return setUserStatus(id, "active"); },
      async deleteUser(id) {
        await delay(); need("users.delete");
        const u = find(db.users, id, "User");
        if (u.id === current().userId) throw new ApiError(400, "You can't delete your own account");
        u._deleted = true; u.is_active = false; u.status = "blocked";
        audit("DELETE", "USER", u.id, `deleted user #${u.id}`);
        return { message: "User deleted successfully" };
      },
      async listDepartments() { await delay(); need("users.view"); return clone(db.departments); },
      async createDepartment(body) {
        await delay(); need("organization.manage"); required(body, ["name"]);
        if (db.departments.some((d) => d.name.toLowerCase() === body.name.toLowerCase())) throw new ApiError(400, "Department already exists");
        const d = { id: nextId(db.departments), name: body.name, description: body.description || null, is_active: true, created_at: now(), updated_at: now() };
        db.departments.push(d);
        return clone(d);
      },
      async deleteDepartment(id) {
        await delay(); need("organization.manage");
        const d = find(db.departments, id, "Department");
        if (db.subDepartments.some((s) => s.department_id === d.id)) throw new ApiError(400, "Remove its sub-departments first");
        db.departments.splice(db.departments.indexOf(d), 1);
        return { success: true, message: "Department deleted" };
      },
      async listSubDepartments() { await delay(); need("users.view"); return clone(db.subDepartments); },
      async createSubDepartment(body) {
        await delay(); need("organization.manage"); required(body, ["name", "department_id"]);
        const d = find(db.departments, body.department_id, "Department");
        const s = { id: nextId(db.subDepartments), name: body.name, description: body.description || null, department_id: d.id, is_active: true, created_at: now(), updated_at: now() };
        db.subDepartments.push(s);
        return clone(s);
      },
      async deleteSubDepartment(id) {
        await delay(); need("organization.manage");
        const s = find(db.subDepartments, id, "Sub-department");
        if (db.users.some((u) => u.sub_department_id === s.id && !u._deleted)) throw new ApiError(400, "Users are still assigned to this sub-department");
        db.subDepartments.splice(db.subDepartments.indexOf(s), 1);
        return { success: true, message: "Sub-department deleted" };
      },
      async listLogs() { await delay(); need("logs.view"); return clone(db.logs); },

      subscribe(fn) { realtimeHandlers.add(fn); return () => realtimeHandlers.delete(fn); },
      lookup: { db }, // read-only access for display joins (plate → owner etc.)
    };

    async function command(id, open) {
      await delay(); need("gates.operate");
      const g = find(db.gates, id, "Gate");
      if (!g.active) throw new ApiError(500, `Failed to ${open ? "open" : "close"} gate`);
      audit("OTHER", "GATE", g.id, `${open ? "opened" : "closed"} gate #${g.id}`);
      // The command response does not confirm movement; the state arrives later via GATE_STATUS_CHANGED.
      setTimeout(() => setGateState(g, { is_open: open }), 1800 + Math.random() * 1200);
      return { message: `Gate ${g.id} ${open ? "opened" : "closed"}` };
    }
    async function setUserStatus(id, status) {
      await delay(); need("users.update");
      const u = find(db.users, id, "User");
      if (u.id === current().userId) throw new ApiError(400, "You can't block your own account");
      u.status = status; u.is_active = status === "active";
      audit(status === "active" ? "UNBLOCK" : "BLOCK", "USER", u.id, `${status === "active" ? "unblocked" : "blocked"} user #${u.id}`);
      return clone(u);
    }
    function issue(body, by) {
      required(body, ["resident_id", "visitor_full_name", "visitor_national_id", "visitor_phone_number", "expiry_date"]);
      const host = find(db.residents, body.resident_id, "Resident");
      const start = body.start_at || now();
      if (body.expiry_date <= start) throw new ApiError(422, [{ loc: ["body", "expiry_date"], msg: "Must be after the start time", type: "value_error" }]);
      const token = "QR:" + Math.random().toString(16).slice(2, 10) + "-" + Date.now().toString(16);
      const q = { id: nextId(db.qrCodes), token, type: "visitor", resident_id: host.id, unit: host.unit, created_by_id: by === "user" ? current().userId : host.id,
        created_by_type: by, max_uses: Number(body.max_uses || 1), used_count: 0, is_active: true, start_at: start, expiry_date: body.expiry_date,
        visitor_national_id: body.visitor_national_id, visitor_phone_number: body.visitor_phone_number, visitor_full_name: body.visitor_full_name,
        created_at: now(), qr_image: `uploads/qr/${token}.png` };
      db.qrCodes.unshift(q);
      return { token, type: "visitor", max_uses: q.max_uses, qr_image: q.qr_image, start_at: q.start_at, expiry_date: q.expiry_date, resident_name: host.full_name, building_number: null };
    }

    // ---------- realtime simulation: access cycles at random gates ----------
    function simulateCycle() {
      if (!auth.session() || !realtimeHandlers.size) return;
      const online = db.gates.filter((g) => g.active);
      if (!online.length) return;
      const g = S.pick(online);
      const lpr = db.cameras.find((c) => c.gate_id === g.id && c.camera_type === "LPR");
      const request_id = Math.random().toString(16).slice(2, 10);
      const base = { request_id, gate_id: g.id, camera_id: lpr ? lpr.id : undefined };
      const r = Math.random();
      const staffPlates = Object.keys(S.staffVehicles);
      const plate = g.name === "Visitor Lane" ? S.pick(S.unknownPlates) : r < 0.25 ? S.pick(staffPlates) : r < 0.75 ? S.pick(db.cars).plate_number_full : S.pick(S.unknownPlates);
      const steps = [[0, "LOOP_TRIGGERED", {}], [500, "LPR_PROCESSING", {}], [1700, "PLATE_DETECTED", { plate_number: plate, processing_ms: Math.round(900 + Math.random() * 600) }]];
      const isStaff = staffPlates.includes(plate);
      let grantedBy = null;
      if (isStaff) {
        steps.push([2300, "ACCESS_GRANTED", { method: "LPR", plate_number: plate }]);
        grantedBy = "NORMAL";
      } else {
        steps.push([2300, "QR_REQUIRED", { plate_number: plate, timeout_seconds: 20 }]);
        if (Math.random() < 0.72) {
          steps.push([6200, "QR_DETECTED", {}], [6900, "ACCESS_GRANTED", { method: "QR", plate_number: plate }]);
          grantedBy = "QR";
        } else {
          steps.push([12000, "QR_TIMEOUT", {}], [12100, "ACCESS_DENIED", { reason: "QR_TIMEOUT", plate_number: plate }]);
        }
      }
      if (grantedBy) {
        const t = steps[steps.length - 1][0];
        steps.push([t + 400, "GATE_OPENING", {}], [t + 1300, "GATE_OPENED", {}]);
        setTimeout(() => {
          const host = grantedBy === "QR" ? S.pick(db.residents) : null;
          db.gateEntries.unshift({ id: nextId(db.gateEntries), entry_type: g.type, entry_by: grantedBy, entry_by_table_id: null, image_url: null, plate_number: plate,
            resident_id: host ? host.id : null, resident: host ? { id: host.id, full_name: host.full_name } : null, gate_id: g.id, created_at: now() });
          setGateState(g, { is_open: true });
          setTimeout(() => setGateState(g, { is_open: false }), 7000);
        }, t + 1400);
      }
      steps.forEach(([ms, event, data]) => setTimeout(() => emit({ ...base, event, data }), ms));
    }
    setInterval(simulateCycle, 13000);
    setTimeout(simulateCycle, 3000);

    return api;
  }

  // =====================================================================
  // LIVE ADAPTER (same function names; requires the app to be served next to /api)
  // =====================================================================
  function createLive() {
    const BASE = "/api";
    async function req(method, path, body, query) {
      const q = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString() : "";
      const headers = {};
      const token = auth.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(BASE + path + q, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) {
        if (res.status === 401 && token) auth.clear();
        throw new ApiError(res.status, data && data.detail !== undefined ? data.detail : text);
      }
      return data;
    }
    const get = (p, q) => req("GET", p, undefined, q);
    const post = (p, b) => req("POST", p, b === undefined ? {} : b);
    return {
      mode: "live",
      staffLogin: (email, password) => post("/auth/login", { email, password }),
      residentLogin: (email, password) => post("/residents/login", { email, password }),
      me: () => get("/auth/me"),
      listGates: () => get("/gates/"),
      getGate: (id) => get(`/gates/${id}`),
      createGate: (b) => post("/gates/", b),
      updateGate: (id, b) => req("PATCH", `/gates/${id}`, b),
      deleteGate: (id) => req("DELETE", `/gates/${id}`),
      pingGate: (id) => get(`/gates/${id}/ping`),
      openGate: (id) => post(`/access-control/open-gate/${id}`),
      closeGate: (id) => post(`/access-control/close-gate/${id}`),
      gatesTraffic: () => get("/gates/traffic"),
      listCameras: (p) => get("/cameras/", { limit: 500, ...p }),
      createCamera: (b) => post("/cameras/", b),
      updateCamera: (id, b) => req("PATCH", `/cameras/${id}`, b),
      deleteCamera: (id) => req("DELETE", `/cameras/${id}`),
      listGateEntries: (f) => get("/gate-entries/", f),
      createManualEntry: (b) => post("/gate-entries/", b),
      listResidents: (f) => get("/residents/", f),
      getResident: (id) => get(`/residents/${id}`),
      createResident: (b) => post("/residents/", b),
      updateResident: (id, b) => req("PUT", `/residents/${id}`, b),
      deleteResident: (id) => req("DELETE", `/residents/${id}`),
      setResidentSubscription: (id, s) => req("PATCH", `/residents/${id}/subscribe/${s}`),
      setResidentCredentials: (id, email, password) => req("PATCH", `/residents/${id}/credentials`, { email, password }),
      listUnits: () => get("/units/"),
      createUnit: (b) => post("/units/", b),
      updateUnit: (id, b) => req("PUT", `/units/${id}`, b),
      deleteUnit: (id) => req("DELETE", `/units/${id}`),
      listCars: () => get("/cars/"),
      createCar: (b) => post("/cars/", b),
      updateCar: (id, b) => req("PUT", `/cars/${id}`, b),
      deleteCar: (id) => req("DELETE", `/cars/${id}`),
      listQRCodes: () => get("/qr/"),
      issueQR: (b) => post("/qr/admin/generate/visitor", b),
      residentIssueQR: (b) => post("/qr/resident/generate/visitor", b),
      listVisitorLogs: () => get("/visitor-logs/", { limit: 500 }),
      listIdentityVisitors: () => get("/identity-visitors/", { limit: 500 }),
      listUsers: (p) => get("/users/", { page: 1, limit: 500, ...p }),
      createUser: (b) => post("/users/", b),
      updateUser: (id, b) => req("PUT", `/users/${id}`, b),
      blockUser: (id) => req("PATCH", `/users/${id}/block`),
      unblockUser: (id) => req("PATCH", `/users/${id}/unblock`),
      deleteUser: (id) => req("DELETE", `/users/${id}`),
      listDepartments: () => get("/departments/"),
      createDepartment: (b) => post("/departments/", b),
      deleteDepartment: (id) => req("DELETE", `/departments/${id}`),
      listSubDepartments: () => get("/sub-departments/"),
      createSubDepartment: (b) => post("/sub-departments/", b),
      deleteSubDepartment: (id) => req("DELETE", `/sub-departments/${id}`),
      listLogs: () => get("/logs/", { limit: 500 }),
      subscribe(fn) {
        let ws, closed = false;
        const open = () => {
          ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
          ws.onmessage = (m) => { try { fn(JSON.parse(m.data)); } catch { /* ignore */ } };
          ws.onclose = () => !closed && setTimeout(open, 3000);
        };
        open();
        return () => { closed = true; ws && ws.close(); };
      },
      lookup: null,
    };
  }

  const mode = new URLSearchParams(location.search).get("mode") === "live" ? "live" : "mock";
  window.GH.ApiError = ApiError;
  window.GH.api = mode === "live" ? createLive() : createMock();
})();
