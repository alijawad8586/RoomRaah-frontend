# RoomRaah — Progress Log

## The frontend workspace, before the first page

The frontend is the only thing left, and it will be built largely by an AI agent. That is a
decision about *who types*, not about what gets checked — so the work here was to make the
rules mechanical wherever they can be, and written down where they cannot.

**`frontend/AGENTS.md` is the rules file**, read by Antigravity, Gemini CLI, Cursor, Codex
and Claude Code alike. One file rather than one per tool, because rules that live in four
places drift in four directions. It holds five non-negotiables — no owner contact anywhere,
a save is a revision and the copy must say so, browsing is public but acting needs a
verified account, no screen ever shows an inspection date, English only — then the decisions
already made (Angular 21, standalone, plain SCSS, no Material, no Tailwind, four real
breakpoints), the build order from §14 of the brief, and the twenty-item checklist's
address. It does not repeat the brief. Two copies of a contract is one contract and one
lie waiting to happen.

**Two rules are now checked by a script rather than by hope.** `frontend/tools/check-rules.mjs`
scans for the owner-contact leak — `tel:`, `mailto:`, WhatsApp, "call owner" copy, a
hardcoded Pakistani mobile number, or any `owner*` contact identifier — and refuses
`@angular/material`, `@angular/cdk` and `tailwindcss` in the app manifest. These two were
chosen because they are the two a model drifts on: the first is the product's oldest rule
and the API returns no field that could satisfy a call button, so anything the client shows
was invented there; the second is a habit that arrives with the model rather than with the
requirement.

**The guard has fixtures on both sides.** A clean app that must pass and a leaking one that
must trip every rule the guard claims to enforce — `check-rules.test.mjs` names the rules
in a list and asserts each one caught something, so a rule added without a fixture stops the
suite rather than sitting there enforcing nothing. The clean fixture also carries a
`phoneNumber` on the register form, which is the seeker's own and legitimate: a guard that
flagged it would be trained around within a day.

**Scanning nothing reports `SKIPPED`, never `PASS`.** Before `frontend/app` exists there is
no source to read, and a green tick for a check that never ran is the exact failure mode the
probe rule in `CLAUDE.md` describes. The distinction is asserted rather than assumed.

**The Angular application goes in `frontend/app`**, not in `frontend`. `ng new` writes a
`package.json`, and at `frontend` it would overwrite the one holding the guards — silently,
and only noticed the first time somebody wondered why nothing was being checked any more.

**Two ways to hand the work over, and the second is the safer one.** `.geminiignore` and
`.antigravityignore` hide the four backend projects, `tests/` and the backend-only documents
from Google's tooling while leaving the three contract files visible. That is a convenience
and is written down as one: at the time of writing not every Antigravity build honours those
files. `tools/export-workspace.mjs` is the real answer — it copies the rules, the guards and
the brief, OpenAPI description and Postman collection into a directory outside the
repository, containing no backend source at all, and refuses a target inside the repository
because an export that can still reach the backend is not an export.

**Tested — 7 green, and verified by watching them fail.** The guard was run against both
fixtures rather than trusted: eleven violations found in the leaking one with file and line,
nothing in the clean one, and the export re-run and its copy's suite run in place.

### Review, and the guard was letting six leaks through

The guard was reviewed by running it rather than by reading it, and a probe written in the
idioms Angular actually produces passed clean. All six of these:

```
{{ listing.owner.email }}                          an owner's email, on the page
href="tel:{{ listing.owner.phone }}"
[href]="'tel:' + listing.owner.phone"
{{ owner?.contactNumber }}
owner['phone']
import { MatButtonModule } from '@angular/material/button'
```

**The cause was the fixtures, not the patterns.** Every fixture had been written as
`ownerPhone`, so the pattern only had to allow `owner`, an optional `_` or `-`, and the
word. But `ListingDetailDto.owner` is a **nested object** — `ListingOwnerDto` of
`{ displayName, identityVerified, identityCheckedAt }` — so `listing.owner.phone` is the
*most* likely spelling of this mistake, not an exotic one. `tel:` demanded a digit
immediately after the colon, which template interpolation never puts there. And Material
was checked in `package.json` only, never in an import.

