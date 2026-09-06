# RoomRaah — Frontend Brief

**Everything the Angular application needs, so that nobody has to read the backend.**

This document and the two files beside it are the whole contract. If something you need is
not here, it is a gap in this document rather than something to guess at — say so, and it
gets written down rather than invented at the keyboard.

---

## 0. What you have been given

| File | What it is |
|---|---|
| `RoomRaah_Frontend_Brief.md` | This document. The contract, the rules and the pages. |
| `RoomRaah.openapi.json` | The complete OpenAPI 3 description of all 68 endpoints and 83 schemas, exported from the running API. Machine-readable: point a client generator at it, or read it directly. |
| `RoomRaah.postman_collection.json` | The same endpoints as a runnable Postman collection, with the auth wired up and every request annotated with the rule it demonstrates. |

**When the two disagree, `RoomRaah.openapi.json` is right about shapes** — it is generated
from the code. This document is right about *behaviour*: which rule refuses what, what a
screen must not show, and why.

Everything below was captured from the API actually running, not written from memory.

---

## 1. The product, and the three rules that shape every screen

RoomRaah helps people in Pakistan find rooms, hostel beds and shared accommodation. Three
kinds of person use it: a **seeker** looking for a room, an **owner** listing one, and an
**admin** who checks that a listing is real before anybody sees it.

Three product decisions shape almost every screen you will build. They are not
suggestions — the API enforces all three, and a design that fights them will simply fail.

### 1.1 An owner's contact details never appear. Anywhere.

There is no phone number, no WhatsApp link and no email address for an owner in any
response the product gives — not in search, not on a listing, not in a review, not in a
visit request, not in a message. **Do not build a "call owner" button, because there is
nothing to put in it.**

What replaces it: in-app **messaging** and **visit requests**. That is the whole reason
both features exist. An owner is identified by a display name, an identity-check verdict
and the date of that check, and by nothing else.

*(There is exactly one exception in the entire product: the admin user detail screen,
which shows a phone number and — for an owner — a CNIC, so that the admin recording an
identity check can see the identity being checked. It is described in §8.11.)*

### 1.2 An owner never edits a published listing directly.

Editing a listing that is live creates a **revision**, which an admin has to approve before
anything changes on the site. The live listing is untouched until then.

This changes your copy and your UI states: after a successful save the owner has **not**
saved anything, they have **submitted a change for review**. Say that. Show the pending
revision. A screen that says "Saved" and then shows the old values looks broken, and it is
your screen that is wrong, not the API.

Availability — the free-bed count — goes into a **separate, faster queue** from everything
else, because re-confirming "two beds free" should not wait behind a price change.

### 1.3 Browsing is public; acting needs a verified account.

Anyone can search, open a listing, see its photos and read its reviews with no account at
all. Everything that creates a record — saving, messaging, requesting a visit, writing a
review, reporting — needs an account **whose email has been verified**.

An unverified account can sign in and browse. It just cannot act. When it tries, the API
answers **403**, and your job is to route the person to the verification screen rather than
show them a generic error.

---

## 2. Getting the API running

**There is a deployed one already, and you do not have to run anything to use it.**

| | |
|---|---|
| **API base path** | `http://52.72.119.254:8080/api/v1` |
| **SignalR hub** | `http://52.72.119.254:8080/hubs/chat` |
| **Mailpit (all outgoing email)** | `http://52.72.119.254:8025` |
| **Swagger UI** | not exposed on the deployment — use `RoomRaah.openapi.json` |

Three things to know about it before you build against it.

- **It is plain HTTP, not HTTPS.** That is deliberate for a test deployment, and it has
  one consequence you will meet: a browser will not let a page served over `https://`
  call an `http://` API. Serve your dev app from `http://localhost:4200`, which is what
  `ng serve` does anyway, and it is a non-issue.
- **Mailpit needs your 52.72.119.254 allowed** before it will open. Send your public address (from
  `curl https://checkip.amazonaws.com`) to whoever set the box up. Everything else —
  the API and the hub — is open.
- **The data is seeded and shared.** You and anyone else testing are looking at the same
  database, so a listing you approve stays approved. If it drifts too far from the
  document, ask for a reset rather than working around it.

Set the base URL in one place — `src/environments/environment.ts` — and never anywhere
else. It will change: the box gets stopped to save money, and it may come back on a
different address.

### Running the API

You do not, and cannot from here: this workspace holds no server source. Use the deployed
API whose address is in the table above. If it is unreachable, **say so and stop** — that
is somebody else's repository to fix.


**Every email the product sends goes to Mailpit**, including the sign-up verification codes
and the password-reset links. That is where you read the OTP during development — there is
no way to get it out of an API response, by design.

The database builds itself from the migrations on first run and seeds itself with realistic
data. Nothing to import.

### CORS

The API already allows `http://localhost:4200` with credentials, which is the Angular dev
server's default, and that holds for the deployed one too. If you run on a different port,
or you deploy the frontend somewhere, that is a configuration change on the backend — ask
for it rather than working around it.

Do not expect a wildcard to be the answer if you ask. SignalR's negotiate step sends
credentials, and a wildcard origin is not allowed alongside them, so the allowed origins
are named one by one on purpose. Reaching for `*` would break live messaging and nothing
else, which is a miserable thing to have to trace.

---

## 3. Accounts you can sign in with

Every seeded account uses the password **`Password1`**.

| Email | Role | Why this one exists |
|---|---|---|
| `seeker1@roomraah.local` | Seeker | Has a shortlist, visit requests, reviews and conversations already |
| `seeker2@roomraah.local` | Seeker | A second seeker, for testing two people in one thread |
| `seeker3@roomraah.local` | Seeker | A third |
| `seeker.unverified@roomraah.local` | Seeker | **Email not verified** — use this to build and test the 403 path |
| `owner.checked@roomraah.local` | Owner | Identity `Checked`. The only owner whose listings can be published |
| `owner.new@roomraah.local` | Owner | Identity `NotChecked` |
| `owner.failed@roomraah.local` | Owner | Identity `Failed` |
| `admin@roomraah.local` | Admin | **Can record inspections.** Use this one for the badge screens |
| `admin2@roomraah.local` | Admin | **Cannot.** Use this one to check that the inspection buttons are hidden or refused |

The seed data is shaped to exercise the interface, not to look tidy: 14 listings across all
six statuses, two of them with no beds free, three carrying an inspection badge, two whose
availability has gone stale, both admin queues populated, nine visit requests covering every
status, five reviews across all three moderation states, an open report and an upheld one,
and three conversations, one of them with unread messages.

---

## 4. Authentication

### 4.1 The flow

```
register  ->  (email arrives in Mailpit)  ->  verify-otp  ->  session
   |                                                             |
   |                                                       access + refresh
login  ->  session                                               |
                                                                 v
                                    refresh  ->  a new pair, the old one revoked
                                    logout   ->  the refresh token is revoked
```

