# RoomRaah frontend — the plan under the deadline

**Written 2026-09-07 15:00. Code stops at 22:00; the user submits at 23:58 and keeps
22:00–23:58 as their own testing buffer.** This file exists so that a compacted session can
pick up without re-deriving any of it. Read this, then `AGENTS.md`, then
`contract/RoomRaah_Frontend_Brief.md` §8 for the shape of whatever you are building.

---

## 1. What the bar actually is

The judges **click the product; they do not read the code**. So:

- every screen reachable in a demo works end to end;
- nothing visibly slow;
- no dead button, no broken empty state, no raw or wrong error message.

Code elegance and exhaustive unit coverage are **deliberately deprioritised against that**
for this deadline. That is a decision the user made, not a corner cut quietly. It narrows
the project's usual "tests are the definition of done" rule to: test what protects the demo
path, and let `npm run verify` cover the rest.

**Visual polish is not ours.** The user will restyle with ChatGPT after the build. We write
markup, TypeScript and only the SCSS that is *behaviour* — grid, breakpoints, overlays,
sticky headers, focus states. The boundary is mechanical: templates and TS are ours, `.scss`
is the polish surface, and semantic class names are the contract between the two halves.

## 2. One command answers "is it fine?"

```bash
npm run verify
```

Four gates, in the order that fails cheapest first:

1. `guard` — the contact / stack / stack-imports scans (AGENTS.md §6).
2. `build` — production build. Catches every template and type error, and the bundle budget
   is the performance floor.
3. `test` — unit tests.
4. `smoke` — a real Chrome walks the demo path against the live API and asserts, per page:
   no console error, no unexpected failed request, the page's required elements rendered,
   and the error copy that should appear does. Screenshots land in `.verify/`.

**Every new page is added to the smoke walk in the same commit that adds the page.** The
moment that slips, the script stops being the answer to "sab theek hai?" and we are back to
clicking through twenty pages by hand, which is the thing this exists to prevent.

## 3. The ledger — read this first after a compaction

Update the Done column **in the same commit** that finishes a slice. This table and
`RoomRaah_Progress.md` are the only two places that say where the build is; the codebase is
not a status report and reading it to find out is the slow way.

| # | Slice | Pages | Budget | Done |
|---|---|---|---|---|
| — | Design system: button, badge, form-field + input, dialog, spinner, skeleton, empty-state, property-card, location-autocomplete | — | — | yes |
| — | Auth end to end: signup, login, verify, reset; JWT util; interceptor with queued silent refresh; four guards on `withSession()` | 03 04 05 06 | — | yes |
| A | Plumbing: typed catalogue models, error mapping, app shell + nav, reference-data cache | — | 45m | yes |
| B | Search + filter panel + property detail + photos + reviews | 07 08 10 11 12 | 90m | yes |
| C | Landing, how it works | 01 02 | 45m | yes |
| C2 | Compare, saved | 13 14 | — | yes |
| D | Seeker actions: shortlist toggle, visit request, my visits, write review, report dialog | 15 | 40m | yes |
| E | Owner dashboard + listing form, photo flow, revision states | 18 19 | 75m | yes |
| F | Admin panel, five tabs | 20 | 60m | yes |
| G | Messages (hub + polling fallback) + profile | 16 17 | 45m | yes |
| H | Map view; responsive pass at four breakpoints; accessibility pass; final verify | 09 | 40m | no |

Green as of the last commit: guard clean, production build clean, unit tests passing,
smoke walk passing. `npm run verify` is the check — never a hand-clicked page.

## 4. How the remaining slices are run

Slices land back to back, in the ledger's order. Times are budgets, not estimates — when
one overruns, the scope inside it gets cut, not the clock, and the cut gets said out loud.

### Cut, deliberately, and what the user gets instead

- ~~**SignalR hub (brief §9).**~~ **Un-cut.** The cut was costed wrongly: the hub is already
  built and integration-tested on the backend — `/hubs/chat`, `ChatHub`, `IRealtimeNotifier`,
  the `access_token` query-string read — so the frontend only ever needed a client, not an
  hour. It also mattered more than it looked: the server emails a "you have a new message"
  nudge to anybody it cannot push to, so a polling-only client means every message sends an
  email. `RealtimeService` holds one connection for the whole session and loads
  `@microsoft/signalr` behind a dynamic `import()`, which keeps it out of the initial bundle
  (354.90 kB, up 2.13 kB). **Polling stays** as the fallback the brief requires: it runs only
  while the hub is down, and both channels feed `upsertMessage` so a message arriving twice
  draws one bubble.
- ~~**Map tiles on page 09.**~~ **Un-cut.** The brief names Leaflet with OpenStreetMap for
  the owner's pin, and a map library is not a component library, so it does not touch the
  "no component library" decision. Installing it for page 19 makes page 09 cheap, so it is
  back in slice H. Leaflet is kept out of `shared/components/index.ts` on purpose — that
  barrel reaches the app shell, and going through it put 150kB in the initial bundle.
- **Unit tests for presentational components.** Logic that can break silently — query-string
  to filter mapping, error mapping, guards — keeps its tests. A component that only renders
  what it is given is covered by the smoke walk.

Nothing in §3 or §10 of the brief is cut. Those are the rules that make a screen wrong
rather than unfinished.

## 5. The rules most likely to be got wrong in a hurry

Full list: AGENTS.md §3 and brief §10. The five that a fast build breaks first:

1. **No owner phone, email or WhatsApp on any seeker-facing screen.** Ever.
2. **Saving a published listing says "sent for review", never "saved".**
3. **A 403 means unverified — route to `/verify`, never a generic toast.**
4. **A 422 message is copy. Show it verbatim.**
5. **No inspection date exists anywhere.** Do not render, compute or label one.

## 6. The API

Base URL lives in `app/src/environments/environment.ts` **and nowhere else** — the EC2 box
gets stopped to save money and comes back on a different address. If everything suddenly
fails to connect, that is the first thing to check: the box is off, and only the user can
`aws login` to start it.

Serve from `http://localhost:4200`. CORS admits that origin and no other; a different port
looks exactly like a broken app and is not one.