A fixture only ever proves the guard catches what somebody already thought of. All six are
now permanent fixtures, each asserted by name so that a future loosening says *which* idiom
it stopped catching rather than only that a count moved.

Widening the pattern taught one more thing: `owner?.contactNumber` still escaped, because
the word boundary after `contact` refused a suffix. `phone`, `mobile`, `email`, `whatsapp`
and `contact` are contact words with or without a suffix; `number` alone is not, so it keeps
its boundary and `owner.numberOfListings` stays clean.

**The export's one refusal was dead on Windows.** `destination.startsWith(REPO + '/')` —
`resolve()` on Windows returns `C:\...\RoomRaah\exported`, which never starts with
`C:\...\RoomRaah/`. The check that exists to stop an export reaching the backend allowed
exactly that, on the operating system this repository is developed on. Now `path.relative`,
with both path shapes asserted, and the predicate lifted out of the top-level script so it
can be tested without running the copy.

**`AGENTS.md` contradicted business rule 116.** It said an owner is a display name and a
verdict "and nothing else", and that the API does not return contact details. `AdminUserDto`
carries `phoneNumber` and `cnicNumber`, and the Admin user detail page is required to show
them. An agent believing the absolute version would have omitted required fields or stopped
to ask. The rule is now stated as it actually is — never on a seeker-facing screen, once on
an admin screen — and the guard deliberately does not match those two field names, because a
guard that blocks a required screen is a guard somebody switches off.

**Nothing ran the guard.** No CI, no hook. The agent most likely to break one of these rules
is exactly the one least likely to remember the command that checks it, which made the guard
documentation with a shell prompt in front of it. `.github/workflows/frontend-guards.yml`
now runs the self-test and the guard on every push and pull request touching `frontend/`.

**Tested — 17 green** (12 guard, 5 export), and the original probe re-run: **0 violations
before, 9 after.**

### The ignore files are gone, and the export is now a repository

`.geminiignore` and `.antigravityignore` have been deleted, along with every reference to
them. They were the wrong shape of thing. An ignore file is a *request*: whether it is
honoured depends on the tool and the version, it fails silently when it is not, and nothing
on screen says which happened. A boundary you cannot verify is not a boundary — and the
argument about which Antigravity build respects which file was never worth having, because
the answer does not change what an agent can reach.

The frontend workspace becomes **its own repository** instead. That is a real boundary: the
backend is not in the directory, so no tool setting, version or code path can reach it.

**`tools/export-workspace.mjs` now writes something ready to be that repository** rather
than a folder of files. It emits a `.gitignore`, its own CI workflow with root-relative
paths (the in-repo one filters on `frontend/**`, which matches nothing once the frontend is
the root), and prints the `git init` line.

**Three things were still pointing back at the backend, and each was found by looking
rather than by assuming.**

`AGENTS.md` §1 has to name `RoomRaah.Domain/`, `RoomRaah.API/` and the rest to say they are
off limits — correct inside this repository, and in an export it is a *map to what was left
behind*. §1 now sits between `<!-- layout:begin -->` markers and the export swaps in a
version describing the layout that actually exists. Four more path references outside that
block — `cd frontend && npm run guard`, `frontend/app/src`, `frontend/app/package.json`,
`frontend/tools/` — were one directory too deep, and a test naming each is what found them.

The brief told the reader how to run the backend locally: `docker compose up -d`,
`dotnet run --project RoomRaah.API`. Useful next to the backend, an instruction to go and
find one anywhere else. That section is now marked and the export replaces it with the
deployed API and "say so and stop".

And the export script itself was travelling inside its own output — a script whose entire
job is to reach one directory up into the backend repository. It no longer ships.

**Removing it broke the exported `guard:test`, and the way it broke is the point.** The
manifest names its test files one by one, and one of them no longer existed. Node's test
runner does not fail on a file it cannot find: it ran the other twelve and exited zero. The
exported workspace had a green `guard:test` running twelve tests where the repository runs
twenty-four — the same silent green that the SKIPPED-is-not-PASS rule exists to refuse,
arriving through the manifest instead of the guard. The export now rewrites the script, and
a test asserts every file the exported manifest names is in the export.

