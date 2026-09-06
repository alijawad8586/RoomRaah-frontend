# RoomRaah frontend — agent rules

You are building the **Angular frontend** for RoomRaah. The backend is finished, deployed
and green (68 endpoints, 1412 passing tests). It is not yours to change.

Read this file first, every session. It is short on purpose. The detail lives in the
contract files named in §2 — this file only says what you must never get wrong and where
to look.

---

## 1. Where you work

This directory is the whole of your world, and the backend is not in it. There is no API
project here, no server source and no test suite for one — this workspace was written out
precisely so that the question never has to be asked.

```
.                    the repository root
  AGENTS.md          this file
  package.json       the guards — npm run guard, npm run guard:test
  tools/             the guard and its fixtures
  contract/          the brief, the OpenAPI description, the Postman collection
  app/               ← the Angular application: ng new, src/, angular.json
```

**The Angular application goes in `app/`** — generate it there
(`ng new roomraah --directory app`), because the `package.json` at the root holds the
guards and `ng new` at the root would overwrite it.

Your contract is the three files in `contract/`. They were written so that nobody has to
read the server to build this. If one of them does not answer a question, **say so and
stop** — do not guess, and do not go looking for a server that is not here.

If you believe the backend is genuinely wrong or missing something, **say so and stop**.
See §7.

---

## 2. Where the truth lives, in order

| File | Authoritative on |
|---|---|
| `RoomRaah.openapi.json` | **Shapes.** Generated from the running API. When it disagrees with prose, it wins. |
| `RoomRaah_Frontend_Brief.md` | **Behaviour.** Which rule refuses what, what a screen must not show, the twenty pages, the design system. |
| `RoomRaah.postman_collection.json` | Runnable examples, each annotated with the rule it demonstrates. |
| This file | What you must never do, and how to work. |

The brief is written so that **nobody has to read the backend**. If you find yourself
wanting to, the answer is in §8 of the brief or in the OpenAPI file.

---

## 3. Five things that are never negotiable

These are enforced by the API. A screen that disagrees is a broken screen, not a broken API.

1. **An owner's contact details never appear on any seeker-facing screen.** No phone
   number, no WhatsApp link, no email, no `tel:`, no `mailto:`, no "Call owner" button.
   There is nothing to put in one — on those screens the API does not return it. Contact
   happens through **messaging** and **visit requests**; that is the entire reason both
   features exist.

   The shape says it plainly: `ListingDetailDto.owner` is a `ListingOwnerDto` of
   `{ displayName, identityVerified, identityCheckedAt }`. Anything else you find yourself
   binding — `owner.phone`, `owner.email` — does not exist and was invented on the client.

   **One exception, and it is a required screen.** Business rule 116: `GET /admin/users/{id}`
   returns `phoneNumber`, and for an owner `cnicNumber`, and the Admin user detail page
   shows them. That is an admin looking at an account, not a seeker looking at a listing.
   The admin *list* (rule 117) carries an email address and neither of the other two.
   Nowhere else in the product carries any of the three.
   *Checked mechanically — see §6.*

2. **An owner never edits a published listing.** A save creates a **revision** that an admin
   approves. Your copy says *"sent for review"*, not *"saved"*, and the screen keeps showing
   the live values with the pending change beside them. Availability (free beds) is a
   separate, faster queue and gets its own action.

3. **Browsing is public; acting needs a verified account.** Anyone may search, open a
   listing, see photos and read reviews. Anything that writes needs a verified email. The
   API answers **403** — route the person to `/verify`, never a generic error toast.

4. **No screen ever shows a scheduled inspection date.** No such field exists anywhere in
   the product, by design. Do not add one, do not compute one, do not label anything
   "next inspection".

5. **English only.** Urdu is explicitly out of scope. No translation layer, no locale files,
   no i18n keys standing in for labels that only ever render in one language.

Twenty more interface rules are in **§10 of the brief**. Read them before building the page
they touch; they are the ones that look like bugs when the interface disagrees.

---

## 4. Decisions already made — do not revisit

- **Angular 22, standalone components, plain SCSS.** Current at the time of writing, and
  what `ng new` installs. This said 21 for a while, inherited from another project rather
  than chosen — if you find yourself pinning backwards to match a document, say so instead.
- **No Angular Material. No Tailwind. No component library.** This was decided, not
  overlooked. The shared components *are* the design system. *Checked mechanically — §6.*
- **Mobile first, four real breakpoints** — phone ≤640, tablet 641–1024, laptop 1025–1440,
  desktop >1440. Each is a design, not a squeeze. The brief §12 gives the shape of each.
- **Tokens:** deep navy `#123B5D` (trust), green `#16A36A` (confirmed), soft background
  `#F7F9FA`, typeface Inter.
- Because there is no component library, **you write the accessibility yourself**: focus
  trap and Escape on every dialog, `aria-label` on every icon-only button, visible focus,
  working keyboard navigation.
- Every reusable component needs loading, empty, success, error, selected, disabled and
  pressed states. Empty states matter more than usual — a new account has an empty
  shortlist, an empty inbox and no visit requests.

---

## 5. Build in this order

From §14 of the brief. It is an order, not a menu.

1. **Shared foundation** — SCSS tokens, buttons, fields, badges, property card, dialogs.
   Everything else is built from these; building them later means rewriting every page.
