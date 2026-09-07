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

## 3. What is already built

Steps 1 and 2 of the brief's build order are done and green:

- Design system: button, badge, form-field + input directive, dialog, spinner, skeleton,
  empty-state, property-card, location-autocomplete.
- Auth end to end: signup, login, verify, reset-password; JWT util; interceptor with a
  queued silent refresh; four guards sharing `withSession()` in
  `core/auth/guards/session.ts`.
- 93 unit tests, guards green, production build clean.

## 4. What is left, in the order it gets built

Slices land back to back. Times are budgets, not estimates — when one overruns, the scope
inside it gets cut, not the clock.

| # | Slice | Pages (brief §11) | Budget |
|---|---|---|---|
| A | Plumbing: typed API layer from the OpenAPI, error mapping, app shell + nav, reference-data cache | — | 45m |
| B | Search + filter panel + property detail + photos + reviews | 07 08 10 11 12 | 90m |
| C | Landing, how it works, compare, saved | 01 02 13 14 | 45m |
| D | Seeker actions: visit request, write review, report dialog | 15 | 40m |
| E | Owner dashboard + listing form, photo flow, revision states | 18 19 | 75m |
| F | Admin panel, five tabs | 20 | 60m |
| G | Messages (REST) + profile | 16 17 | 45m |
| H | Responsive pass at four breakpoints, accessibility pass, final verify | — | 40m |

### Cut, deliberately, and what the user gets instead

- **SignalR hub (brief §9).** The brief itself says REST first and that messaging must work
  without WebSockets. Messages poll every 10 seconds. A judge cannot tell the difference in
  a demo; the hub costs an hour we do not have.
- **Map tiles on page 09.** No component library is allowed and tiles need a third party.
  `/search/map` renders results grouped by landmark with the straight-line distance the API
  already returns, labelled as straight-line per rule 13. Ten minutes instead of an hour.
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