One thing deliberately left alone: the OpenAPI description carries a few fully-qualified
type names like `RoomRaah.Application.DTOs.MessageDto` inside prose generated from XML
documentation. Those name a type, not a path — nothing can be opened from them — and
rewriting a generated contract to tidy its prose is a worse trade than reading it.

**Tested — 24 green** (12 guard, 12 export), and the exported workspace verified in place:
no backend path, command or project name anywhere in it, its own guard and suite running
where it stands.

### The last gap in the contact guard, and why it needed an escape hatch

The tight patterns want the contact word next to the owner. Put one token in between and
they see nothing — and `owner.profile.phone` is not an exotic spelling, it is what you
write the moment an owner has a profile object. Five more walked past: `ownerInfo.phone`,
`ownerProfile.emailAddress`, `listing.owner.cnicNumber`, `landlord.phone` (the synonym a
model reaches for after being told not to say owner) and `Helpline +92 42 111 222 333`,
because the number pattern only knew mobiles.

A proximity rule catches all six, and **the first thing it caught was the fixture comment
explaining it** — "not an owner's, so the contact guard must not flag it" puts an owner and
a contact word four words apart. So the broad rule does not read comments, tracked with a
small state machine rather than a per-line test, because the middle line of a block comment
carries no marker and is where a sentence usually lands. The tight rules still read them: a
commented-out `owner.phone` is somebody's intent.

**And it has an escape hatch, deliberately.** The guard cannot tell a seeker looking at an
owner from an owner filling in their own registration form, and registration really does
take a phone number and a CNIC. A rule with no way to say "this one is fine" is a rule that
gets deleted the first time it is wrong, which costs more than every false positive it ever
caught. One line may opt out with a visible `guard:allow-owner-contact` marker — greppable,
and every use is a claim somebody can check. A test proves the marker is load-bearing: the
same line without it is a finding.

The broad rule also drops the word boundary after the owner token, because `\bowner\b`
refuses `ownerInfo` and `ownerProfile` — the wrapper objects the gap was made of. The cost
is named rather than hidden: a line carrying `ownerDisplayName` and somebody else's `email`
within forty characters will fire, and the marker is the answer.

**Tested — 27 green.** The exported workspace runs 15 of them where it stands, which is all
of the guard's own and none of the exporter's, and the exporter is not in it.

## Frontend — public catalogue (2026-09-07, 15:35)

Built in `roomraah-frontend`, commit `ced87fa`, pushed to
`https://github.com/Abdulrafay411/RoomRaah-front-end-`.

- **Pages:** landing (featured + search box), how it works, search with the full filter
  set, property detail, the photo gallery and the reviews page. Filters round-trip through
  the query string, so a filtered search is shareable and the back button works.
- **Plumbing:** `core/models/catalog.model.ts` (shapes and the three filter combinations
  the API answers 400 to), `core/http/api-error.ts` (a 422 sentence is shown verbatim; a
  403 for an unverified email is separated from a 403 for the wrong role),
  `ReferenceService` (cities, areas, facilities, suggest — each fetched once and shared),
  `PropertyService`.
- **`npm run verify`** is the new answer to "is it fine?": guard, production build, unit
  tests, then Chrome walking fourteen steps against the live API. 14/14, 38s. It found
  three defects while being written — a wrong password that showed nothing, a doomed areas
  request from a hand-edited city id, and the unhandled error that came out of it.
- Deadline note: the API box was stopped and was started again (`i-0756adef964b53420`,
  Elastic IP held, so `52.72.119.254` is unchanged).

**Still to build:** seeker actions (shortlist, visit, review, report), messaging, the owner
dashboard and listing form, the admin panel's five tabs. Plan and budgets in
`roomraah-frontend/PLAN.md`.

## Frontend — seeker actions and compare (2026-09-07, 16:05)

Slices C2 and D. Everything a seeker can do to a listing rather than just look at it.

- **Shortlist.** `EngagementService` keeps the saved ids in a signal, primed once per
  session, so any card anywhere renders its own state without re-reading the list. One
  `toggle()` handles the three cases every save button shares: signed out goes to sign in
  and back, unverified goes to `/verify` (rule 3, never a toast), otherwise save or unsave.
  Wired into the search grid, the landing strip, the listing page and `/saved`.