2. **Auth end to end** — register → read the code out of Mailpit → verify → login →
   interceptor → silent refresh → the four guards. Nothing else is testable until this works.
3. **Search, filters, property detail.** The largest surface, entirely anonymous.
4. **Seeker actions** — shortlist, visit request, review, report.
5. **Messaging** — REST first, the hub second. It must work without WebSockets.
6. **Owner dashboard and the listing form** — revision states and the photo flow. The
   fiddliest screen in the product.
7. **Admin panel**, five tabs.
8. **Responsive pass** at all four breakpoints, then the accessibility pass.

**Do not start page 1 before step 1 exists.** Twenty pages built on no design system is
twenty pages of one-off CSS, and the responsive requirement becomes unreachable.

---

## 6. Before you say a slice is done

```bash
npm run guard
```

Two rules are checked mechanically, because they are the two an agent drifts on. Three
scans, because each rule has more than one door:

- **`contact`** — no `tel:`, `mailto:`, WhatsApp link, "call owner" copy, hardcoded
  Pakistani number, or contact field hanging off an owner anywhere under
  `app/src` — dotted, optionally chained, indexed or camel-cased alike. This is
  rule 1 of §3. `phoneNumber` and `cnicNumber` are *not* matched, because rule 116's admin
  screen needs them.
- **`stack`** — no Angular Material and no Tailwind in `app/package.json`. §4.
- **`stack-imports`** — and none of them imported in the source either. A manifest is
  often a step behind what a component file has already decided.

The contact scan also flags an owner and a contact word **near each other on one line**,
because `owner.profile.phone`, `ownerInfo.phone` and `landlord.phone` are as likely as
`owner.phone` and none of them sits next to the word. It does not read comments, where a
proximity rule would only be guessing.

**If it is wrong, say so on the line rather than widening the rule.** The one case it
cannot judge is an owner filling in their *own* details — registration really does take a
phone number and a CNIC:

```html
<input formControlName="cnicNumber" />  <!-- guard:allow-owner-contact: the owner's own -->
```

That marker silences that one line. Use it where it is true and nowhere else: it is
greppable, and every use is a claim somebody can check.

**The guard is only as good as its fixtures, and that has already bitten once.** The first
version was green while six real leaks walked past it, including an owner's email rendered
onto the page — every fixture had been written as `ownerPhone`, and Angular writes
`listing.owner.phone`. If you widen a pattern, add the idiom to
`tools/fixtures/leaking-app/` in the spelling the framework actually produces.

Before the app exists both report **SKIPPED**, not PASS. A check that never ran is not a
check that passed, and the difference is itself covered by `guard:test`.

`npm run guard:test` proves the guard actually catches a violation rather than passing
vacuously. Run it if you change the guard.

A guard is a floor, not a ceiling. It cannot see a "Call owner" button that renders a
display name, or copy that says "Saved" when it should say "Sent for review". Those are on
you, and §10 of the brief is the checklist.

---

## 7. When something is missing

The brief is meant to be complete. If you need a field, an endpoint or a rule that is not
there:

1. **Check `RoomRaah.openapi.json`** — it has every shape, including ones the brief only
   summarises.
2. If it is genuinely absent, **it is a backend gap, not a licence to invent one.** Say what
   you need and stop. Do not mock it, do not fake a field, do not add a client-side
   workaround that hides the gap.

That is how the whole backend was built. Five rules that described impossible behaviour were
found by reading the document against itself *before* code was written, rather than after.

---

## 8. The API and the accounts

| | |
|---|---|
| API base | `http://52.72.119.254:8080/api/v1` |
| SignalR hub | `http://52.72.119.254:8080/hubs/chat` — **not** under `/api/v1`; build it from the origin |
| Mailpit (all outgoing email, including OTPs) | `http://52.72.119.254:8025` — your IP must be allowed first |

Plain HTTP, deliberately. Serve the dev app from `http://localhost:4200` — which `ng serve`
does anyway — and the mixed-content problem never arises. CORS already admits that origin
with credentials; a different port is a backend change, so ask rather than reaching for `*`
(a wildcard is not allowed alongside credentials and would break the hub).

**Set the base URL in `src/environments/environment.ts` and nowhere else.** The box gets
stopped to save money and may come back on a different address.

Every seeded account uses the password `Password1`. The ones that matter:

| Email | Use it for |
|---|---|
| `seeker1@roomraah.local` | A seeker with existing shortlist, visits, reviews, conversations |
| `seeker.unverified@roomraah.local` | **Building and testing the 403 path** |
| `owner.checked@roomraah.local` | The only owner whose listings can be published |
| `admin@roomraah.local` | Admin **with** `canInspect` — the badge screens |
| `admin2@roomraah.local` | Admin **without** it — check the inspection buttons are hidden |

Full list and the shape of the seed data: §3 of the brief.

---

## 9. Things that will bite you

The full list is §13 of the brief and it is worth ten minutes. The five that cost the most
time:

- The role claim key is the long URI `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`, not `role`.
- `email_verified` is the **string** `"true"`, not a boolean.
- **Two silent refreshes at once will race.** Queue 401s behind one in-flight refresh, and
  store the rotated refresh token or the next refresh fails.
- Photo upload is `multipart/form-data`, field name `file`. Do not set `Content-Type` by
  hand — let the browser set the boundary.
- **Deleting a photo from a published listing does not delete it.** It proposes a removal,
  and the photo stays public until an admin approves. Rule 2 again.

---