**`verify-otp` returns a session.** Do not send the user back to the login screen after
verifying — the access token they were holding says "not verified", so a fresh pair comes
back with the code, and you use it immediately.

### 4.2 What a session looks like

```jsonc
// 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZWlkZW50aWZpZXIiOiI2IiwiZW1haWwiOiJzZWVrZXIxQHJvb21yYWFoLmxvY2FsIiwianRpIjoiNGZlYzRkNTgtZmQ3MC00ZTRjLTg5NzktMDhiNGQxNWRjY2NhIiwiZW1haWxfdmVyaWZpZWQiOiJ0cnVlIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiU2Vla2VyIiwiZXhwIjoxNzg4Njk0NzA1LCJpc3MiOiJSb29tUmFhaC5BUEkiLCJhdWQiOiJSb29tUmFhaC5DbGllbnQifQ.rhKEmtwSnVWAvqFLwcx151LwExwPJ4tpu4seVCou8eA",
  "refreshToken": "1HjeVp3yQkk/w5nwxNFtpvpsec3FgwlA70VM2/1aC2YfCPi3C+KYwJdkycO5V87fxDR7tbluBIk0HyYa0oVtYg==",
  "expiresInSeconds": 1800,
  "user": {
    "id": 6,
    "fullName": "Hamza Iqbal",
    "email": "seeker1@roomraah.local",
    "role": "Seeker",
    "isEmailVerified": true
  }
}
```

- **Access token: 30 minutes. Refresh token: 7 days.**
- Store both. `localStorage` is fine for this product.
- Send the access token as `Authorization: Bearer <token>` on every request.

### 4.3 Reading the token

The access token is a normal JWT. Decode the payload for what you need — do not call the
API to find out who is signed in.

| Claim | Holds |
|---|---|
| `nameid` *(`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier`)* | the user id |
| `role` *(`http://schemas.microsoft.com/ws/2008/06/identity/claims/role`)* | `Seeker`, `Owner` or `Admin` |
| `email_verified` | `"true"` or `"false"` — **a string, not a boolean** |
| `exp` | expiry, seconds since the epoch |

> **This will bite you.** The role claim's key in the decoded payload is the long
> `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` URI, not `"role"`. Read it
> by that exact key.

### 4.4 Silent refresh

On any **401**, call `POST /auth/refresh` once with the stored refresh token, replace both
tokens, and retry the original request. If the refresh also fails, clear the tokens and send
the person to `/login`.

Refresh **rotates**: the response carries a new refresh token and the old one stops working.
Store the new one or the next refresh fails.

Do not fire two refreshes at once. Queue the requests that got a 401 behind a single
in-flight refresh, or they will race each other and one will lose.

### 4.5 Guards you need

| Guard | Lets through | Otherwise |
|---|---|---|
| `authGuard` | a valid, unexpired access token | `/login` |
| `verifiedGuard` | that, **and** `email_verified === "true"` | `/verify` |
| `ownerGuard` | role `Owner` | `/` |
| `adminGuard` | role `Admin` | `/` |

---

## 5. How the API answers

### 5.1 Success

A single object, or a page. Every paged endpoint returns the same envelope:

```jsonc
{
  "items": [ /* ... */ ],
  "totalCount": 8,
  "page": 1,
  "pageSize": 12
}
```

`page` starts at **1**. `pageSize` defaults to **12** and may not exceed **50**.

### 5.2 Failure — one envelope, always

```jsonc
// 401
{
  "success": false,
  "statusCode": 401,
  "error": "Invalid email or password.",
  "traceId": "0HNOC0S6KDBSN:00000001"
}
```

`errors` is present **only on a 400**, and it is a list of field errors:

```jsonc
// 400
{
  "success": false,
  "statusCode": 400,
  "error": "One or more validation errors occurred.",
  "traceId": "0HNOC0S6KDBSO:00000001",
  "errors": [
    {
      "field": "FullName",
      "message": "Full name is required."
    }
  ]
}
```

`traceId` appears only on a 500, and it is what you quote when reporting a fault.

### 5.3 What each status means here

| Status | Meaning | What the interface should do |
|---|---|---|
| **400** | The request was the wrong *shape* — a field missing, too long, not a valid value | Show the field errors against the fields. This is your form's job |
| **401** | No token, or it expired | Silent refresh, then retry. If that fails, sign the person out |
| **403** | Signed in, but not allowed — wrong role, not your record, or **email not verified** | Check `email_verified` first and route to `/verify`; otherwise show a plain refusal |
| **404** | The thing named in the route does not exist, or is not published | A "not found" page. Do not retry |
| **409** | Not used by this product | — |
| **422** | The request was well formed, but a *rule* says no | **Show `error` verbatim.** These sentences are written to be read by the user |
| **429** | Too many OTP requests | Show the wait; `retryAfterSeconds` is in the body |
| **500** | A fault | A generic apology plus the `traceId` |

> **The 422 messages are user-facing copy.** "You have already reviewed this listing.",
> "Both beds were taken last week." — they are written to be shown. Do not replace them
> with your own wording, and do not swallow them into a generic "Something went wrong".

Some concrete ones:

```jsonc
// 422
{
  "success": false,
  "statusCode": 422,
  "error": "This listing is already on your shortlist.",
  "traceId": "0HNOC0S6KDBT8:00000001"
}
```

```jsonc
// 404
{
  "success": false,
  "statusCode": 404,
  "error": "No published listing with id 987654.",
  "traceId": "0HNOC0S6KDBT3:00000001"
}
```

```jsonc
// 422
{
  "success": false,
  "statusCode": 422,
  "error": "City 999999 does not exist.",
  "traceId": "0HNOC0S6KDBT4:00000001"
}
```

```jsonc
// 403
{
  "success": false,
  "statusCode": 403,
  "error": "You do not have permission to perform this action.",
  "traceId": "0HNOC0S6KDBTL:00000001"
}
```

---

## 6. Enumerations

These are the exact strings. The API sends them and accepts them **case-insensitively on
input**, and always sends them in this casing. Anything else is a 400.

