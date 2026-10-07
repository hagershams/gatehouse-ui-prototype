# Gatehouse — UI prototype

Plain HTML, CSS and vanilla JavaScript. No framework, no build step, no npm packages.
It runs on an in-memory mock that follows `docs/architecture/ui-api-contract.md`, so the
screens can be reviewed without the backend. The later React frontend reuses the same
contract and service shape.

## Run it

Either:

- **Open the file:** double-click `ui-prototype/index.html` (works from disk), or
- **Serve it** (recommended, so the browser treats it like a real site):

  ```bash
  cd ui-prototype
  python -m http.server 5500
  # open http://localhost:5500
  ```

Sign in with a demo account on the login screen (password `demo1234`), or deep-link
straight into a role:

| Role | Link |
|---|---|
| Super admin | `index.html?as=superAdmin#/dashboard` |
| Administrator | `index.html?as=admin#/gates` |
| Manager | `index.html?as=manager#/residents` |
| Security officer | `index.html?as=security#/dashboard` |
| Resident | `index.html?as=resident#/portal` |

Switch roles any time from the user menu (top right). Data resets on reload.

**Live backend:** `index.html?mode=live` sends the same calls to `/api` and `/ws` on the
same origin (serve it behind a proxy to the FastAPI app). The mock is the default.

## Structure

```
index.html          shell, fonts, script order
css/tokens.css      design tokens (colour, type, space, radius)
css/app.css         layout and components
js/seed.js          deterministic demo data (contract field names)
js/auth.js          session + role → permission matrix (contract §2)
js/api.js           one function per contract endpoint; mock + live adapters
js/ui.js            escaping, icons, formatting, plate chip, gate state,
                    drawer, confirm, toasts, table, states, charts
js/app.js           router, shell, role-aware nav, realtime bus, gate commands
js/pages/*.js       one file per area
```

## Design system

- **Direction:** a calm, dense operations tool for a gated compound's security office,
  used all day at a desk. Clarity and scan speed over decoration.
- **Colour:**
  - Cool neutral canvas `#f3f5f4` and white surfaces.
  - One action green `#0f5e52`.
  - Barrier amber `#f2b33d`, reserved for the barrier glyph, plate band and "open" state.
  - Status colours (online/offline, allowed/suspended…) always come with an icon and a label.
  - Roles use neutral badges: a role isn't a status.
- **Type:**
  - IBM Plex Sans for the interface.
  - IBM Plex Sans Arabic for names and plates.
  - IBM Plex Mono for IPs, IDs and times.
  - Tabular numbers everywhere.
- **Signature elements** (the one place the design spends boldness):
  - The **Egyptian plate chip** (blue *EGYPT / مصر* band, Arabic letters and digits).
  - The **barrier glyph**: arm down = closed, raised = open, dashed = unknown.
- **Charts:**
  - Today's movements per hour: entries vs exits as grouped columns, with a legend and hover tooltip.
  - Traffic per gate over 30 days: single-series bars, with the method breakdown on hover.
  - Series colours `#2a78d6` / `#eb6834`, validated for colour-vision deficiency.
- **Patterns:**
  - Tables with sort, search, filters and paging.
  - Side drawers for detail and forms.
  - Confirm dialogs for anything consequential.
  - Toasts for outcomes.
  - Skeleton loading, empty and error states (with retry), and a permission-denied page.

## Gate semantics (kept exactly)

- **`active` → Online / Offline.** Connectivity, set by health checks; never editable.
- **`is_open` → Open / Closed.** Only while online; shown as **Unknown** when offline.
- **Open/close is a command.** The UI shows *Command sent* and only shows the new state
  when the gate reports it (`GATE_STATUS_CHANGED`). It warns if no report arrives within 15 s.
- **Check status** runs a live ping.
- The backend's daily counters (`entries_today`) are not shown; counts come from the
  movement ledger.

## Roles (simulated, intended RBAC)

The navigation and actions follow `js/auth.js`. The mock also enforces it with 403
responses, as the fixed backend will.

| Area | superAdmin | admin | manager | security | resident |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard, gates, activity, residents, visitors, vehicles (view) | ✓ | ✓ | ✓ | ✓ | |
| Open / close gates, log manual movement | ✓ | ✓ | | ✓ | |
| Manage gates and cameras | ✓ | ✓ | | | |
| Add / edit residents and vehicles | ✓ | ✓ | ✓ | | |
| Delete residents | ✓ | ✓ | | | |
| Issue visitor passes | ✓ | ✓ | ✓ | ✓ | own only |
| Staff users (view / manage / delete) | ✓ / ✓ / ✓ | ✓ / ✓ / – | ✓ / – / – | | |
| Units & departments | ✓ | ✓ | units | | |

Rows not in the backend's permission list are working assumptions until BD-5 is decided.

## Known prototype limits

- QR images are a visual preview; the backend generates the real PNG.
- Lists are paged in the browser. The backend lacks totals for several lists (contract §5).
- Data lives in memory and resets on reload.
