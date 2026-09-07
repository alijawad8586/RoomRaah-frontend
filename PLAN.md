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
| H | Map view; responsive pass at four breakpoints; accessibility pass; final verify | 09 | 40m | yes |

| I | Audit pass: four things a route sweep found after the build read as done | — | 45m | yes |
| J | Map view without a landmark draws the map instead of a signpost | 09 | — | yes |
| K | Distance: nearest-first on pick, and compare carries the place | 07 13 | — | yes |

Final green run: guard clean, production build 366.23 kB initial, 130 unit tests passing,
and 45/45 live smoke steps passing. `npm run verify` remains the check.

### 3.1 What the audit pass found, and why the walk had missed it

Once every slice was marked done, a second script swept **every route as every role** —
anonymous, seeker, unverified seeker, owner, admin — watching for console errors, refused
requests, empty renders, slow pages and pages reachable only by typing a URL. That is a
different question from the one `tools/smoke.mjs` asks, which is whether the demo path
works, and it found four things the demo path never touches:

1. **An unverified account could not browse at all.** Every public page primes the
   shortlist, `GET /saved` answers 403 to an unverified account, and the interceptor treated
   *every* 403 as "go and verify" — so the landing page, search and every listing bounced
   straight to `/verify`. Brief §1.3 and rule 2 say the opposite, and the brief seeds an
   unverified account for a judge to try. Fixed in both places: the interceptor only
   redirects on a refused **write**, and the shortlist is not primed for an account that has
   none. `unverified-can-still-browse` walks it now.
2. **Compare had no way in.** The page worked, but its only link was on the shortlist, so
   anybody not signed in never saw the feature at all. `CompareStore` holds the selection,
   search cards carry a tick, a bar appears once something is chosen, and a listing has "Add
   to compare". Rule 11's cap of three is now visible rather than only enforced.
3. **The reviews page was unreachable by clicking.** Its only link was gated on "more
   reviews than are already shown", which on this data is never true.
4. **Rule 7 was left to the server.** A seeker holding an open request could open the form
   again and be refused at the end of it. The listing says so up front now, off a primed
   `/visits/my` — Seeker only, because that endpoint answers 403 to everybody else and an
   unasked-for 403 is a console error on a page that is working.

The lesson worth keeping: a walk that follows the happy path proves the happy path. It
cannot tell you a page is unreachable, because it goes there directly.

## 4. How the slices were run

Slices landed back to back in the ledger's order. Times were budgets, not estimates — when
one overran, the scope inside it was cut, not the clock, and the cut was said out loud.

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
