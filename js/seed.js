/* Deterministic demo dataset. Every object uses the exact field names and
   shapes of docs/architecture/ui-api-contract.md, so the mock API can return
   them as the backend would. */
(function () {
  "use strict";
  let seed = 20260921;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const iso = (d) => d.toISOString().slice(0, 19); // naive UTC, as the backend emits
  const NOW = new Date();
  const minutesAgo = (m) => iso(new Date(NOW.getTime() - m * 60000));
  const daysAgo = (d) => minutesAgo(d * 1440);
  const t0 = daysAgo(400);

  // ---------- organisation ----------
  const departments = [
    { id: 1, name: "Security", description: "Gate operations and patrol", is_active: true, created_at: t0, updated_at: t0 },
    { id: 2, name: "Facility Management", description: "Maintenance and services", is_active: true, created_at: t0, updated_at: t0 },
    { id: 3, name: "Administration", description: "Front office and community relations", is_active: true, created_at: t0, updated_at: t0 },
  ];
  const subDepartments = [
    { id: 1, department_id: 1, name: "Gate Operations", description: "Gate officers on shift", is_active: true, created_at: t0, updated_at: t0 },
    { id: 2, department_id: 1, name: "Patrol", description: null, is_active: true, created_at: t0, updated_at: t0 },
    { id: 3, department_id: 2, name: "Maintenance", description: "Barrier and camera maintenance", is_active: true, created_at: t0, updated_at: t0 },
    { id: 4, department_id: 3, name: "Front Office", description: null, is_active: true, created_at: t0, updated_at: t0 },
  ];

  const staff = [
    ["omar.hassan", "Omar Hassan", "superAdmin", null, "active"],
    ["mona.adel", "Mona Adel", "admin", 4, "active"],
    ["karim.fathy", "Karim Fathy", "manager", 4, "active"],
    ["youssef.nabil", "Youssef Nabil", "security", 1, "active"],
    ["ahmed.samir", "Ahmed Samir", "security", 1, "active"],
    ["salma.khaled", "Salma Khaled", "security", 2, "active"],
    ["tarek.ezzat", "Tarek Ezzat", "manager", 3, "active"],
    ["hany.morsy", "Hany Morsy", "security", 1, "blocked"],
    ["dina.farouk", "Dina Farouk", "admin", 4, "suspended"],
  ];
  const users = staff.map(([username, , role, sub, status], i) => {
    const sd = sub ? subDepartments.find((s) => s.id === sub) : null;
    const created = daysAgo(380 - i * 31);
    return {
      id: i + 1, username, email: `${username}@gate-system.com`, role, status, is_active: status === "active",
      last_login_at: status === "active" ? minutesAgo(int(20, 5000)) : null,
      phone_numbers: [`010${String(20000000 + i * 734121).slice(0, 8)}`],
      sub_department_id: sd ? sd.id : null,
      sub_department: sd ? { id: sd.id, name: sd.name, department_id: sd.department_id } : null,
      created_at: created, updated_at: created,
    };
  });
  const displayName = Object.fromEntries(staff.map(([u, n]) => [u, n]));

  // ---------- units ----------
  const units = [];
  const mkUnit = (name, type, parent_id, description = null) => {
    const u = { id: units.length + 1, name, type, description, parent_id, is_active: true, created_at: t0, updated_at: t0, residents: [] };
    units.push(u);
    return u;
  };
  for (let v = 1; v <= 18; v++) mkUnit(`Villa ${String(v).padStart(2, "0")}`, "VILLA", null, v <= 6 ? "Lakeside row" : "Garden row");
  for (const b of ["A", "B", "C"]) {
    const building = mkUnit(`Building ${b}`, "BUILDING", null, b === "A" ? "6 floors" : "5 floors");
    for (let f = 1; f <= 4; f++) for (let a = 1; a <= 2; a++) mkUnit(`${b}-${f}0${a}`, "APARTMENT", building.id);
  }

  // ---------- residents ----------
  const first = ["Ahmed", "Mohamed", "Mahmoud", "Mostafa", "Hassan", "Ali", "Omar", "Khaled", "Amr", "Sherif", "Nour", "Yasmin", "Laila", "Rana", "Heba", "Mariam", "Farida", "Sara", "Nadia", "Rania", "Tamer", "Wael", "Hesham", "Sameh"];
  const last = ["El-Sayed", "Abdel Rahman", "Mansour", "Gaber", "Fouad", "Shalaby", "Ragab", "Hegazy", "Zaki", "Ibrahim", "Saleh", "Mahmoud", "El-Masry", "Fahmy", "Nasser", "Kamel", "Hamdy", "Lotfy"];
  const residents = [];
  units.filter((u) => u.type !== "BUILDING").slice(0, 34).forEach((unit, i) => {
    const full_name = `${first[(i * 7) % first.length]} ${last[(i * 5) % last.length]}`;
    const r = {
      id: i + 1, full_name, status: i % 11 === 7 ? "notAllowed" : "allowed",
      notes: i % 9 === 2 ? "Prefers calls after 5 pm" : null,
      national_id: i % 3 === 0 ? 28501010100000 + i * 7919 : null,
      unit_id: unit.id, unit,
      phone_numbers: [{ id: i + 1, phone_number: `01${pick(["0", "1", "2", "5"])}${String(10000000 + i * 2718281).slice(0, 8)}` }],
      plate_numbers: [],
      // mock-only bookkeeping (not part of ResidentResponse): login email + subscription
      _email: null,
    };
    unit.residents = [{ id: r.id, full_name }];
    residents.push(r);
  });
  residents[3]._email = "resident@gate-system.com"; // demo resident login (Wael Kamel, hosts visitor passes)

  // ---------- vehicles ----------
  const letters = ["أ", "ب", "ج", "د", "ر", "س", "ص", "ط", "ع", "ف", "ق", "ل", "م", "ن", "هـ", "و", "ى"];
  const plate = () => `${pick(letters)} ${pick(letters)} ${pick(letters)} ${int(100, 9899)}`;
  const models = [["Toyota", "Corolla"], ["Hyundai", "Elantra"], ["Kia", "Sportage"], ["Nissan", "Sunny"], ["Mercedes", "C200"], ["BMW", "320i"], ["Chery", "Tiggo 7"], ["MG", "ZS"], ["Skoda", "Octavia"], ["Peugeot", "3008"], ["Renault", "Logan"], ["Jeep", "Grand Cherokee"]];
  const colors = ["White", "Black", "Silver", "Grey", "Navy", "Red", "Beige"];
  const cars = [];
  const mkCar = (owner_id) => {
    const [brand, model] = pick(models);
    const c = {
      id: cars.length + 1, plate_number_full: plate(), plate_country: "Egypt", color: pick(colors), brand, model, owner_id,
      is_inside: rand() < 0.55, last_entry_at: minutesAgo(int(30, 4000)), last_exit_at: minutesAgo(int(60, 6000)), created_at: daysAgo(int(30, 300)),
    };
    cars.push(c);
    return c;
  };
  residents.forEach((r, i) => {
    for (let k = 0; k < (i % 4 === 0 ? 2 : 1); k++) {
      const c = mkCar(r.id);
      r.plate_numbers.push({ id: c.id, plate_number_full: c.plate_number_full, is_inside: c.is_inside });
    }
  });
  // staff vehicles (backend: user_cars) — the only plates LPR grants automatically (BD-1)
  const staffVehicles = {};
  [4, 5, 7].forEach((uid) => { const c = mkCar(null); c.is_inside = true; staffVehicles[c.plate_number_full] = uid; });

  // ---------- gates & cameras ----------
  const gateDefs = [
    ["North Gate · Entry", "ENTRY", "10.20.0.11", true, false, "Main residents' entrance"],
    ["North Gate · Exit", "EXIT", "10.20.0.12", true, false, "Main residents' exit"],
    ["South Gate · Entry", "ENTRY", "10.20.0.21", true, true, "Lakeside access"],
    ["South Gate · Exit", "EXIT", "10.20.0.22", false, false, "Lakeside exit"],
    ["Service Gate", "ENTRY", "10.20.0.31", true, false, "Deliveries and contractors"],
    ["Visitor Lane", "ENTRY", "10.20.0.41", true, false, "QR-only visitor access"],
  ];
  const gates = gateDefs.map(([name, type, ip, active, is_open, desc], i) => ({
    id: i + 1, name, type, ip, desc, active, is_open: active ? is_open : false,
    lat: null, lng: null, entries_today: null, exits_today: null, last_entry: null, last_exit: null,
    created_at: daysAgo(390), updated_at: minutesAgo(2), cameras: [],
  }));
  const cameras = [];
  const camBase = { port: 554, mac_address: null, channel: 1, NVR_link1: null, NVR_link2: null, subURL: null, notes: null, created_at: daysAgo(380), updated_at: daysAgo(5) };
  gates.forEach((g, i) => {
    cameras.push({ ...camBase, id: cameras.length + 1, location: "Plate camera", ip_address: `10.20.1.${i * 10 + 1}`, latency: g.active ? int(18, 60) : null, serial_number: `LPR-${2400 + i}`, camera_type: "LPR", reader_type: "CAMERA", is_active: g.active, gate_id: g.id });
    cameras.push({ ...camBase, id: cameras.length + 1, location: g.name === "Visitor Lane" ? "QR reader" : "Driver camera", ip_address: `10.20.1.${i * 10 + 2}`, latency: g.active && i !== 4 ? int(20, 70) : null, serial_number: `DRV-${3100 + i}`, camera_type: "DRIVER", reader_type: g.name === "Visitor Lane" ? "QRREADER" : "CAMERA", is_active: g.active && i !== 4, gate_id: g.id });
  });
  cameras.push({ ...camBase, id: cameras.length + 1, location: "Spare — store room", ip_address: "10.20.1.90", latency: null, serial_number: "LPR-2490", camera_type: "LPR", reader_type: "CAMERA", is_active: false, gate_id: null, notes: "Unassigned spare" });

  // ---------- movements (14 days, weighted to rush hours) ----------
  const gateEntries = [];
  const residentCars = cars.filter((c) => c.owner_id);
  const unknownPlates = Array.from({ length: 25 }, plate);
  const minutesToday = NOW.getHours() * 60 + NOW.getMinutes();
  for (let d = 13; d >= 0; d--) {
    const perDay = d === 0 ? Math.round(165 * Math.min(1, minutesToday / 1200)) + 6 : int(140, 190);
    for (let k = 0; k < perDay; k++) {
      const r0 = rand();
      const hour = r0 < 0.3 ? 7 + rand() * 3 : r0 < 0.55 ? 16 + rand() * 4 : 6 + rand() * 17;
      const when = new Date(NOW);
      when.setDate(when.getDate() - d);
      when.setHours(Math.floor(hour), int(0, 59), int(0, 59), 0);
      if (when > NOW) continue;
      const dirType = rand() < 0.5 ? "ENTRY" : "EXIT"; // vehicles leave as often as they arrive
      const lanes = gates.filter((x) => x.type === dirType && (x.active || d > 6));
      const g = pick(lanes.length ? lanes : gates.filter((x) => x.active));
      const r = rand();
      const entry_by = g.name === "Visitor Lane" ? "QR" : r < 0.72 ? "NORMAL" : r < 0.86 ? "QR" : r < 0.95 ? "MANUAL" : "CARD";
      const car = entry_by === "QR" ? null : rand() < 0.85 ? pick(residentCars) : null;
      const host = entry_by === "QR" ? pick(residents) : null;
      gateEntries.push({
        id: 0, entry_type: g.type, entry_by, entry_by_table_id: entry_by === "QR" ? int(1, 18) : null, image_url: null,
        plate_number: car ? car.plate_number_full : entry_by === "QR" ? (rand() < 0.6 ? pick(unknownPlates) : null) : pick(unknownPlates),
        resident_id: host ? host.id : null, resident: host ? { id: host.id, full_name: host.full_name } : null,
        gate_id: g.id, created_at: iso(when),
      });
    }
  }
  gateEntries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  gateEntries.forEach((e, i) => (e.id = gateEntries.length - i));

  // ---------- visitors ----------
  const visitorNames = ["Mahmoud Shawky", "Reem Atef", "Bassem Youssef", "Ola Hamed", "Ismail Fawzy", "Doaa Selim", "Ehab Galal", "Noha Sabry", "Ramy Lotfy", "Aya Kamal", "Sayed Abbas", "Mai Ezz", "Ziad Morad", "Hagar Nabil", "Adel Shaker", "Yara Sami", "Fady Wahba", "Inas Helmy"];
  const qrCodes = visitorNames.map((name, i) => {
    const host = residents[(i * 3) % residents.length];
    const start = new Date(NOW.getTime() - int(-2, 6) * 86400000);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + int(1, 3) * 86400000);
    const max = pick([1, 1, 2, 3, 5]);
    const used = start > NOW ? 0 : Math.min(max * 2, int(0, max * 2));
    const byStaff = i % 3 === 0;
    return {
      id: i + 1, token: `QR:${(0xa1b2c3 + i * 104729).toString(16)}-${i}`, type: "visitor", resident_id: host.id, unit: host.unit,
      created_by_id: byStaff ? 2 : host.id, created_by_type: byStaff ? "user" : "resident", max_uses: max, used_count: used,
      is_active: end > NOW && used < max * 2, start_at: iso(start), expiry_date: iso(end),
      visitor_national_id: String(29001010100000 + i * 37589), visitor_phone_number: `0112${String(1000000 + i * 31337).slice(0, 7)}`,
      visitor_full_name: name, created_at: iso(new Date(start.getTime() - 3600000 * int(2, 30))), qr_image: null,
    };
  });
  const visitorLogs = [];
  qrCodes.forEach((q) => {
    const host = residents.find((r) => r.id === q.resident_id);
    const visits = Math.ceil(q.used_count / 2);
    for (let v = 0; v < visits; v++) {
      const entry = new Date(new Date(q.start_at + "Z").getTime() + (v * 20 + int(1, 8)) * 3600000);
      if (entry > NOW) continue;
      const exited = q.used_count >= (v + 1) * 2;
      visitorLogs.push({
        id: 0, qr_code_id: q.id, resident_id: host.id, resident: { id: host.id, full_name: host.full_name },
        visitor_full_name: q.visitor_full_name, visitor_national_id: q.visitor_national_id, visitor_phone_number: q.visitor_phone_number,
        image_url: null,
        created_by: q.created_by_type === "user" ? { id: 2, type: "user", name: "Mona Adel" } : { id: host.id, type: "resident", name: host.full_name },
        entry_time: iso(entry), exit_time: exited ? iso(new Date(entry.getTime() + int(1, 5) * 3600000)) : null,
        status: exited ? "exited" : "entered", created_at: iso(entry),
      });
    }
  });
  visitorLogs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  visitorLogs.forEach((v, i) => (v.id = visitorLogs.length - i));

  const identityVisitors = [
    ["Gamal Abdel Aziz", "national_id"], ["Sherine Wagdy", "driving_license"], ["Martin Keller", "passport"], ["Hossam Ghaly", "national_id"],
    ["Nabila Ramzy", "driving_license"], ["Ana Lopez", "passport"], ["Essam Kamal", "national_id"],
  ].map(([full_name, document_type], i) => ({
    id: i + 1, document_type, full_name,
    national_id: document_type === "national_id" ? String(28812120100000 + i * 4111) : null,
    license_number: document_type === "driving_license" ? `DL-${740000 + i * 913}` : null,
    nationality_en: document_type === "passport" ? (i === 2 ? "German" : "Spanish") : "Egyptian",
    plate_number: i % 2 ? plate() : null, status: i < 2 ? "inside" : i === 6 ? "blocked" : "exited",
    last_entry_time: minutesAgo(int(30, 5000)), last_exit_time: i < 2 ? null : minutesAgo(int(10, 2000)),
    entries_count: int(1, 4), exits_count: i < 2 ? 0 : int(1, 3), gate_id: 5, created_at: daysAgo(int(1, 40)),
  }));

  // ---------- audit log ----------
  const acts = [["CREATE", "RESIDENT", "added resident"], ["UPDATE", "RESIDENT", "updated resident"], ["CREATE", "CAR", "registered vehicle"],
    ["OTHER", "GATE", "opened gate"], ["UPDATE", "CAMERA", "updated camera"], ["CREATE", "USER", "created user"],
    ["DELETE", "CAR", "removed vehicle"], ["OTHER", "GATE", "closed gate"], ["UPDATE", "USER", "updated user"], ["BLOCK", "USER", "blocked user"]];
  const auditLogs = Array.from({ length: 70 }, (_, i) => {
    const [action_type, entity_name, verb] = pick(acts);
    const uid = pick([1, 2, 2, 3, 4, 5, 7]);
    const ent = int(1, 40);
    return { id: 70 - i, user_id: uid, action_type, entity_name, entity_id: ent, description: `${staff[uid - 1][0]} ${verb} #${ent}`, created_at: minutesAgo(i * 47 + int(0, 40)) };
  });

  window.GH = window.GH || {};
  window.GH.seed = {
    rand, pick, int, iso, plate, NOW,
    departments, subDepartments, users, units, residents, cars, staffVehicles, unknownPlates,
    gates, cameras, gateEntries, qrCodes, visitorLogs, identityVisitors, auditLogs, displayName,
  };
})();
