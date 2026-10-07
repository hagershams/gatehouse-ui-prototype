# Gatehouse — UI prototype

A clickable UI/UX prototype of a gate and access-control system for a gated residential compound. It covers live gate status and operations, vehicles, residents, visitor passes, cameras and staff.

It runs entirely on **demo data in your browser**. It isn't connected to any real system, and no real gate or camera is controlled.

## For reviewers

| | |
|---|---|
| **Open the prototype** | https://hagershams.github.io/gatehouse-ui-prototype/ |
| **Demo guide** (how to test, roles, walkthrough) | https://hagershams.github.io/gatehouse-ui-prototype/docs/user-guide.html |
| **Review checklist** | https://hagershams.github.io/gatehouse-ui-prototype/docs/demo-checklist.html |
| Guide as Markdown | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) · [docs/DEMO-CHECKLIST.md](docs/DEMO-CHECKLIST.md) |

Sign in by clicking a demo account on the sign-in page. All demo accounts use the password **`demo1234`** (demo only):

| Role | Email |
|---|---|
| Super admin | `omar.hassan@gate-system.com` |
| Administrator | `mona.adel@gate-system.com` |
| Manager | `karim.fathy@gate-system.com` |
| Security officer | `youssef.nabil@gate-system.com` |
| Resident | `resident@gate-system.com` |

Or open a role directly: [`?as=superAdmin`](https://hagershams.github.io/gatehouse-ui-prototype/?as=superAdmin) · [`?as=admin`](https://hagershams.github.io/gatehouse-ui-prototype/?as=admin) · [`?as=manager`](https://hagershams.github.io/gatehouse-ui-prototype/?as=manager) · [`?as=security`](https://hagershams.github.io/gatehouse-ui-prototype/?as=security) · [`?as=resident`](https://hagershams.github.io/gatehouse-ui-prototype/?as=resident)

Reload the page to reset the demo data.

## Run it locally (optional)

Plain HTML, CSS and JavaScript: no framework, no build step, no packages. Either open `index.html` directly, or serve the folder:

```bash
python -m http.server 5500
# then open http://localhost:5500
```

## Project layout

```
index.html        app entry
css/              design tokens and styles
js/               demo data, sign-in and roles, demo service, UI toolkit, app shell
js/pages/         one file per screen
docs/             demo guide and review checklist
```

## Design notes

- **Purpose:** a calm, dense operations tool for a security office, used all day. Clarity and scan speed over decoration.
- **Colour:**
  - Neutral surfaces and one action green.
  - Amber is reserved for the barrier and the "open" state.
  - Status colours always come with an icon and a label.
- **Type:** IBM Plex Sans, IBM Plex Sans Arabic for names and plates, and IBM Plex Mono for codes and times.
- **Signature elements:** the Egyptian number-plate chip and the barrier glyph (arm down = closed, raised = open, dashed = unknown).
- **Gate states:** connectivity (**Online / Offline**) and barrier position (**Open / Closed / Unknown**) are always shown separately. Opening or closing a gate is a confirmed command: the gate shows *Command sent* until it reports its new position.
