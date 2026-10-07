# Gatehouse Prototype — Review Checklist

**Open:** https://hagershams.github.io/gatehouse-ui-prototype/
**Demo password for all accounts:** `demo1234` (demo only)
**Full guide:** [USER-GUIDE.md](USER-GUIDE.md) · https://hagershams.github.io/gatehouse-ui-prototype/docs/user-guide.html

Everything runs on demo data in your browser. No real gate, camera or person is affected. Reload the page to reset the data.

## Sign-in
- [ ] Wrong password is refused with a clear message.
- [ ] *Blocked officer · Hany Morsy* is refused as blocked.
- [ ] **Administrator · Mona Adel** signs in and opens the dashboard.

## Dashboard
- [ ] Four headline figures are shown.
- [ ] The gate list shows each gate as **Online/Offline** and **Open/Closed/Unknown**.
- [ ] *Movements today, by hour* and *Traffic by gate* charts show values on hover.
- [ ] New vehicles appear in **Live access** every few seconds.

## Gates
- [ ] *South Gate · Exit* is **Offline**, its barrier is **Unknown**, and **Open gate** is greyed out.
- [ ] **Check status** on an online gate reports *online · ms*; on the offline gate, *did not respond*.
- [ ] **Open gate** → confirm → **Command sent** → a few seconds later **Open**.
- [ ] **Close gate** → confirm → **Command sent** → **Closed**.
- [ ] A gate's detail page shows connectivity, barrier, recent movements and cameras.

## Activity
- [ ] *Movements*: **7 days**, direction / method / gate filters and search all work.
- [ ] **Export CSV** downloads a file.
- [ ] *Audit log* lists staff actions (including your gate commands).

## Residents
- [ ] Search finds a resident; clicking a row opens their details.
- [ ] **Add resident** without data shows field errors.
- [ ] Adding with a name, a free unit and a phone number succeeds.

## Visitors / QR
- [ ] *Visitor passes*, *Visit log* and *Walk-in visitors* tabs all load.
- [ ] **Issue visitor pass** with a 3-digit national ID is rejected (14 digits required).
- [ ] With valid data, **Pass ready** shows a QR preview (visual only, not scannable).

## Vehicles, Cameras, Staff, Units
- [ ] *Vehicles*: number plates, owners, and the **On site / Away** filter.
- [ ] *Cameras*: role, gate, health (online/offline) and the **Unassigned** spare.
- [ ] *Staff users*: **Block** a user (with confirmation); status becomes **Blocked**.
- [ ] *Units & departments*: buildings with apartments, villas, departments and teams.

## Roles (name, top right → **Switch demo role**)
- [ ] **Manager**: no *Open/Close gate* buttons; can add residents.
- [ ] **Security officer**: no *Staff users* or *Units & departments* in the menu.
- [ ] **Security officer** opening https://hagershams.github.io/gatehouse-ui-prototype/#/users sees **You don't have access to this page**.
- [ ] **Resident · Wael Kamel**: only *Visitor invitations*; **Invite a visitor** produces a pass.

## Direct role links
- [ ] https://hagershams.github.io/gatehouse-ui-prototype/?as=superAdmin
- [ ] https://hagershams.github.io/gatehouse-ui-prototype/?as=admin
- [ ] https://hagershams.github.io/gatehouse-ui-prototype/?as=manager
- [ ] https://hagershams.github.io/gatehouse-ui-prototype/?as=security
- [ ] https://hagershams.github.io/gatehouse-ui-prototype/?as=resident