- **`/saved`** (page 14). A listing that leaves the site drops out while its row survives,
  so removing still works on something no longer visible.
- **`/compare`** (page 13). Ids in the query string so a comparison survives being pasted.
  Capped at three where the URL is read, because the fourth id is a 422.
- **`/property/:id/visit`** (page 15). The date picker is given `min` and `max` from the
  server's window — future, at most 60 days — and the same window is checked again before
  sending, because the attributes are advisory in some browsers.
- **`/visits`.** The seeker's own requests, with buttons that follow the state machine:
  cancel from Requested or Accepted, complete from Accepted and only once the time has
  passed, review once Completed. This page exists because completing a visit is what
  unlocks writing a review — without it that whole feature is unreachable.
- **`/property/:id/review`.** The success screen says the review is waiting for approval,
  so the author does not refresh, fail to find it, and write it again.
- **Report dialog** on the listing itself, not a page. Says plainly that a report does not
  take a listing down on its own.

Owner contact appears nowhere in any of it; the smoke walk checks the rendered page.

`npm run verify`: guard clean, production build clean, **109 unit tests across 20 files**,
**24/24 smoke steps**. Ten new steps, added in this commit with the pages they cover —
including one that asserts the visit picker's window is inside what the server accepts.

## Frontend — owner dashboard and listing form (2026-09-07, 16:55)

Slice E, pages 18 and 19. The fiddliest screens in the product.

- **`/owner`.** Listings with only the actions their status allows — submit from Draft or
  ChangesRequested, "beds are still right" and inspection requests on Published. Visit
  requests beside them: accept, decline (with the note rule 89 requires, enforced before
  the request goes out), and mark done once the time has passed.
- **`/owner/listing/:id` and `/new`.** The rule that shapes it: an owner never edits a
  published listing directly. On Published the button says "Send changes for review" and a
  banner says the live listing will not move; on PendingReview the form is read-only rather
  than offering a save that could only 422. What the owner is told afterwards comes from
  `pendingRevision` on the response, not from the status the form was loaded with.
- **Photographs.** On a published listing an upload is a proposal — the new photo comes
  back `PendingAdd` and is drawn dashed. Only live ones count towards the three a
  submission needs. Type and size are checked before the upload leaves.
- **Leaflet + OpenStreetMap** for the coordinate pin, which the brief names by name. This
  un-cuts the map view (page 09), now folded into slice H. Leaflet is imported by path, not
  through the shared barrel: the barrel reaches the app shell, and going through it put
  150kB of map into the initial bundle.

Two things the guard and the smoke walk caught, neither of which a person would have:

1. The guard read `OwnerProperty ... number` on one line as an owner contact field — a
   false positive from its 40-character window. Renamed the types to `MyListing` and
   `ListingPhoto` rather than suppressing the rule; the names are more accurate anyway.
2. `GET /owner/properties` answers with a *summary* — no photos, no facilities, no
   coordinates. Modelling it as the detail shape threw on every dashboard row. Split into
   `MyListingSummary`, and `submitProblem` now takes a count so both screens can ask it.

`npm run verify`: guard clean, build clean, 109 unit tests, **27/27 smoke steps**.

## Frontend — messaging on the hub, and the account page (2026-09-07, 17:30)

Slice G, pages 16 and 17. Frontend commit `53ddecb`.

**The SignalR cut is reversed, and the cut was wrong on its own terms.** It had been
costed at "an hour we do not have" — but the hub was already built and integration-tested
here months of work ago: `/hubs/chat`, `ChatHub`, `IRealtimeNotifier`, the `access_token`
query-string read for that path, `ChatHubTests`. The frontend only ever needed a client.

It also mattered more than the cut assumed. The server emails a "you have a new message"
nudge to anybody it cannot push to, so a polling-only client means every message sends an
email instead of lighting a badge — visible in a demo only as an inbox nobody opens, but
wrong.