| Enumeration | Values |
|---|---|
| `UserRole` | `Seeker`, `Owner`, `Admin` |
| `PropertyStatus` | `Draft`, `PendingReview`, `ChangesRequested`, `Published`, `Rejected`, `Unpublished` |
| `RoomType` | `Private`, `Shared` |
| `GenderPolicy` | `Boys`, `Girls`, `Family` |
| `PropertySort` | `Recent`, `PriceLowToHigh`, `PriceHighToLow`, `Distance` |
| `RevisionKind` | `Content`, `Availability` |
| `RevisionStatus` | `Pending`, `Approved`, `Rejected` |
| `PhotoStatus` | `Live`, `PendingAdd`, `PendingRemove` |
| `VerificationCheckType` | `OwnerIdentity`, `Address`, `Photos`, `Facilities`, `Availability` |
| `VerificationStatus` | `NotChecked`, `Checked`, `Failed` |
| `VisitType` | `Physical`, `Video` |
| `VisitStatus` | `Requested`, `Accepted`, `Declined`, `Completed`, `Cancelled` |
| `StayStatus` | `Visited`, `CurrentlyStaying`, `PreviouslyStayed` |
| `ModerationState` | `Pending`, `Approved`, `Hidden` |
| `ReportReason` | `Inaccurate`, `Misleading`, `AlreadyTaken`, `Scam`, `Offensive`, `Other` |
| `ReportStatus` | `Open`, `UnderReview`, `Upheld`, `Dismissed` |
| `InspectionResult` | `Passed`, `Failed` |
| `BadgeAction` | `Granted`, `Removed` |
| `LandmarkKind` | `University`, `Workplace`, `Other` |
| `OtpPurpose` | `VerifyEmail`, `ResetPassword` |

**Build your dropdowns from these, not from whatever the seed data happens to contain.**

---

## 7. Validation

The server validates everything below and answers **400** with field errors. Validate the
same rules client-side so a person is told before they submit — but never *only*
client-side, and never disagree with this table.

| Field | Rule |
|---|---|
| `fullName` | required, max 120 |
| `email` | required, valid format, max 200 |
| `phoneNumber` | required, max 20, digits and `+` only |
| `password` | required, min 8, at least one uppercase letter and one digit |
| `cnicNumber` | required **for owners only**, exactly 13 digits |
| `title` | required, max 150 |
| `description` | required, max 4000 |
| `addressLine` | required, max 300 |
| `latitude` | required, −90 to 90 |
| `longitude` | required, −180 to 180 |
| `totalBeds` | required, 1 to 100 |
| `availableBeds` | required, 0 to `totalBeds` |
| `monthlyRent` | required, greater than 0 |
| `securityDeposit`, `utilitiesCharge`, `messCharge` | 0 or greater |
| `houseRules` | optional, max 2000 |
| `roomType` | required, `Private` or `Shared` |
| `genderPolicy` | required, `Boys`, `Girls` or `Family` |
| `areaId` | required, must name an existing area |
| `facilityIds` | optional; every id must exist |
| Photo file | required, **5 MB max**, `image/jpeg`, `image/png` or `image/webp` — the server decodes the bytes, so renaming a `.txt` to `.jpg` is refused |
| Photo order list | must name every photo the listing will hold, exactly once |
| `rating` | required, 1 to 5 |
| `comment` (review) | required, max 1000 |
| `stayStatus` | required, must be a `StayStatus` |
| `body` (message) | required, 1 to 2000 |
| `details` (report) | required, max 1000 |
| `reason` (report) | required, must be a `ReportReason` |
| `visitType` | required, `Physical` or `Video` |
| `preferredAt` | required, **must be in the future and at most 60 days ahead** |
| `ownerResponseNote` | **required on a decline**, max 1000; optional on an accept |
| `adminNote` | required on any rejection, on a request for changes and on an unpublish; optional on an approval |
| `reason` (badge, account) | required, max 1000 |
| `inspectedAt` | required, **must not be in the future** |
| `page` | 1 or greater, defaults to 1 |
| `pageSize` | 1 to 50, defaults to 12 |

> **A `preferredAt` in the past is a 400, and so is an `inspectedAt` in the future.** Both
> catch people out. Use a date picker that cannot produce the wrong side.

---

## 8. The endpoints

Sixty-eight of them. `RoomRaah.openapi.json` has every shape; this section has the ones you
will build against, with a real response and the refusals each can give.

**Auth column:** *anon* = no token. *verified* = a signed-in account with a verified email.
A role name = that role, verified.

