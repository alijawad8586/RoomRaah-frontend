# RoomRaah frontend workspace

The Angular application is not written yet. This directory is the prepared ground for it:
the rules an AI agent must follow, and guards that fail when it drifts from them.

## What is here

| Path | What it is |
|---|---|
| `AGENTS.md` | **The rules file.** Read by Antigravity, Gemini CLI, Cursor, Codex and Claude Code. Five non-negotiable product rules, the decisions already made, the build order, and where the truth lives. |
| `CLAUDE.md` | A pointer to `AGENTS.md`, so Claude Code loads the same rules. |
| `package.json` | The guards. Nothing else — the Angular app has its own manifest. |
| `tools/check-rules.mjs` | The mechanical guards — contact, stack, stack-imports. |
| `tools/check-rules.test.mjs` | Proves the guards catch a violation rather than passing vacuously. |
| `tools/export-workspace.test.mjs` | Proves the export refuses a destination inside the repository — on both path shapes, because the first version was dead on Windows. |
| `tools/fixtures/` | A correct app and a leaking one. Each guard rule has to trip on the leaking fixture and stay quiet on the clean one. |
| `tools/export-workspace.mjs` | Copies this workspace plus the three contract files into a standalone directory, for handing an agent the frontend without the backend at all. |
| `app/` | The Angular application, once generated. Does not exist yet. |

## Start here

```bash
cd frontend
npm run guard:test     # 27 tests — proves the guards work
npm run guard          # SKIPPED until app/ exists, then real
```

Then generate the application **into `app/`**, not into `frontend/`:

```bash
npx @angular/cli@21 new roomraah --directory app --style scss --routing --ssr false
```

`ng new` at `frontend/` would overwrite the `package.json` that holds the guards.

## The guards

Two rules are checked mechanically, because they are the two an agent drifts on and neither
is visible in a diff until somebody opens the page.

**`contact`** — scans `app/src` for `tel:`, `mailto:`, WhatsApp links, "call owner" copy,
hardcoded Pakistani mobile numbers, and any contact field hanging off an owner, in every
spelling: `owner.phone`, `owner?.email`, `owner['phone']`, `ownerPhone`, `owner_phone`.
A listing's owner is `{ displayName, identityVerified, identityCheckedAt }` and nothing
more, so a contact field on the client was invented there. This is the product's first
rule: contact stays on the site, through messaging and visit requests.

`phoneNumber` and `cnicNumber` are deliberately **not** matched. Business rule 116 has the
Admin user detail screen show both, and a guard that blocks a required screen is a guard
somebody switches off.

It also flags an owner and a contact word **near each other on one line** —
`owner.profile.phone`, `ownerInfo.phone`, `landlord.phone` — because none of those sits
next to the word and all of them are as likely as `owner.phone`. It skips comments,
where a proximity rule is only guessing, and one line can opt out with a visible
`guard:allow-owner-contact` marker for the case it genuinely cannot judge: an owner
filling in their own registration details.

**`stack`** — refuses `@angular/material`, `@angular/cdk` and `tailwindcss` in the app's
manifest.

**`stack-imports`** — and refuses them in the source too, including `@tailwind` directives
in SCSS. A manifest is often a step behind what a component file has already decided. All
three were rejected deliberately in favour of a hand-written SCSS design system; all three
are what a model reaches for out of habit.

### The guard was wrong once, and that is why the fixtures look like this

The first version of `contact` was green while six real leaks walked past it — an owner's
email rendered onto the page, `href="tel:{{ listing.owner.phone }}"`, a Material import —
because every fixture had been written as `ownerPhone` and Angular writes
`listing.owner.phone`. The pattern allowed no dot; `tel:` demanded a digit immediately
after the colon, which template interpolation never puts there.

A fixture only proves the guard catches what somebody already thought of. If you widen a
pattern, add the idiom to `tools/fixtures/leaking-app/` in the spelling the framework
actually produces.

Before `app/` exists the guards report **SKIPPED**, not PASS. A check that never ran is not
a check that passed — and `guard:test` asserts that distinction, so the skip cannot quietly
become a green tick.

**CI runs both on every push and pull request touching `frontend/`**
(`.github/workflows/frontend-guards.yml`). The agent most likely to break one of these
rules is exactly the one least likely to remember the command that checks it.

A guard is a floor. It cannot see copy that says "Saved" where the API only accepted a
revision, or a screen that shows an inspection date. §10 of the brief is the checklist for
those, and it is on the reviewer.

## Handing the work to an agent

**Export a standalone workspace and point the agent at that.** There is one way, because
the other one was never trustworthy.

The rejected way was an ignore file — `.geminiignore`, `.antigravityignore` — asking the
tooling not to look at the backend. Those existed here and have been removed. An ignore
file is a request, not a boundary: whether it is honoured varies by tool and by version,
it fails silently when it is not honoured, and nothing on screen tells you which happened.
A boundary you cannot verify is not a boundary.

An export cannot fail that way. The backend is not in the directory.

**Or export a standalone workspace**, which contains no backend source at all:

```bash
node tools/export-workspace.mjs ../roomraah-frontend
```

That directory holds `AGENTS.md`, the guards, and the three contract files — the brief, the
OpenAPI description and the Postman collection. It is everything needed to build the
frontend and nothing that is not. Open *that* in the agent.

## The contract

Three files at the repository root, in this order of authority:

1. **`RoomRaah.openapi.json`** — authoritative on shapes. Generated from the running API.
2. **`RoomRaah_Frontend_Brief.md`** — authoritative on behaviour: which rule refuses what,
   what a screen must not show, the twenty pages, the design system.
3. **`RoomRaah.postman_collection.json`** — runnable examples, each annotated with the rule
   it demonstrates.

The brief was written so that nobody building the frontend has to read the backend. If
something is missing from it, that is a gap to report — not a licence to invent a field.