- **`RealtimeService`** holds one connection for as long as somebody is signed in, and is
  injected in the app shell rather than on the messages page for exactly that reason.
  `@microsoft/signalr` sits behind a dynamic `import()`, so it lands in its own chunk: the
  initial bundle moved 352.77 → 354.90 kB rather than by the weight of the client. Nothing
  in it throws — every failure path ends in `connected` being false and the page falling
  back to polling, because the brief requires messaging to work without WebSockets.
- **`/messages`.** Conversation list beside the open thread, with the thread id in the
  query string so a thread is a link and the back button steps between them — the same
  choice the search page makes about its filters.
- **The bug this feature is prone to, and the test for it.** The hub pushes a message and
  the poll fetches the same message a few seconds later; appending both draws the bubble
  twice, which reads as broken even though nothing is. Both channels feed `upsertMessage`,
  which is keyed on the message id. The smoke walk sends a message, waits out a poll, and
  fails if it was drawn more than once.
- **`/profile`.** Shows what the session already holds. There is no `GET /auth/me` and no
  endpoint that edits an account, so a screen of fields that cannot be saved would have
  been a lie. Changing a password goes through the forgot-password flow, which is the only
  route the API has for it.
- **"Message the owner"** on the listing page — the one door into messaging, since a seeker
  opens a thread and nothing else in the product can.

`npm run verify`: guard clean, build clean, 123 unit tests, **32/32 smoke steps**. The hub
connected against the deployed API during the walk — the page's own indicator read "Live".

## Frontend - admin operations (2026-09-07, 19:25)

Slice F, page 20. Frontend routes share one admin shell and keep all five queues
bookmarkable: `/admin/listings`, `/admin/revisions`, `/admin/reports`,
`/admin/inspections` and `/admin/users`.

- Listings expose the full review, all five verification checks, the server's `canPublish`
  decision, approve/request-changes/reject, and the separate unpublish action.
- Revisions preserve the Content/Availability split in the URL. Content shows the
  before-and-after diff; Availability keeps its one-click approval path.
- Reports carry the required verdict note and explicitly say that upholding does not
  unpublish. Review moderation shares this operational tab so its API is not orphaned.
- Inspection recording and badge grants render only for an admin with `canInspect`; badge
  removal remains available to every admin. Both date inputs refuse the future and no
  scheduled inspection date exists.
- The user list deliberately uses a summary without identity fields. The detail call is
  the one rule-116 exception; it is never cached, logged or screenshotted. Controls are
  hidden for the current admin and for every other admin.

The placeholder admin page was removed. `npm run verify`: contact/stack guards clean,
production build 362.96 kB initial, 126 unit tests, and **39/39 live smoke steps**. The
smoke walk includes the non-inspector permission case and waits for the final revision
queue rather than accepting stale DOM from the previous filter.

## Frontend - map, responsive and accessibility final pass (2026-09-07, 20:24)

Slice H, page 09, and the final product-wide interface pass.

- **`/search/map`.** Uses the existing search query string and calls the public property
  search with the selected `landmarkId`. No place selected produces a useful route back to
  search rather than a dead map. Up to 50 matching rooms render as Leaflet markers and as
  an equivalent keyboard-accessible list; selecting a row moves to a street-level view.
- **Four real breakpoints.** Phone is one column with fixed bottom navigation and a
  full-height filter slide-over; tablet uses a two-column grid and collapsible filters;
  laptop uses three columns with persistent filters; desktop is capped and gives the map
  and list separate columns.
- **Accessibility.** Global visible focus and reduced-motion behavior were added. The live
  walk now rejects horizontal overflow, duplicate ids, missing image alternatives, unnamed
  controls, unlabelled fields and pages without exactly one `h1`. It found and fixed the
  not-found page's missing `h1`; its stale Home link also now goes home rather than to the
  design-system route.
- **Permanent verification.** Representative public, seeker, owner and admin screens are
  resized across phone, tablet, laptop and desktop during every smoke run. Map screenshots
  are saved at all four widths without tying selectors to CSS classes that a later visual
  restyle may replace.

Final `npm run verify`: contact/stack guards clean, production build clean at 364.90 kB
initial, **126 unit tests**, and **41/41 live smoke steps**. All frontend slices are complete.

---

## Frontend — the audit pass (2026-09-07, 22:10)

