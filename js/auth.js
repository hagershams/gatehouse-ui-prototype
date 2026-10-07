/* Session + role → permission matrix (ui-api-contract.md §2).
   Rows marked "backend" mirror gate_auth/core/permissions.py; "assumed" rows are
   the working assumption until BD-5. The server is the authority — the UI only
   uses this to decide what to show. */
(function () {
  "use strict";
  const VIEW = ["dashboard.view", "residents.view", "gates.view", "cameras.view", "logs.view", "vehicles.view", "visitors.view"];
  const ROLE_PERMISSIONS = {
    superAdmin: [...VIEW, "users.view", "users.create", "users.update", "users.delete", "residents.create", "residents.update", "residents.delete",
      "gates.manage", "cameras.manage", "gates.operate", "vehicles.manage", "qr.issue", "organization.manage", "units.manage"],
    admin: [...VIEW, "users.view", "users.create", "users.update", "residents.create", "residents.update", "residents.delete",
      "gates.manage", "cameras.manage", "gates.operate", "vehicles.manage", "qr.issue", "organization.manage", "units.manage"],
    manager: [...VIEW, "users.view", "residents.create", "residents.update", "vehicles.manage", "qr.issue", "units.manage"],
    security: [...VIEW, "gates.operate", "qr.issue"],
  };
  const ROLE_LABEL = { superAdmin: "Super admin", admin: "Administrator", manager: "Manager", security: "Security officer", resident: "Resident" };

  const KEY = "gatehouse.session";
  const listeners = new Set();

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
  }

  const auth = {
    ROLE_PERMISSIONS,
    ROLE_LABEL,
    session: read,
    token: () => (read() || {}).token || null,
    save(s) {
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
      listeners.forEach((fn) => fn(s));
    },
    clear() {
      try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
      listeners.forEach((fn) => fn(null));
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    isResident: () => (read() || {}).type === "resident",
    /** UI-side permission check (never a security boundary). */
    can(permission) {
      const s = read();
      if (!s || s.type !== "admin") return false;
      return (ROLE_PERMISSIONS[s.role] || []).includes(permission);
    },
    decode(token) {
      try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; }
    },
  };

  window.GH = window.GH || {};
  window.GH.auth = auth;
})();