### 8.1 Auth — `/api/v1/auth`

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/register` | anon | `fullName, email, phoneNumber, password, role, cnicNumber?` |
| POST | `/auth/verify-otp` | anon | `email, code` |
| POST | `/auth/resend-otp` | anon | `email` |
| POST | `/auth/login` | anon | `email, password` |
| POST | `/auth/refresh` | anon | `refreshToken` |
| POST | `/auth/logout` | any | `refreshToken` |
| POST | `/auth/forgot-password` | anon | `email` |
| POST | `/auth/reset-password` | anon | `email, token, newPassword` |

`role` on register is `Seeker` or `Owner` only — **the product has no route that creates an
admin**, by design. `cnicNumber` is required when `role` is `Owner` and must be exactly 13
digits.

The OTP is **6 digits, valid 10 minutes, single use, 5 attempts**, and an address may ask
for at most **3 in any 10-minute window** (a 4th is a 429 with `retryAfterSeconds`).

### 8.2 Reference data — cached, fetch once

| Method | Path | Auth |
|---|---|---|
| GET | `/locations/cities` | anon |
| GET | `/locations/cities/{cityId}/areas` | anon |
| GET | `/locations/suggest?q=` | anon |
| GET | `/facilities` | anon |

`q` is 2 to 60 characters. Suggestions mix three kinds in one list — check `type`:

```jsonc
// 200
[
  {
    "type": "Landmark",
    "id": 1,
    "name": "University of the Punjab",
    "city": "Lahore",
    "kind": "University",
    "latitude": 31.4966,
    "longitude": 74.2996
  }
]
```

Facilities are the seven the product has; build the filter checkboxes from this call:

```jsonc
// 200
[
  {
    "id": 1,
    "name": "Wi-Fi",
    "iconKey": "wifi"
  },
  {
    "id": 2,
    "name": "Mess",
    "iconKey": "mess"
  },
  {
    "id": 3,
    "name": "Air Conditioning",
    "iconKey": "ac"
  }
]
```

### 8.3 Search and the public listing

| Method | Path | Auth |
|---|---|---|
| GET | `/properties` | anon |
| GET | `/properties/featured` | anon |
| GET | `/properties/compare?ids=1,2,3` | anon |
| GET | `/properties/{id}` | anon |
| GET | `/properties/{id}/photos` | anon |
| GET | `/properties/{id}/reviews` | anon |

**Every search filter**, all optional, all query parameters:

`cityId` · `areaId` · `landmarkId` · `maxDistanceKm` · `minRent` · `maxRent` · `roomType` ·
`genderPolicy` · `facilityIds` (comma-separated) · `availableOnly` · `sort` · `page` ·
`pageSize`

Three refusals worth handling before the request leaves the browser:

- `maxDistanceKm` **without** `landmarkId` is a 400. So is `sort=Distance` without one.
- `minRent` greater than `maxRent` is a 400.
- An id that names nothing (`cityId=999999`) is a **422**, not an empty list.

A card:

```jsonc
// 200
{
  "items": [
    {
      "id": 4,
      "title": "Single room with sea breeze, Clifton",
      "areaId": 4,
      "areaName": "Clifton",
      "cityId": 2,
      "cityName": "Karachi",
      "roomType": "Private",
      "genderPolicy": "Girls",
      "totalBeds": 1,
      "availableBeds": 1,
      "monthlyRent": 32000.0,
      "securityDeposit": 32000.0,
      "utilitiesCharge": 4000.0,
      "messCharge": 0.0,
      "latitude": 24.8138,
      "longitude": 67.03,
      "primaryThumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_8ce40d58edb141a28c7ef968af02a90e.jpg",
      "photoCount": 4,
      "hasInspectionBadge": true,
      "availabilityConfirmedAt": "2026-09-06T10:50:00.51751",
      "distanceKm": null
    }
  ],
  "totalCount": 8,
  "page": 1,
  "pageSize": 2
}
```

`distanceKm` is `null` unless a `landmarkId` was given, and is rounded to one decimal.
Label it as **straight-line** distance in the interface — that is what it is, and the
product says so on purpose.

The detail carries the owner, the facilities, the gallery and the verification checks:

```jsonc
// 200
{
  "description": "A single private room in a quiet Clifton apartment, walking distance from the beach side. Suits a working professional who wants their own space.",
  "addressLine": "Flat 5B, Block 2, Clifton",
  "houseRules": "No overnight guests.",
  "facilities": [
    {
      "id": 1,
      "name": "Wi-Fi",
      "iconKey": "wifi"
    },
    {
      "id": 3,
      "name": "Air Conditioning",
      "iconKey": "ac"
    }
  ],
  "photos": [
    {
      "id": 13,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/4/8ce40d58edb141a28c7ef968af02a90e_seed_4_1.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_8ce40d58edb141a28c7ef968af02a90e.jpg",
      "isPrimary": true,
      "sortOrder": 1
    },
    {
      "id": 14,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/4/13313881b9134521ac871463a3930281_seed_4_2.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_13313881b9134521ac871463a3930281.jpg",
      "isPrimary": false,
      "sortOrder": 2
    }
  ],
  "owner": {
    "displayName": "Kashif Mehmood",
    "identityVerified": true,
    "identityCheckedAt": "2026-08-23T10:49:45.5100673"
  },
  "checks": [
    {
      "checkType": "OwnerIdentity",
      "status": "Checked",
      "evidenceDate": "2026-08-23T10:49:45.5100673"
    },
    {
      "checkType": "Address",
      "status": "Checked",
      "evidenceDate": "2026-08-23T10:49:45.5100673"
    }
  ],
  "createdAt": "2026-08-29T10:49:43.2759512",
  "id": 4,
  "title": "Single room with sea breeze, Clifton",
  "areaId": 4,
  "areaName": "Clifton",
  "cityId": 2,
  "cityName": "Karachi",
  "roomType": "Private",
  "genderPolicy": "Girls",
  "totalBeds": 1,
  "availableBeds": 1,
  "monthlyRent": 32000.0,
  "securityDeposit": 32000.0,
  "utilitiesCharge": 4000.0,
  "messCharge": 0.0,
  "latitude": 24.8138,
  "longitude": 67.03,
  "primaryThumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_8ce40d58edb141a28c7ef968af02a90e.jpg",
  "photoCount": 4,
  "hasInspectionBadge": true,
  "availabilityConfirmedAt": "2026-09-06T10:50:00.51751",
  "distanceKm": null
}
```

`compare` takes **at most three** ids once duplicates are removed (a fourth is 422), and
quietly leaves out an id that resolves to nothing rather than refusing the whole request.

Reviews are **approved ones only**, newest first, with the average and count:

```jsonc
// 200
{
  "averageRating": 4,
  "items": [
    {
      "id": 1,
      "propertyId": 1,
      "authorDisplayName": "Zainab Farooq",
      "rating": 4,
      "comment": "Clean room and the mess food is better than I expected. The street gets noisy in the evening, but the room itself is quiet.",
      "stayStatus": "CurrentlyStaying",
      "createdAt": "2026-08-30T10:49:45.726339"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 12
}
```

### 8.4 Shortlist — `/api/v1/saved` *(verified)*

| Method | Path | Answers |
|---|---|---|
| GET | `/saved` | a page of cards, newest save first |
| POST | `/saved/{propertyId}` | **201**, the card |
| DELETE | `/saved/{propertyId}` | **204** |

Saving twice is a 422. Saving something not published is a 404.

**A listing that leaves the site disappears from the list but the row survives** — so a
shortlist can always be cleared, and a listing that comes back reappears. Do not treat a
missing card as a broken delete.

### 8.5 Visits

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/visits` | Seeker | `propertyId, visitType, preferredAt` |
| GET | `/visits/my` | Seeker | — |
| GET | `/owner/visits` | Owner | — |
| PATCH | `/visits/{id}/respond` | Owner | `status, ownerResponseNote?` |
| PATCH | `/visits/{id}/complete` | Seeker **or** Owner | — |
| PATCH | `/visits/{id}/cancel` | Seeker | — |

```jsonc
// 200
{
  "items": [
    {
      "id": 10,
      "propertyId": 1,
      "propertyTitle": "Bright shared room near Main Boulevard",
      "areaName": "Gulberg",
      "cityName": "Lahore",
      "seekerDisplayName": "Hamza Iqbal",
      "visitType": "Video",
      "preferredAt": "2026-10-06T10:49:56",
      "status": "Declined",
      "ownerResponseNote": "Both beds went last week.",
      "respondedAt": "2026-09-06T10:49:57.8070092",
      "createdAt": "2026-09-06T10:49:56.7514993"
    }
  ],
  "totalCount": 4,
  "page": 1,
  "pageSize": 2
}
```

The state machine, which your buttons must follow:

```
Requested ──respond──> Accepted ──complete──> Completed
    │                      │
    │                      └──cancel──> Cancelled
    ├──respond──> Declined
    └──cancel───> Cancelled
```

- **Respond** works only from `Requested`. `status` is `Accepted` or `Declined`, and a
  decline **must** carry `ownerResponseNote` (a 400 without it).
- **Complete** works only from `Accepted`, and **only once `preferredAt` has passed**.
  Either party may press it. Hide or disable the button until then.
- **Cancel** is the seeker's, from `Requested` or `Accepted` only.
- A seeker may hold **one open request per listing** — open meaning `Requested` or
  `Accepted`. A second is a 422.

**Completing is what unlocks writing a review.** If your interface never surfaces the
complete button, nobody can ever review anything.

### 8.6 Reviews

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/reviews` | Seeker | `propertyId, rating, comment, stayStatus` |
| GET | `/properties/{id}/reviews` | anon | — |
| GET | `/admin/reviews?state=` | Admin | — |
| PATCH | `/admin/reviews/{id}` | Admin | `state` |

A review can be written only after a visit on that listing reached `Completed` (422
otherwise), and only **once per listing per person** (422 otherwise).

**A new review is invisible.** It is created `Pending` and does not appear on the public
list until an admin approves it. Tell the author that, on the success screen — otherwise
they write a review, refresh, cannot see it, and write it again.

`state` on the moderation PATCH is `Approved` or `Hidden`.

```jsonc
// 200
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 2
}
```

### 8.7 Reports

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/reports` | Seeker | `propertyId, reason, details` |
| GET | `/admin/reports?status=` | Admin | — |
| PATCH | `/admin/reports/{id}` | Admin | `status, adminNote?` |

One unresolved report per listing per person — unresolved meaning `Open` or `UnderReview`.

`status` is `UnderReview`, `Upheld` or `Dismissed`. The two verdicts **require**
`adminNote` (400 without) and cannot be set on a report that already carries one (422).

**Upholding a report does not take the listing down.** That is a separate, deliberate
decision an admin makes on the listings screen. Do not imply otherwise in the copy.

```jsonc
// 200
{
  "items": [
    {
      "propertyTitle": "Private room for students, Johar Town",
      "reportedByDisplayName": "Usman Shahid",
      "adminNote": "Photographs did not match the room. The owner has been asked to replace them.",
      "resolvedByAdminId": 1,
      "resolvedAt": "2026-09-03T10:49:45.726339",
      "id": 2,
      "propertyId": 2,
      "reason": "Misleading",
      "details": "The photographs show a room with a window. The room I saw has no window.",
      "status": "Upheld",
      "createdAt": "2026-08-31T10:49:45.726339"
    }
  ],
  "totalCount": 3,
  "page": 1,
  "pageSize": 2
}
```

### 8.8 Messaging *(verified)*

| Method | Path | Body | Answers |
|---|---|---|---|
| POST | `/conversations` | `propertyId` | **201** if new, **200** if it already existed |
| GET | `/conversations` | — | a page, most recent message first |
| GET | `/conversations/{id}/messages` | — | a page, **oldest first** |
| POST | `/conversations/{id}/messages` | `body` | **201**, the message |
| PATCH | `/conversations/{id}/read` | — | how many it marked |

**Only a seeker opens a conversation**, and only on a published listing. An owner replies;
they cannot start one, because there is no directory of seekers in this product.

**Opening the same conversation twice is not an error** — you get the existing thread with
a 200. So you never need to check first: just call it.

```jsonc
// 200
{
  "items": [
    {
      "id": 4,
      "propertyId": 4,
      "propertyTitle": "Single room with sea breeze, Clifton",
      "otherParticipantDisplayName": "Kashif Mehmood",
      "createdAt": "2026-09-06T10:49:58.4269367",
      "lastMessageAt": "2026-09-06T11:08:27.2087088",
      "unreadCount": 1
    }
  ],
  "totalCount": 3,
  "page": 1,
  "pageSize": 12
}
```

```jsonc
// 200
{
  "items": [
    {
      "id": 9,
      "conversationId": 4,
      "senderDisplayName": "Hamza Iqbal",
      "isMine": true,
      "body": "Assalam o alaikum. Is the room still free from the 1st?",
      "sentAt": "2026-09-06T10:49:58.5532254",
      "readAt": "2026-09-06T10:49:59.6899054"
    },
    {
      "id": 10,
      "conversationId": 4,
      "senderDisplayName": "Hamza Iqbal",
      "isMine": true,
      "body": "Sorry, one more question.",
      "sentAt": "2026-09-06T10:49:58.5819957",
      "readAt": "2026-09-06T10:49:59.6899054"
    }
  ],
  "totalCount": 5,
  "page": 1,
  "pageSize": 30
}
```

`isMine` is the only thing telling you which side to render a bubble on — there is no
sender id, on purpose.

```jsonc
// 200
{
  "conversationId": 4,
  "markedCount": 1
}
```

`markedCount` of 0 is a success, not a refusal. Call `read` whenever the thread is on
screen; a second call simply marks nothing.

### 8.9 Owner listings — `/api/v1/owner/properties` *(Owner)*

| Method | Path | Body |
|---|---|---|
| POST | `/owner/properties` | the full listing |
| GET | `/owner/properties` | — |
| GET | `/owner/properties/{id}` | — |
| PUT | `/owner/properties/{id}` | the full listing |
| PATCH | `/owner/properties/{id}/availability` | `availableBeds` |
| POST | `/owner/properties/{id}/submit` | — |
| POST | `/owner/properties/{id}/photos` | **multipart**, field name `file` |
| DELETE | `/owner/properties/{id}/photos/{photoId}` | — |
| PATCH | `/owner/properties/{id}/photos/order` | `photoIds` — every photo, exactly once |
| PATCH | `/owner/properties/{id}/photos/{photoId}/primary` | — |
| POST | `/owner/properties/{id}/inspection-request` | — |

The create/update body:

```jsonc
{
  "areaId": 1,
  "title": "Bright shared room near Main Boulevard",
  "description": "A four-bed shared room in a well-kept portion...",
  "addressLine": "House 42, Block C, Gulberg III",
  "latitude": 31.5204,
  "longitude": 74.3587,
  "roomType": "Shared",
  "genderPolicy": "Boys",
  "totalBeds": 4,
  "availableBeds": 2,
  "monthlyRent": 18000,
  "securityDeposit": 18000,
  "utilitiesCharge": 2500,
  "messCharge": 8000,
  "houseRules": "No smoking indoors. Guests until 10pm.",
  "facilityIds": [1, 2, 5]
}
```

**Coordinates come from the owner dragging a pin on a map.** There is no geocoder anywhere
in this product — an address is typed and a pin is dropped, and the two are checked by an
admin. The map is **Leaflet with OpenStreetMap tiles**: no API key, no billing account.

**The lifecycle you are building around:**

```
Draft ──submit──> PendingReview ──approve──> Published
  ^                    │                        │
  │                    ├──reject──> Rejected    │  PUT creates a REVISION
  └──── ChangesRequested <──request-changes     │  (the live listing is untouched)
                                                v
                                          Unpublished ──approve──> Published
```

| Status | What `PUT` does |
|---|---|
| `Draft`, `ChangesRequested`, `Rejected`, `Unpublished` | edits in place |
| `PendingReview` | **refused, 422** — an admin is reading it right now |
| `Published` | **creates a revision**, and the response tells you so |

The update response carries `pendingRevision` when one was created. **Read it and change
your copy** — "Sent for review", not "Saved".

- A listing needs **3 to 15 live photographs** to be submitted (422 otherwise).
- `submit` works only from `Draft` or `ChangesRequested`.
- Photo operations on a **published** listing are proposals too, not immediate changes.
- A revision that changes nothing is refused — **except** on `availability`, where
  re-confirming the same bed count is the whole point and is accepted.
- One pending revision **of each kind** at a time. A content revision and an availability
  revision can be open together.

```jsonc
// 200
{
  "id": 4,
  "title": "Single room with sea breeze, Clifton",
  "description": "A single private room in a quiet Clifton apartment, walking distance from the beach side. Suits a working professional who wants their own space.",
  "addressLine": "Flat 5B, Block 2, Clifton",
  "latitude": 24.8138,
  "longitude": 67.03,
  "roomType": "Private",
  "genderPolicy": "Girls",
  "totalBeds": 1,
  "availableBeds": 1,
  "monthlyRent": 32000.0,
  "securityDeposit": 32000.0,
  "utilitiesCharge": 4000.0,
  "messCharge": 0.0,
  "houseRules": "No overnight guests.",
  "status": "Published",
  "hasInspectionBadge": true,
  "availabilityConfirmedAt": "2026-09-06T10:50:00.51751",
  "areaId": 4,
  "areaName": "Clifton",
  "cityId": 2,
  "cityName": "Karachi",
  "facilities": [
    {
      "id": 1,
      "name": "Wi-Fi",
      "iconKey": "wifi"
    },
    {
      "id": 3,
      "name": "Air Conditioning",
      "iconKey": "ac"
    }
  ],
  "photos": [
    {
      "id": 13,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/4/8ce40d58edb141a28c7ef968af02a90e_seed_4_1.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_8ce40d58edb141a28c7ef968af02a90e.jpg",
      "isPrimary": true,
      "sortOrder": 1,
      "status": "Live",
      "uploadedAt": "2026-08-29T10:49:43.2759512"
    },
    {
      "id": 14,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/4/13313881b9134521ac871463a3930281_seed_4_2.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/4/thumb_13313881b9134521ac871463a3930281.jpg",
      "isPrimary": false,
      "sortOrder": 2,
      "status": "Live",
      "uploadedAt": "2026-08-29T10:49:43.2759512"
    }
  ],
  "createdAt": "2026-08-29T10:49:43.2759512",
  "updatedAt": "2026-09-06T10:50:00.51751"
}
```

### 8.10 Admin — listings, revisions, inspections *(Admin)*

| Method | Path | Body |
|---|---|---|
| GET | `/admin/properties?status=` | — |
| GET | `/admin/properties/{id}` | — |
| POST | `/admin/properties/{id}/verify` | `checkType, status, note?` |
| POST | `/admin/properties/{id}/approve` | `adminNote?` |
| POST | `/admin/properties/{id}/reject` | `adminNote` **required** |
| POST | `/admin/properties/{id}/request-changes` | `adminNote` **required** |
| POST | `/admin/properties/{id}/unpublish` | `adminNote` **required** |
| GET | `/admin/revisions?kind=` | — |
| GET | `/admin/revisions/{id}` | — |
| POST | `/admin/revisions/{id}/approve` | `adminNote?` |
| POST | `/admin/revisions/{id}/reject` | `adminNote` **required** |
| POST | `/admin/inspections` | `propertyId, inspectedAt, result, notes?, feeAmount?, feeCollectedAt?` |
| GET | `/admin/inspections/due` | — |
| POST | `/admin/properties/{id}/badge/grant` | `reason` **required** |
| POST | `/admin/properties/{id}/badge/remove` | `reason` **required** |

**A listing cannot be published until four verification checks pass** — `OwnerIdentity`,
`Address`, `Photos` and `Facilities`. `Availability` is recordable but does not gate
publishing. The admin detail carries `canPublish`, already computed: **use it to enable
the button** rather than working it out yourself.

```jsonc
// 200
{
  "owner": {
    "id": 4,
    "fullName": "Nadia Rehman",
    "identityStatus": "NotChecked",
    "identityCheckedAt": null
  },
  "verificationChecks": [
    {
      "checkType": "OwnerIdentity",
      "status": "Checked",
      "evidenceDate": "2026-08-23T10:49:45.5100673",
      "note": null,
      "recordedAt": "2026-08-23T10:49:45.5100673"
    },
    {
      "checkType": "Address",
      "status": "Checked",
      "evidenceDate": "2026-08-23T10:49:45.5100673",
      "note": null,
      "recordedAt": "2026-08-23T10:49:45.5100673"
    }
  ],
  "canPublish": true,
  "id": 9,
  "title": "Two-bed room near NUST shuttle stop",
  "description": "A two-bed room in I-8, on the route the NUST shuttle takes in the morning. Recently painted, with new mattresses and a shared kitchen.",
  "addressLine": "House 88, Street 12, I-8/4",
  "latitude": 33.665,
  "longitude": 73.075,
  "roomType": "Shared",
  "genderPolicy": "Boys",
  "totalBeds": 2,
  "availableBeds": 2,
  "monthlyRent": 20000.0,
  "securityDeposit": 18000.0,
  "utilitiesCharge": 2500.0,
  "messCharge": 6500.0,
  "houseRules": null,
  "status": "PendingReview",
  "hasInspectionBadge": false,
  "availabilityConfirmedAt": "2026-09-06T10:49:43.2759512",
  "areaId": 9,
  "areaName": "I-8",
  "cityId": 3,
  "cityName": "Islamabad",
  "facilities": [
    {
      "id": 1,
      "name": "Wi-Fi",
      "iconKey": "wifi"
    },
    {
      "id": 2,
      "name": "Mess",
      "iconKey": "mess"
    }
  ],
  "photos": [
    {
      "id": 33,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/9/078ff06e222746d295e02f401ddd0eac_seed_9_1.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/9/thumb_078ff06e222746d295e02f401ddd0eac.jpg",
      "isPrimary": true,
      "sortOrder": 1,
      "status": "Live",
      "uploadedAt": "2026-08-30T10:49:43.2759512"
    },
    {
      "id": 34,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/9/a81c4616eb6145d7b48cf17490f8bfa5_seed_9_2.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/9/thumb_a81c4616eb6145d7b48cf17490f8bfa5.jpg",
      "isPrimary": false,
      "sortOrder": 2,
      "status": "Live",
      "uploadedAt": "2026-08-30T10:49:43.2759512"
    }
  ],
  "createdAt": "2026-08-30T10:49:43.2759512",
  "updatedAt": "2026-09-06T10:49:43.2759512"
}
```

**Two revision queues, not one.** `kind=Content` gets a full before-and-after review;
`kind=Availability` is a one-click confirmation of a bed count. Build them as two tabs.

```jsonc
// 200
{
  "id": 1,
  "propertyId": 1,
  "propertyTitle": "Bright shared room near Main Boulevard",
  "kind": "Content",
  "reviewStatus": "Pending",
  "ownerName": "Kashif Mehmood",
  "changes": [
    {
      "field": "Description",
      "current": "A four-bed shared room in a well-kept portion, ten minutes from Main Boulevard. Attached bath, study desk per bed, and a separate entrance for tenants.",
      "proposed": "A four-bed shared room in a well-kept portion, ten minutes from Main Boulevard. Attached bath, study desk per bed, and a separate entrance for tenants. Newly repainted, with a second study desk."
    },
    {
      "field": "MonthlyRent",
      "current": "18000",
      "proposed": "20000"
    }
  ],
  "currentPhotos": [
    {
      "id": 1,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/1/e2712c38fc7344c2b1df80a0d5aa0070_seed_1_1.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/1/thumb_e2712c38fc7344c2b1df80a0d5aa0070.jpg",
      "isPrimary": true,
      "sortOrder": 1,
      "status": "Live",
      "uploadedAt": "2026-08-28T10:49:43.2759512"
    },
    {
      "id": 2,
      "url": "http://127.0.0.1:10000/devstoreaccount1/properties/1/b16506ac09e048099407cf15a108c6b4_seed_1_2.jpg",
      "thumbnailUrl": "http://127.0.0.1:10000/devstoreaccount1/properties/1/thumb_b16506ac09e048099407cf15a108c6b4.jpg",
      "isPrimary": false,
      "sortOrder": 2,
      "status": "Live",
      "uploadedAt": "2026-08-28T10:49:43.2759512"
    }
  ],
  "photosToAdd": [],
  "photosToRemove": [],
  "proposedPhotoOrder": null,
  "submittedAt": "2026-09-03T10:49:45.5811215",
  "reviewedAt": null,
  "adminNote": null
}
```

**The inspection badge** is the product's only paid feature.

- The owner requests an inspection **once**; after that the team visits on its own schedule.
- **No screen ever shows a scheduled inspection date to an owner.** No such date exists
  anywhere in the product — do not add a field for one.
- Recording an inspection and granting the badge are **two acts**. Only an admin whose
  `canInspect` is true may do either; **any** admin may remove a badge.
- A badge is granted only when the **most recent** inspection passed, and never twice.
- `inspectedAt` must not be in the future.

```jsonc
// 200
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 2
}
```

`daysOverdue` is how far past the 30-day interval a badged listing is.

### 8.11 Admin — users *(Admin)*

| Method | Path | Body |
|---|---|---|
| GET | `/admin/users?role=&isActive=&q=&page=&pageSize=` | — |
| GET | `/admin/users/{id}` | — |
| PATCH | `/admin/users/{id}/deactivate` | `reason` **required** |
| PATCH | `/admin/users/{id}/reactivate` | `reason` **required** |

Leave `isActive` off and the list includes deactivated accounts — which is the point of it.
`q` matches a name or an email, 2 to 200 characters.

```jsonc
// 200
{
  "items": [
    {
      "id": 5,
      "fullName": "Tariq Javed",
      "email": "owner.failed@roomraah.local",
      "role": "Owner",
      "isEmailVerified": true,
      "isActive": true,
      "createdAt": "2026-09-06T10:49:42.8604817"
    },
    {
      "id": 4,
      "fullName": "Nadia Rehman",
      "email": "owner.new@roomraah.local",
      "role": "Owner",
      "isEmailVerified": true,
      "isActive": true,
      "createdAt": "2026-09-06T10:49:42.8604817"
    }
  ],
  "totalCount": 3,
  "page": 1,
  "pageSize": 2
}
```

**The detail is the one exception to §1.1** — the only screen in the entire product that
shows a phone number, and the only one that shows a CNIC (owners only; it is `null` for
everyone else). It exists so the admin recording an identity check can see the identity.

```jsonc
// 200
{
  "phoneNumber": "+923001110005",
  "cnicNumber": "3520112345673",
  "identityStatus": "Failed",
  "identityCheckedAt": "2026-09-01T10:49:42.8604817",
  "canInspect": null,
  "id": 5,
  "fullName": "Tariq Javed",
  "email": "owner.failed@roomraah.local",
  "role": "Owner",
  "isEmailVerified": true,
  "isActive": true,
  "createdAt": "2026-09-06T10:49:42.8604817"
}
```

**Do not show either field anywhere else, and do not put them in the list.**

- An admin cannot switch off **their own** account (422) or **another admin** (403). Hide
  those buttons rather than letting somebody find out by pressing them.
- Switching an account to the state it is already in is a 422.
- Deactivating an owner takes their listings off the public site, and reactivating puts
  them back. Nothing is written onto the listings themselves.

---

## 9. Live messaging (SignalR)

The hub is at **`/hubs/chat`** — note it is **not** under `/api/v1`.

```typescript
import { HubConnectionBuilder } from '@microsoft/signalr';

const connection = new HubConnectionBuilder()
  .withUrl('http://localhost:5019/hubs/chat', {
    accessTokenFactory: () => this.auth.accessToken,   // NOT a header
  })
  .withAutomaticReconnect()
  .build();

connection.on('MessageReceived', (message: MessageDto) => {
  // same shape as an item from GET /conversations/{id}/messages,
  // with isMine === false, because it is somebody else's message.
});

await connection.start();
```

**Four things to know.**

1. **The token goes in the query string, not a header.** A WebSocket handshake cannot carry
   one. `accessTokenFactory` handles this; the API reads `access_token` for this path only.
2. **The hub has no methods you can call.** Sending a message is
   `POST /conversations/{id}/messages` — that is where the validation and the persistence
   are. The hub only pushes.
3. **`MessageReceived` is the only event**, and it is addressed to one user. You will never
   receive somebody else's conversation.
4. **Keep the connection open while the user is signed in, not just on the messages page.**
   The server emails a "you have a new message" nudge to anybody who is *not* connected. A
   user sitting on the search page with no hub connection gets an email instead of a badge.
   Reconnect after a silent refresh, too — a new token means a new connection.

**Keep polling as the fallback.** If the hub cannot connect, `GET /conversations` still
carries `unreadCount` and the thread still loads. Messaging must work without WebSockets.

---

## 10. Rules the interface must respect

Twenty things the API enforces that will look like bugs if the interface disagrees.

1. **No owner phone number, WhatsApp or email, anywhere.** No call button, no mailto.
2. **An unverified account may browse but not act.** Every write answers 403. Route to
   `/verify`, do not show a generic error.
3. **Editing a published listing creates a revision.** Say "sent for review", not "saved".
4. **A new review is invisible until an admin approves it.** Say so on the success screen.
5. **A visit can only be completed after its preferred time has passed**, and completing is
   what unlocks the review. Surface that button, or reviews never happen.
6. **Declining a visit requires a note.** Make the field required in the form.
7. **A seeker may hold one open visit request per listing.** Disable the button when one is
   open rather than letting them find out.
8. **A seeker may review a listing once.** Same.
9. **A report needs a reason from the enumeration and details.** One unresolved report per
   listing per person.
10. **Upholding a report does not unpublish the listing.**
11. **Compare takes at most three.** Enforce it in the UI; the fourth is a 422.
12. **`availableOnly` means beds greater than zero**, not "not full".
13. **Distance is straight-line.** Label it that way. It is `null` with no landmark.
14. **A listing needs 3 to 15 photographs to be submitted.** Show the count and block the
    button below three.
15. **Exactly one photograph is primary.** It is the one every card shows.
16. **Availability is its own, faster queue.** Give the owner a distinct "confirm beds"
    action, separate from editing the listing.
17. **Four verification checks gate publishing.** Use `canPublish` from the response.
18. **No owner-facing screen shows a scheduled inspection date.** There is no such field.
19. **Only an admin with `canInspect` records inspections or grants badges.** Any admin can
    remove one.
20. **An admin cannot deactivate themselves or another admin.** Hide those buttons.

---

## 11. The twenty pages

| # | Page | Route | Guard | Calls |
|---|---|---|---|---|
| 01 | Landing | `/` | — | `properties/featured`, `locations/suggest` |
| 02 | How it works | `/how-it-works` | — | none |
| 03 | Sign up | `/signup` | — | `auth/register` |
| 04 | Login | `/login` | — | `auth/login` |
| 05 | Verify | `/verify` | auth | `auth/verify-otp`, `auth/resend-otp` |
| 06 | Reset password | `/reset-password` | — | `auth/forgot-password`, `auth/reset-password` |
| 07 | Search results | `/search` | — | `properties`, `locations/*`, `facilities` |
| 08 | Advanced filters | *panel inside `/search`* | — | writes the query string |
| 09 | Map view | `/search/map` | — | `properties` with `landmarkId` |
| 10 | Property details | `/property/:id` | — | `properties/{id}` |
| 11 | Photo gallery | `/property/:id/photos` | — | `properties/{id}/photos` |
| 12 | Reviews | `/property/:id/reviews` | — | `properties/{id}/reviews` |
| 13 | Compare | `/compare` | — | `properties/compare` |
| 14 | Saved | `/saved` | verified | `saved` |
| 15 | Request a visit | `/property/:id/visit` | Seeker | `visits` |
| 16 | Messages | `/messages` | verified | `conversations/*` + the hub |
| 17 | Profile | `/profile` | auth | `auth/*` |
| 18 | Owner dashboard | `/owner` | Owner | `owner/properties`, `owner/visits` |
| 19 | Add / edit listing | `/owner/listing/:id` | Owner | `owner/properties/*` |
| 20 | Admin panel | `/admin/listings`, `/admin/revisions`, `/admin/reports`, `/admin/inspections`, `/admin/users` | Admin | `admin/*` |

**Page 08 has no route of its own** — filters live in the query string so a filtered search
is shareable and the back button works. A separate route would break both.

**Reporting a listing is a dialog** on page 10, not a page. Moving somebody off the listing
to fill in one short form loses them.

**Page 20 is one page with five tabs**, and the tabs *do* get child routes so an admin can
bookmark a queue.

---

## 12. Design system

| | |
|---|---|
| **Deep navy** (trust) | `#123B5D` |
| **Green** (confirmed) | `#16A36A` |
| **Soft background** | `#F7F9FA` |
| **Typeface** | Inter |

**Mobile first, four breakpoints, each a real design rather than a squeeze:**

| Breakpoint | Width | Shape |
|---|---|---|
| Phone | up to 640px | One column. Filters as a full-height slide-over. Bottom navigation |
| Tablet | 641–1024px | Two-column grid. Filters as a collapsible panel |
| Laptop | 1025–1440px | Three-column grid with a persistent filter sidebar |
| Desktop | above 1440px | Capped at 1440px and centred; map and list side by side |

**Angular 22, standalone components, plain SCSS. No Angular Material** — a deliberate
decision, so the shared components (buttons, fields, badges, property cards, filters,
navigation, tables, dialogs) are written once in SCSS **before** any page is built.

Because there is no component library, **you write the accessibility yourself**: a focus
trap and an Escape handler on every dialog, an `aria-label` on every icon-only button,
visible focus everywhere, and keyboard navigation that actually works.

Every reusable component needs loading, empty, success, error, selected, disabled and
pressed states. Empty states matter more than usual here — a new account has an empty
shortlist, an empty inbox and no visit requests.

**The interface is English only.** Urdu is deliberately out of scope: do not add a
translation layer, locale files or keys standing in for labels that only ever render in one
language.

---

## 13. Things that will bite you

- **The role claim key is the long URI**, `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`, not `role`.
- **`email_verified` is the string `"true"`**, not a boolean.
- **JSON is camelCase**, and an acronym is lowercased whole: `cnicNumber`, not `cNICNumber`.
- **`/hubs/chat` is not under `/api/v1`.** Build the hub URL from the origin, not the API base.
- **Two silent refreshes at once will race.** Queue 401s behind one in-flight refresh.
- **`refresh` rotates the refresh token.** Store the new one or the next refresh fails.
- **Opening a conversation twice is a 200, not an error.** Do not check first.
- **`markedCount: 0` is a success.**
- **`preferredAt` must be future and within 60 days; `inspectedAt` must be past.** Use
  pickers that cannot produce the wrong side.
- **`pageSize` above 50 is a 400**, not a clamp.
- **An unknown `cityId` is a 422**, not an empty list. Same for area, landmark and facility.
- **A 422 message is copy.** Show it verbatim.
- **A number is not an enum value.** `"5"` for a three-value enumeration is a 400 — send the
  name.
- **Photo upload is `multipart/form-data`, field name `file`**, 5 MB, and the server decodes
  the bytes rather than trusting the extension. Do not set `Content-Type` by hand; let the
  browser set the boundary.
- **Deleting a photo from a published listing does not delete it.** It proposes a removal,
  and the photo stays public until an admin approves.

---

## 14. A build order that works

1. **The shared foundation first** — SCSS tokens, buttons, fields, badges, the property
   card, dialogs. Everything else is built from these, and building them later means
   rewriting every page.
2. **Auth end to end** — register, the code out of Mailpit, verify, login, the interceptor,
   silent refresh, the four guards. Nothing else can be tested until this works.
3. **Search, filters and the property detail.** The largest surface, and entirely anonymous,
   so it needs nothing but step 1.
4. **The seeker's actions** — shortlist, visit request, review, report.
5. **Messaging**, REST first and the hub second. It must work without WebSockets.
6. **The owner dashboard and the listing form**, including the revision states and the photo
   flow — the fiddliest screen in the product.
7. **The admin panel**, five tabs.
8. **The responsive pass** at all four breakpoints, on a real phone as well as an emulator,
   then the accessibility pass.

**Sign in as the seeded accounts and click through the API in Swagger before writing a
screen.** Ten minutes there will tell you more about what a page needs than any amount of
reading — including this document.

---

## 15. If something is missing

This document is meant to be complete. If you need a field, an endpoint or a rule that is
not here:

- **Check `RoomRaah.openapi.json` first** — it has every shape, including the ones this
  document summarises.
- If it is genuinely absent, **it is a backend gap, not a licence to invent one.** Say what
  you need and it gets built and written down. That is how the whole backend was built, and
  it is why five rules that described impossible behaviour were found before any code was
  written rather than after.