Every slice was already marked done and `npm run verify` was green at 41/41. A second,
separate script was then written to ask a different question: it swept **every route as
every role** — anonymous, seeker, unverified seeker, owner, admin, about ninety page loads —
watching each one for console errors, refused requests, empty renders, pages still spinning
after the network settled, owner-contact leaks and anything slower than four seconds. It
also built the link graph each role can actually click, so a page reachable only by typing
its URL shows up as what it is.

The smoke walk had missed all four of the things it found, and for one reason: a walk that
follows the happy path proves the happy path. It cannot notice that a page is unreachable,
because it navigates there directly.

- **An unverified account could not browse at all.** The landing page, search and every
  listing prime the shortlist; `GET /saved` answers 403 to an unverified account; and the
  interceptor treated every 403 as "go and verify". The result was an account that got
  dragged to `/verify` from every public page it opened — the exact opposite of brief §1.3
  and rule 2, on the account the brief seeds for a judge to try. The interceptor now
  redirects only on a refused **write**, and the shortlist is not primed for an account that
  cannot have one.
- **Compare had no way in.** Page 13 worked and was covered by three smoke steps, all of
  which opened it by URL. Its only link in the whole interface was on the shortlist, behind
  sign-in and behind having saved two rooms, and it chose the first three for you. There is
  now a `CompareStore` holding the selection, a tick on every search card, a bar that
  appears once something is chosen, and an "Add to compare" on the listing itself. Rule 11's
  cap of three is visible in the interface rather than only enforced in the URL parser.
- **The reviews page could not be reached by clicking.** Its only link appeared when there
  were more reviews than the listing already showed, which on this data is never.
- **Rule 7 was left to the server.** A seeker with an open request on a listing could open
  the form and be refused at the end of it. The listing now says so first, from a primed
  `/visits/my` — Seeker only, because that endpoint answers 403 to an owner or an admin and
  an unasked-for 403 is a console error on a page that is working perfectly. That regression
  was caught by re-running the sweep after the fix, which is the point of having it.

Four new smoke steps were added in the same commit — `compare-picked-from-search`,
`reviews-page-is-linked-from-a-listing`, `a-room-you-already-asked-to-visit-says-so` (which
creates its own open request and cancels it again, so it behaves the same on every run) and
`unverified-can-still-browse`.

Final `npm run verify`: guards clean, production build clean at 366.23 kB initial (+1.33 kB),
**130 unit tests**, **45/45 live smoke steps**. The independent sweep reports zero findings
across every route for every role.

---

## Frontend — "Map view" opened a page with no map (2026-09-07)

Reported by clicking, which is exactly how a judge would find it: press **Map view** on
`/search` and the map never appears.

The cause was a hard gate. `/search/map` treated a missing `landmarkId` as "this page cannot
work" — it skipped the fetch, skipped `L.map()` entirely, and rendered a signpost back to
search instead. But a landmark is only required by two of the search parameters: brief §
"`maxDistanceKm` **without** `landmarkId` is a 400. So is `sort=Distance` without one."
The listing search itself is happy without one, and the map view's only *own* requirement
(brief page 09) is that it calls `properties`. The component was sending
`sort: filters.sort ?? 'Distance'` unconditionally, so it would have 400'd without the gate —
and the gate, rather than the sort, is what got fixed first and then never revisited.

- The gate is gone. The map is built and the results are fetched on every visit.
- `maxDistanceKm` and the `Distance` sort default are applied **only** when a landmark is
  present, which is what made the gate look necessary.
- The signpost survives as a banner *above* a working map — "Pick a university or workplace
  to see distances" — so the feature it points at is still discoverable, and the page header
  no longer claims distances are being measured when none are.
- Smoke step `map-search-needs-a-place` became
  `map-search-without-a-place-still-draws-the-map`: same banner assertion, plus the Leaflet
  canvas and the equivalent list must both render.

Verified in real Chrome: `/search/map` with no query string draws 21 tiles, 8 markers and 8
list rows. `npm run verify` green — guard clean, production build clean, unit tests passing,
**45/45** live smoke steps.

The lesson is the same shape as the audit pass's: the walk asserted the signpost, so the
signpost was "working". Nothing asked whether the page a button leads to does the thing the
button is named after.
