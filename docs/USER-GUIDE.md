# Gatehouse UI Prototype — Demo Guide

A short guide for anyone reviewing the Gatehouse prototype: managers, team leads, product owners and other stakeholders. No technical knowledge is needed.

- **Open the prototype:** https://hagershams.github.io/gatehouse-ui-prototype/
- **This guide as a web page:** https://hagershams.github.io/gatehouse-ui-prototype/docs/user-guide.html
- **Quick checklist:** [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md) (also on the web: https://hagershams.github.io/gatehouse-ui-prototype/docs/demo-checklist.html)

---

## 1. Overview

**Gatehouse** is a UI/UX prototype of a gate and access-control system for a gated residential compound. It shows how the security office and management team would:

- watch every gate live and open or close barriers,
- follow vehicles and visitors coming in and going out,
- manage residents, vehicles, visitor passes, cameras and staff.

> **Important:** the prototype runs entirely on **demo data inside your browser**. It does **not** control any real gate, camera or system, and nothing you do affects real people or records.

---

## 2. Open the prototype

1. Open **https://hagershams.github.io/gatehouse-ui-prototype/** in any modern browser (Chrome, Edge, Safari or Firefox).
2. That's all: there's nothing to install and no GitHub account is needed. It also works on a phone.

---

## 3. Demo accounts

These are **demo credentials for the prototype only**. All accounts use the same password.

**Password for every account: `demo1234`**

| Role | Email | What it demonstrates |
|---|---|---|
| Super admin | `omar.hassan@gate-system.com` | Everything, including managing other administrators and deleting staff users |
| Administrator | `mona.adel@gate-system.com` | Day-to-day administration: gates, cameras, residents, vehicles and staff |
| Manager | `karim.fathy@gate-system.com` | Community management: residents, vehicles, units and visitor passes; no gate control |
| Security officer | `youssef.nabil@gate-system.com` | Gate operations: opening and closing gates, logging movements, issuing visitor passes |
| Resident | `resident@gate-system.com` | The resident's own experience (Wael Kamel, Villa 04): inviting visitors |
| Blocked officer *(negative test)* | `hany.morsy@gate-system.com` | Shows what happens when a blocked account tries to sign in |

**Fastest way in:** the sign-in page lists these accounts under *Prototype demo accounts*. Click one to sign in instantly; no typing needed.

---

## 4. Role comparison

✓ = available · — = hidden or not allowed

| Area / action | Super admin | Administrator | Manager | Security officer | Resident |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | — |
| Gates: view status, **Check status** | ✓ | ✓ | ✓ | ✓ | — |
| Gates: **Open / Close** | ✓ | ✓ | — | ✓ | — |
| Gates: add, edit, delete | ✓ | ✓ | — | — | — |
| Activity: movements and audit log | ✓ | ✓ | ✓ | ✓ | — |
| Activity: log a manual movement | ✓ | ✓ | — | ✓ | — |
| Residents: view | ✓ | ✓ | ✓ | ✓ | — |
| Residents: add, edit, suspend/restore access, set app sign-in | ✓ | ✓ | ✓ | — | — |
| Residents: delete | ✓ | ✓ | — | — | — |
| Visitors: passes, visit log, walk-ins | ✓ | ✓ | ✓ | ✓ | — |
| Visitors: **Issue visitor pass** | ✓ | ✓ | ✓ | ✓ | own visitors only |
| Vehicles: view | ✓ | ✓ | ✓ | ✓ | — |
| Vehicles: register, edit, delete | ✓ | ✓ | ✓ | — | — |
| Cameras: view health | ✓ | ✓ | ✓ | ✓ | — |
| Cameras: add, edit, delete | ✓ | ✓ | — | — | — |
| Staff users: view | ✓ | ✓ | ✓ | — | — |
| Staff users: add, edit, block/unblock | ✓ | ✓ | — | — | — |
| Staff users: delete | ✓ | — | — | — | — |
| Units & departments: view | ✓ | ✓ | ✓ | — | — |
| Units: add, delete | ✓ | ✓ | ✓ | — | — |
| Departments and teams: add, delete | ✓ | ✓ | — | — | — |
| Resident portal (*Visitor invitations*) | — | — | — | — | ✓ |

Two extra rules you may notice:

- Only a **Super admin** can create, change or manage other Super admin accounts.
- Nobody can block or delete **their own** account.

---

## 5. Recommended demo flow (about 15 minutes)

| # | Try this | Expected result |
|---|---|---|
| 1 | On the sign-in page, click **Administrator · Mona Adel**. | The *Operations overview* dashboard opens. |
| 2 | Review the dashboard. | Four headline figures; a gate list; *Movements today, by hour*; *Live access* (new vehicles appear every few seconds); *Traffic by gate*. |
| 3 | Click **Gates** in the left menu. | Six gate cards. *South Gate · Exit* is **Offline** with the barrier shown as **Unknown**. |
| 4 | Click a gate name, for example **North Gate · Entry**. | The gate's detail page: connectivity, barrier position, recent movements, cameras. |
| 5 | Click **Check status**. | A message reports the gate is online, its response time and its position. |
| 6 | Click **Open gate**, then confirm. | The gate shows **Command sent**. A few seconds later it reports **Open**. |
| 7 | Click **Close gate**, then confirm. | Same steps: **Command sent**, then **Closed**. |
| 8 | Open **Activity**. Try **7 days**, the filters and **Export CSV**. Then open **Audit log**. | Every movement is listed and filterable; the audit log shows staff actions, including your gate commands. |
| 9 | Open **Residents**, search a name, open a resident, then use **Add resident**. | Resident details open in a side panel; your new resident appears in the list. |
| 10 | Open **Visitors** and click **Issue visitor pass**. | After filling the form, a **Pass ready** panel shows the pass and a QR preview. |
| 11 | Open **Vehicles** and filter **On site**. | Only vehicles currently inside are shown. |
| 12 | Open **Cameras**. | Each camera's role, gate and health (online/offline). |
| 13 | Open **Staff users**. | Staff list with roles, teams and status (active, blocked, suspended). |
| 14 | Open **Units & departments**. | Buildings with their apartments, villas, and the staff departments. |
| 15 | Click your name (top right) → **Switch demo role** → **Security officer**. | The menu shrinks: no *Staff users* or *Units & departments*. |
| 16 | While signed in as Security officer, open https://hagershams.github.io/gatehouse-ui-prototype/#/users | *You don't have access to this page*. |
| 17 | Switch role to **Resident · Wael Kamel**. | The resident portal: *Visitor invitations* with the resident's own passes. |

---

## 6. Gate testing

Each gate shows **two separate indicators**. They answer different questions:

| Indicator | Meaning | Possible values |
|---|---|---|
| **Connectivity** | Can the system reach the gate's controller? | **Online** · **Offline** |
| **Barrier** | Where did the gate last report its barrier? | **Open** · **Closed** · **Unknown** (shown while the gate is offline) |

A gate can be *Online and Closed*, *Online and Open*, or *Offline and Unknown*. When a gate is offline the system can't know the barrier's position, so it says **Unknown** rather than guessing.

**Open a gate** (Super admin, Administrator or Security officer):

1. Click **Open gate** (on the Gates page, the gate detail page or the dashboard).
2. A confirmation asks *"Open [gate name]?"*. Click **Open gate**.
3. The gate shows **Command sent**. The system has sent the command but hasn't yet heard back.
4. A few seconds later the gate *reports* its new position: the badge changes to **Open** and a message confirms it.

**Close a gate:** the same steps with **Close gate**, ending in **Closed**.

**Check status:** asks the gate for its current state. On *South Gate · Exit* (offline) you'll see *"did not respond"*, and **Open gate** stays disabled.

> **Simulated:** in this prototype the gate "reports back" automatically after a few seconds. No real barrier moves. If no report arrives within 15 seconds, the prototype warns you, as the real system would.

---

## 7. Residents

- **Find a resident:** type a name, unit or phone number in the search box. Use **All / Allowed / Suspended** to filter by access.
- **What's shown:** name and phone, unit (villa or apartment), registered vehicles (shown as number plates) and access status.
- **Open a resident:** click a row to see details, vehicles and actions: **Edit details**, **Suspend / Restore access**, **Set sign-in** (for the resident app) and **Delete**. Which of these appear depends on your role.
- **Add a resident:** click **Add resident** and fill in the name, a **free** unit and a phone number.
  - Only free units can be chosen; each villa or apartment can have one resident.
  - National ID, if entered, must be 14 digits.
- **Notice:** errors appear next to the field that needs fixing. Suspending access asks for confirmation first.

---

## 8. Visitors and QR passes

The **Visitors** page has three tabs:

| Tab | What it shows |
|---|---|
| **Visitor passes** | Every pass: visitor, host resident, validity window, visits used, status (*Valid, In use, Scheduled, Used up, Expired*) and who issued it. Click a row to see the pass. |
| **Visit log** | Each visit: arrival, departure, how long the visitor stayed. |
| **Walk-in visitors** | Visitors registered at the gate from an ID card, driving licence or passport. |

**Issue a visitor pass:** click **Issue visitor pass**, then choose the host resident and enter the visitor's name, phone, national ID, validity and number of visits. The form checks that:

- the national ID has **14 digits**,
- the phone number contains only digits,
- **Valid until** is after **Valid from**.

The result is a **Pass ready** panel with a QR code and a **Copy pass code** button. One *visit* means one entry plus one exit.

> **Note:** the QR code is a **visual preview only**. It isn't a real, scannable code.

---

## 9. Activity

- **Movements:** every vehicle entry and exit. Filter by **Today / 7 days / 14 days**, direction (entries/exits), method (plate recognition, QR pass, manual, card) and gate, or search by plate or person.
- **Export CSV:** downloads the filtered list as a spreadsheet file.
- **Log manual movement** (Super admin, Administrator, Security officer): record a vehicle that passed without automatic recognition.
- **Audit log** tab: who did what and when (created, updated, deleted, blocked…), with search and an action filter.

---

## 10. Vehicles

- Each vehicle is shown with its **number plate** (Egyptian plate style), make and model, owner and whether it is **On site** or **Away**.
- Search by plate, make or owner, and filter **All / On site / Away**.
- Super admin, Administrator and Manager can click a vehicle to edit it, or use **Register vehicle**. A plate that already exists is rejected.

---

## 11. Cameras

- Lists the plate-recognition cameras, driver cameras and QR readers, which gate each one serves, its address, and its health (**Online** with response time, or **Offline**). Unassigned spares are marked **Unassigned**.
- Filter **All / Online / Offline / Unassigned**.
- Super admin and Administrator can add, edit or delete cameras. Camera passwords are never shown after saving.

> The prototype does **not** connect to any real camera and shows no video.

---

## 12. Staff users

- Lists staff with their role, team, status (**Active, Blocked, Suspended**) and last sign-in.
- Search by name or email; filter by role or status.
- **Super admin / Administrator:** add users and edit their role and team. Use **Block** or **Unblock**, which ask for confirmation.
- **Super admin only:** delete a user.
- **Try this:** block a user (for example *Ahmed Samir*), then **without reloading the page** sign out and try to sign in as `ahmed.samir@gate-system.com` / `demo1234`. The sign-in is refused. (The demo account *Blocked officer · Hany Morsy* shows this straight away.)

---

## 13. Units & departments

- **Units:** the compound's buildings (with their apartments indented underneath) and villas, who lives in each, and which are vacant.
  - Super admin, Administrator and Manager can add units.
  - Empty units can be deleted.
  - Apartments must belong to a building.
- **Departments:** the staff organisation (for example *Security → Gate Operations, Patrol*) and how many staff are in each team.
  - Super admin and Administrator can add or remove departments and teams.

---

## 14. Resident portal

- Sign in as **Resident · Wael Kamel** (or `resident@gate-system.com` / `demo1234`).
- The resident sees only **Visitor invitations**: their own passes and an **Invite a visitor** button.
- The invite form is the same as staff use, without the host field (the host is the resident).
- After inviting, a **Pass ready** panel shows the QR preview.

---

## 15. Role-based access

You can see the prototype through each role's eyes in three ways:

1. **Sign-in page:** click a demo account.
2. **Inside the app:** click your name (top right) → **Switch demo role**.
3. **Direct links:** each link opens the prototype already signed in as that role.

| Role | Direct link |
|---|---|
| Super admin | https://hagershams.github.io/gatehouse-ui-prototype/?as=superAdmin |
| Administrator | https://hagershams.github.io/gatehouse-ui-prototype/?as=admin |
| Manager | https://hagershams.github.io/gatehouse-ui-prototype/?as=manager |
| Security officer | https://hagershams.github.io/gatehouse-ui-prototype/?as=security |
| Resident | https://hagershams.github.io/gatehouse-ui-prototype/?as=resident |

You can also add a page to a link, for example `?as=security#/gates`.

**What to expect:**

- Each role sees only the menu items it's allowed to use.
- Buttons for actions a role can't perform are hidden.
- Opening a page your role can't use shows **"You don't have access to this page"**.

---

## 16. What is real vs mock

| Feature | Prototype behavior |
|---|---|
| Screens, navigation, forms, tables, filters | **Real UI**: this is the intended experience |
| Sign-in and roles | **Demo accounts only**, checked inside the browser; not a real security system |
| Gates, residents, vehicles, visitors, cameras, staff | **Demo data** created in the browser |
| Opening and closing gates, *Check status* | **Simulated.** No real gate is contacted; the gate "reports back" automatically. |
| *Live access* feed (vehicles arriving) | **Simulated** every few seconds |
| QR passes | **Visual preview**, not scannable |
| Camera health | **Demo values**; no real cameras or video |
| Adding, editing, deleting, blocking | Works in the prototype, but **only in your browser tab**, and **resets when you reload** |
| *Export CSV* | Real file download of the demo data shown |
| Connection to the real system | **None.** The prototype is not connected to any backend. |

---

## 17. Known limitations

- **Demo data only:** nothing is saved; reloading the page restores the original data, and every reviewer starts from the same data.
- **No real gate control:** commands are simulated.
- **No real cameras:** no video streams; camera health is demo data.
- **QR codes are previews,** not scannable codes.
- **Not connected to any backend.**
- **Revoking a visitor pass isn't available;** passes end when they expire or are used up.
- **Fonts:** the page uses Google Fonts. Without internet access to them, it falls back to standard system fonts and still works.

---

## 18. Troubleshooting

| Problem | What to do |
|---|---|
| Sign-in doesn't work | Use one of the demo emails above with the password `demo1234`, or simply click a demo account on the sign-in page. *Hany Morsy* is blocked on purpose. |
| Return to the sign-in screen | Click your name (top right) → **Sign out**. |
| Reset the demo data | **Reload the page.** The data returns to its original state; you stay signed in. Closing the tab also resets everything and signs you out. (Signing out alone does *not* reset the data.) |
| Open a different role | Name (top right) → **Switch demo role**, or use a direct role link from section 15. |
| Page looks incomplete or unstyled | Reload the page. If it persists, try another browser, or check that the internet connection is working. |
| *Open gate* is greyed out | That gate is **Offline** (for example *South Gate · Exit*), so it can't receive commands. Try **Check status**, or another gate. |
