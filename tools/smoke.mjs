/**
 * Walks the demo path in a real browser and reports whether the product works.
 *
 * This exists because clicking through twenty pages by hand after every change is the
 * single biggest time sink left in this project, and a script is better at it anyway: it
 * notices a console error, a 500 nobody looked at, and a button that renders but does
 * nothing, none of which a person scanning a page reliably catches.
 *
 * Selectors here are deliberately structural - roles, labels, `data-smoke` attributes -
 * and never CSS classes. The visual layer is going to be rewritten by somebody else after
 * this build; a walk pinned to class names would fail the moment that happened, and a
 * smoke test that cries wolf gets ignored, which is worse than not having one.
 *
 *   node tools/smoke.mjs                 the whole walk
 *   node tools/smoke.mjs --only=search   one step, by name
 *   node tools/smoke.mjs --headed        watch it happen
 */
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, '.verify', 'screens');
const APP = process.env.SMOKE_URL ?? 'http://localhost:4200';
const API = process.env.SMOKE_API ?? 'http://52.72.119.254:8080/api/v1';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const headed = args.includes('--headed');

const PASSWORD = 'Password1';
const DEFAULT_VIEWPORT = { width: 1280, height: 900 };
const BREAKPOINT_VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 800, height: 1000 },
  { name: 'laptop', width: 1280, height: 900 },
  { name: 'desktop', width: 1600, height: 1000 },
];

export const ACCOUNTS = {
  seeker: 'seeker1@roomraah.local',
  unverified: 'seeker.unverified@roomraah.local',
  owner: 'owner.checked@roomraah.local',
  admin: 'admin@roomraah.local',
  adminNoInspect: 'admin2@roomraah.local',
};

/**
 * The walk. Append a step in the same commit that adds the page it covers - a page that is
 * not in here is a page nobody is checking.
 *
 *   as       sign in as this account first (omitted = anonymous, which is itself worth
 *            asserting on the public pages: browsing must not require an account)
 *   goto     route to open
 *   expect   things that must be on the page. A string is text; { role, name } is a role
 *            query; { sel } is a raw selector.
 *   absent   things that must NOT be on the page - this is where a rule like "no owner
 *            contact" gets checked against a rendered page rather than against the source.
 *   do       optional async (page) => {} for interactions
 *   allow    request paths whose 4xx is the point of the step rather than a failure
 */
export const WALK = [
  {
    name: 'landing',
    goto: '/',
    expect: [{ role: 'link', name: /search/i }],
  },
  {
    name: 'login-rejects-bad-password',
    goto: '/login',
    allow: ['/auth/login'],
    do: async (page) => {
      await page.fill('input[type=email]', ACCOUNTS.seeker);
      await page.fill('input[type=password]', 'DefinitelyWrong1');
      await page.click('button[type=submit]');
      // Wait for the refusal rather than assuming it has arrived: the API is remote, and
      // asserting too early would pass on a screen that never showed anything.
      await page.waitForSelector('[role=alert], [data-smoke=form-error]', { timeout: 15000 });
    },
    // The point of the step: a wrong password must produce readable copy, not a blank
    // screen and not a stack trace. This is the kind of thing a judge finds by accident.
    expect: [{ sel: '[role=alert], [data-smoke=form-error]' }],
  },
  {
    name: 'how-it-works',
    goto: '/how-it-works',
    expect: ['How RoomRaah works'],
  },
  {
    name: 'search',
    goto: '/search',
    do: async (page) => {
      const toggle = page.getByRole('button', { name: /^filters/i });
      const panel = page.locator('#filter-panel');
      const panelState = () => panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
        const style = getComputedStyle(element);
        return {
          exposed: style.display !== 'none' && visibleWidth > 2,
          display: style.display,
          transform: style.transform,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewport: innerWidth,
        };
      });
      const waitForExposure = (wanted) => page.waitForFunction((shouldBeExposed) => {
        const element = document.querySelector('#filter-panel');
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
        const exposed = getComputedStyle(element).display !== 'none' && visibleWidth > 2;
        return exposed === shouldBeExposed;
      }, wanted, { timeout: 2500 });

      for (const viewport of BREAKPOINT_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        if (viewport.width <= 1024) {
          if (!(await toggle.isVisible())) throw new Error(`${viewport.name}: filter toggle is hidden`);
          await waitForExposure(false);
          const before = await panelState();
          if (before.exposed) throw new Error(`${viewport.name}: filters start open ${JSON.stringify(before)}`);
          await toggle.click();
          await waitForExposure(true);
          if (!(await panelState()).exposed) throw new Error(`${viewport.name}: filter panel did not open`);
          await page.getByRole('button', { name: /close filters/i }).click();
          await waitForExposure(false);
        } else {
          if (await toggle.isVisible()) throw new Error(`${viewport.name}: persistent filters still have a toggle`);
          await waitForExposure(true);
          if (!(await panelState()).exposed) throw new Error(`${viewport.name}: persistent filters are hidden`);
        }
      }
      await page.setViewportSize(DEFAULT_VIEWPORT);
    },
    expect: [{ sel: '[data-smoke=results] app-property-card' }],
    viewports: BREAKPOINT_VIEWPORTS,
  },
  {
    // Filters live in the query string so a filtered search is shareable and Back works.
    // Opening one cold is the proof: the panel and the results must both come from the URL.
    name: 'search-filtered-by-url',
    goto: '/search?roomType=Private&availableOnly=true&sort=PriceLowToHigh',
    expect: [{ sel: '[data-smoke=results] app-property-card' }],
  },
  {
    // An id that names nothing is a 422 carrying a sentence written to be read. The bug
    // this guards against is showing an empty grid, which reads as "no rooms match".
    name: 'search-unknown-city-shows-the-reason',
    goto: '/search?cityId=999999',
    allow: ['/properties'],
    expect: [{ sel: '[data-smoke=search-error]' }],
  },
  {
    name: 'map-search-needs-a-place',
    goto: '/search/map',
    expect: [{ sel: '[data-smoke=map-needs-landmark]' }, { role: 'link', name: /choose a place/i }],
  },
  {
    // Landmark 1 is University of the Punjab in the contract seed. The map calls the same
    // public search endpoint, then supplies an equivalent list for keyboard-only use.
    name: 'map-search-by-landmark',
    goto: '/search/map?landmarkId=1&sort=Distance',
    do: async (page) => {
      await page.waitForSelector('[data-smoke=map-canvas].leaflet-container', { timeout: 15000 });
      await page.waitForSelector('[data-smoke=map-listing]', { timeout: 15000 });
      const locate = page.getByRole('button', { name: /show on map/i }).first();
      await locate.click();
      await page.waitForSelector('[data-smoke=map-locate][aria-pressed=true]', { timeout: 5000 });
      if ((await locate.getAttribute('aria-pressed')) !== 'true') {
        throw new Error('selecting a room did not select its map marker');
      }
    },
    expect: [
      { sel: '[data-smoke=map-canvas].leaflet-container' },
      { sel: '[data-smoke=map-listing]' },
      { role: 'link', name: /list view/i },
    ],
    viewports: BREAKPOINT_VIEWPORTS,
    responsiveScreenshots: true,
  },
  {
    name: 'property-detail',
    goto: '/property/4',
    expect: ['About this room', 'What we checked', 'Listed by'],
    viewports: BREAKPOINT_VIEWPORTS,
  },
  {
    name: 'property-photos',
    goto: '/property/4/photos',
    expect: ['Photographs'],
  },
  {
    name: 'property-reviews',
    goto: '/property/1/reviews',
    expect: ['Reviews'],
  },
  {
    name: 'unknown-listing-is-not-a-blank-page',
    goto: '/property/987654',
    allow: ['/properties/987654'],
    expect: [{ sel: '[data-smoke=detail-error]' }],
  },
  {
    name: 'compare-empty-is-not-a-blank-page',
    goto: '/compare',
    expect: [{ sel: '[data-smoke=compare-empty]' }],
  },
  {
    // Ids in the query string, so a comparison survives being pasted to somebody else.
    name: 'compare-by-url',
    goto: '/compare?ids=1,2,4',
    expect: [{ sel: '[data-smoke=compare-table]' }, 'Monthly total'],
  },
  {
    // A fourth id is a 422 the interface is supposed to have prevented. It is capped where
    // the URL is read, so this must render a table and not an error.
    name: 'compare-caps-at-three',
    goto: '/compare?ids=1,2,4,5,6',
    expect: [{ sel: '[data-smoke=compare-table]' }],
  },
  {
    name: 'saved-needs-an-account',
    goto: '/saved',
    do: async (page) => {
      // Signed out, the guard sends them to sign in and remembers where they were going.
      await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 });
    },
  },
  {
    name: 'messages-needs-an-account',
    goto: '/messages',
    do: async (page) => {
      await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 });
    },
  },
  {
    name: 'not-found',
    goto: '/no-such-page',
    expect: [{ role: 'link', name: /search|home|roomraah/i }],
  },
  {
    name: 'login',
    goto: '/login',
    do: async (page) => {
      await page.fill('input[type=email]', ACCOUNTS.seeker);
      await page.fill('input[type=password]', PASSWORD);
      await page.click('button[type=submit]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
    },
  },
  {
    name: 'saved-list',
    as: 'seeker',
    goto: '/saved',
    expect: [{ sel: '[data-smoke=saved-results], [data-smoke=saved-empty]' }],
  },
  {
    // The page the whole review feature hangs off: completing a visit is what unlocks
    // writing one, and a seeker with nowhere to press complete can never review anything.
    name: 'my-visits',
    as: 'seeker',
    goto: '/visits',
    expect: [{ sel: '[data-smoke=visits-list], [data-smoke=visits-empty]' }],
  },
  {
    name: 'request-a-visit',
    as: 'seeker',
    goto: '/property/4/visit',
    expect: [
      { role: 'heading', name: /request a visit/i },
      { sel: 'input[type=datetime-local]' },
      { role: 'button', name: /send the request/i },
    ],
  },
  {
    // The date field must open inside the window the server accepts - in the future and at
    // most sixty days ahead - because either side of it is a 400 nobody can act on.
    name: 'visit-date-cannot-be-in-the-past',
    as: 'seeker',
    goto: '/property/4/visit',
    do: async (page) => {
      const field = page.locator('input[type=datetime-local]');
      const min = await field.getAttribute('min');
      const max = await field.getAttribute('max');
      if (!min || !max) throw new Error('the visit date picker has no min/max window');
      if (new Date(min) <= new Date()) throw new Error('min is not in the future: ' + min);
      const days = (new Date(max) - new Date(min)) / 86400000;
      if (days > 60) throw new Error('max is more than 60 days ahead');
    },
  },
  {
    // A review needs a completed visit, so this either shows the form or shows the sentence
    // saying why not. What it must never do is show a blank page or a stack trace.
    name: 'write-review',
    as: 'seeker',
    goto: '/property/1/review',
    expect: [{ role: 'heading', name: /write a review/i }, { sel: 'textarea' }],
  },
  {
    name: 'report-dialog-opens',
    as: 'seeker',
    goto: '/property/4',
    do: async (page) => {
      await page.getByRole('button', { name: /report this listing/i }).click();
      await page.waitForSelector('[role=dialog]', { timeout: 5000 });
    },
    expect: [{ sel: '[role=dialog]' }, { role: 'button', name: /send report/i }],
  },
  {
    // Contact in this product happens against a listing or not at all, so this button is
    // the only door into messaging for a seeker. Asking for the same thread twice hands
    // back the one that exists, which is why the step can run again and again.
    name: 'message-the-owner-opens-a-thread',
    as: 'seeker',
    goto: '/property/4',
    do: async (page) => {
      await page.getByRole('button', { name: /message the owner/i }).click();
      await page.waitForURL((u) => u.pathname.startsWith('/messages'), { timeout: 15000 });
      await page.waitForSelector('[data-smoke=messages-thread]', { timeout: 15000 });
    },
    expect: [{ sel: '[data-smoke=messages-layout]' }],
  },
  {
    name: 'messages',
    as: 'seeker',
    goto: '/messages',
    expect: [
      { role: 'heading', name: /^messages$/i },
      { sel: '[data-smoke=messages-layout], [data-smoke=messages-empty]' },
    ],
    viewports: BREAKPOINT_VIEWPORTS,
  },
  {
    // A message must appear in the thread it was sent to, exactly once. Twice is the bug
    // this feature is prone to - the hub pushes it and the poll fetches it again - and it
    // reads as broken even though nothing is.
    name: 'sending-a-message-shows-it-once',
    as: 'seeker',
    goto: '/messages',
    do: async (page) => {
      await page.waitForSelector('[data-smoke=messages-thread]', { timeout: 15000 });
      const body = 'Smoke walk ' + Date.now();
      await page.fill('#message-body', body);
      await page.getByRole('button', { name: /^send$/i }).click();

      const bubble = page.locator('[data-smoke=messages-thread]').getByText(body, { exact: true });
      await bubble.first().waitFor({ timeout: 15000 });
      // Give the fallback poll a turn, then check it did not draw a second copy.
      await page.waitForTimeout(1500);
      const drawn = await bubble.count();
      if (drawn !== 1) throw new Error('the message was drawn ' + drawn + ' times');
    },
  },
  {
    name: 'profile',
    as: 'seeker',
    goto: '/profile',
    expect: [
      { sel: '[data-smoke=profile-card]' },
      { sel: '[data-smoke=profile-name]' },
      { role: 'button', name: /change your password/i },
    ],
  },
  {
    name: 'owner-dashboard',
    as: 'owner',
    goto: '/owner',
    expect: [
      { sel: '[data-smoke=owner-listings], [data-smoke=owner-empty]' },
      { role: 'link', name: /add a listing/i },
      'Visit requests',
    ],
    viewports: BREAKPOINT_VIEWPORTS,
  },
  {
    // The whole point of the owner screens: a save on a published listing is a proposal, and
    // the owner is told so before they type, not after they press. Rule 2 of AGENTS.md §3.
    name: 'editing-a-live-listing-says-it-is-a-revision',
    as: 'owner',
    goto: '/owner/listing/4',
    expect: [
      { sel: '[data-smoke=form-revision]' },
      { role: 'button', name: /send changes for review/i },
    ],
    absent: [{ role: 'button', name: /^save$/i }],
  },
  {
    name: 'listing-form-has-a-map-pin',
    as: 'owner',
    goto: '/owner/listing/4',
    do: async (page) => {
      // Leaflet renders its tiles into a container it builds itself. If the stylesheet or
      // the library failed to load, this is what would be missing.
      await page.waitForSelector('.leaflet-container', { timeout: 10000 });
    },
    expect: [{ sel: '.leaflet-container' }, { sel: '[data-smoke=photo-list]' }],
  },
  {
    name: 'new-listing-form',
    as: 'owner',
    goto: '/owner/listing/new',
    expect: [
      { role: 'heading', name: /add a listing/i },
      { role: 'button', name: /create listing/i },
    ],
  },
  {
    name: 'admin-listings',
    as: 'admin',
    goto: '/admin/listings',
    do: async (page) => {
      await page.locator('[data-smoke=admin-listings] select').first().selectOption('PendingReview');
      await page.waitForSelector('[data-smoke=admin-listings-list]');
      await page.locator('[data-smoke=admin-listings-list]').getByRole('button', { name: /review listing/i }).first().click();
      await page.waitForSelector('[data-smoke=admin-listing-detail]', { timeout: 15000 });
    },
    expect: [
      { sel: '[data-smoke=admin-shell]' },
      { sel: '[data-smoke=admin-listings-list], [data-smoke=admin-listings-empty]' },
      { sel: '[data-smoke=admin-listing-detail]' },
      { role: 'button', name: /record check/i },
    ],
    viewports: BREAKPOINT_VIEWPORTS,
  },
  {
    name: 'admin-revisions',
    as: 'admin',
    goto: '/admin/revisions?kind=Content',
    do: async (page) => {
      await page.getByRole('button', { name: /^availability$/i }).click();
      await page.waitForURL((url) => url.searchParams.get('kind') === 'Availability');
      await page.waitForSelector('[data-loaded-kind=Availability]', { timeout: 15000 });
    },
    expect: [
      { sel: '[data-smoke=admin-revisions]' },
      { sel: '[data-smoke=admin-revisions-list], [data-smoke=admin-revisions-empty]' },
    ],
  },
  {
    name: 'admin-reports-and-reviews',
    as: 'admin',
    goto: '/admin/reports',
    expect: [
      { sel: '[data-smoke=admin-reports-list], [data-smoke=admin-reports-empty]' },
      { sel: '[data-smoke=admin-reviews-list], [data-smoke=admin-reviews-empty]' },
    ],
  },
  {
    name: 'admin-inspections',
    as: 'admin',
    goto: '/admin/inspections',
    expect: [
      { sel: '[data-smoke=admin-inspections-list], [data-smoke=admin-inspections-empty]' },
      { sel: '[data-smoke=inspection-record-form]' },
      { sel: '[data-smoke=badge-controls]' },
    ],
  },
  {
    name: 'admin-without-inspection-permission',
    as: 'adminNoInspect',
    goto: '/admin/inspections',
    expect: [{ role: 'button', name: /remove badge/i }],
    absent: [
      { role: 'button', name: /record inspection/i },
      { role: 'button', name: /grant badge/i },
    ],
  },
  {
    name: 'admin-users',
    as: 'admin',
    goto: '/admin/users',
    expect: [{ sel: '[data-smoke=admin-users-list], [data-smoke=admin-users-empty]' }],
  },
  {
    // The detail is rule 116's one sanctioned identity view. It is exercised but never
    // screenshotted, so private account fields do not end up in test artifacts.
    name: 'admin-user-detail',
    as: 'admin',
    goto: '/admin/users',
    noScreenshot: true,
    do: async (page) => {
      await page.locator('[data-smoke=admin-user-row]').first().getByRole('button').click();
      await page.waitForSelector('[data-smoke=admin-user-detail]', { timeout: 10000 });
    },
    expect: [
      { sel: '[data-smoke=admin-user-detail]' },
      { sel: '[data-smoke=admin-user-phone]' },
    ],
  },
  {
    // Signed in, wrong role. Home rather than the sign-in screen: signing in again would
    // not help. Getting this wrong looks like a broken session.
    name: 'seeker-cannot-reach-admin',
    as: 'seeker',
    goto: '/admin/listings',
    do: async (page) => {
      await page.waitForURL((u) => !u.pathname.startsWith('/admin'), { timeout: 10000 });
    },
  },
];

/** Rule 1 of AGENTS.md section 3, checked against what actually rendered. */
const CONTACT_LEAK = /\btel:|mailto:|wa\.me|whatsapp|call\s+(the\s+)?owner/i;

function label(state, name) {
  const mark = { pass: '  PASS', fail: '  FAIL' }[state];
  console.log(mark + '  ' + name);
}

async function reachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

function toLocator(page, want) {
  if (typeof want === 'string') return page.getByText(want, { exact: false });
  if (want.role) return page.getByRole(want.role, { name: want.name });
  return page.locator(want.sel);
}

function describe(want) {
  if (typeof want === 'string') return 'text "' + want + '"';
  if (want.role) return want.role + ' "' + want.name + '"';
  return want.sel;
}

/** Cheap accessibility and responsive checks over the DOM the browser actually rendered. */
async function auditRenderedPage(page) {
  return page.evaluate(() => {
    const issues = [];
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const accessibleName = (element) => {
      const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      return (
        element.getAttribute('aria-label')?.trim() ||
        labelledBy ||
        element.getAttribute('title')?.trim() ||
        element.textContent?.trim() ||
        ''
      );
    };

    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (overflow > 2) issues.push(`horizontal overflow by ${overflow}px`);

    const ids = new Map();
    for (const element of document.querySelectorAll('[id]')) {
      if (!element.id) continue;
      ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) issues.push(`duplicate id #${id}`);
    }

    for (const image of document.querySelectorAll('img')) {
      if (visible(image) && !image.hasAttribute('alt')) issues.push('visible image without alt text');
    }

    for (const control of document.querySelectorAll('button, a[href], [role="button"]')) {
      if (visible(control) && !accessibleName(control)) {
        issues.push(`${control.tagName.toLowerCase()} without an accessible name`);
      }
    }

    if (document.querySelector('a button, button a, a [role="button"], button [role="link"]')) {
      issues.push('nested interactive controls');
    }

    for (const field of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      if (!visible(field)) continue;
      const hasLabel =
        field.closest('label') != null ||
        (field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`) != null) ||
        accessibleName(field) !== '';
      if (!hasLabel) issues.push(`${field.tagName.toLowerCase()} without a label`);
    }

    const headingCount = document.querySelectorAll('h1').length;
    if (headingCount !== 1) issues.push(`expected one h1, found ${headingCount}`);

    return [...new Set(issues)];
  });
}

async function signIn(page, email) {
  await page.goto(APP + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

async function run() {
  if (!(await reachable(API + '/facilities'))) {
    console.error('\n  The API at ' + API + ' is not answering.');
    console.error('  The EC2 box is stopped, or it came back on a different address.');
    console.error('  Nothing below can be checked until it is up - see PLAN.md section 6.\n');
    process.exit(2);
  }
  if (!(await reachable(APP))) {
    console.error('\n  Nothing is serving ' + APP + '. Start it with: npm --prefix app start\n');
    process.exit(2);
  }

  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
  const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
  const page = await context.newPage();

  let problems = [];
  let signedInAs = null;
  let ran = 0;
  let failed = 0;

  for (const step of WALK) {
    if (only && step.name !== only) continue;
    ran++;
    problems = [];
    const allow = step.allow ?? [];

    const onConsole = (m) => {
      if (m.type() !== 'error') return;
      // The browser logs its own line for every failed request. When the step said that
      // request was the point, that line is not a finding - but anything the application
      // itself logged still is.
      const from = m.location()?.url ?? '';
      if (from && allow.some((a) => from.includes(a))) return;
      problems.push('console: ' + m.text().slice(0, 200));
    };
    const onPageError = (e) => problems.push('uncaught: ' + String(e).slice(0, 200));
    const onResponse = (r) => {
      const status = r.status();
      const url = r.url();
      if (status >= 400 && !allow.some((a) => url.includes(a))) {
        problems.push(status + ' ' + url.replace(API, '').slice(0, 120));
      }
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);

    try {
      await page.setViewportSize(DEFAULT_VIEWPORT);
      if (step.as && signedInAs !== step.as) {
        await signIn(page, ACCOUNTS[step.as]);
        signedInAs = step.as;
        problems = [];
      }
      if (step.goto) {
        await page.goto(APP + step.goto, { waitUntil: 'networkidle', timeout: 30000 });
      }
      if (step.do) await step.do(page);
      await page.waitForTimeout(400);

      for (const want of step.expect ?? []) {
        if ((await toLocator(page, want).count()) === 0) {
          problems.push('missing: ' + describe(want));
        }
      }
      for (const unwanted of step.absent ?? []) {
        if ((await toLocator(page, unwanted).count()) > 0) {
          problems.push('present but must not be: ' + describe(unwanted));
        }
      }

      // The source guard cannot see a phone number that arrived in a JSON payload, so the
      // rendered page is checked too. The admin user detail screen is rule 116's one
      // sanctioned exception and opts out by name.
      const body = await page.locator('body').innerHTML();
      const leak = body.match(CONTACT_LEAK);
      if (leak && !step.name.startsWith('admin-user')) {
        problems.push('owner-contact leak: ' + leak[0]);
      }

      for (const issue of await auditRenderedPage(page)) {
        problems.push('accessibility/layout: ' + issue);
      }

      for (const viewport of step.viewports ?? []) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(250);
        for (const issue of await auditRenderedPage(page)) {
          problems.push(`${viewport.name}: ${issue}`);
        }
        if (step.responsiveScreenshots) {
          await page.screenshot({
            path: join(SHOTS, `${step.name}-${viewport.name}.png`),
            fullPage: true,
          });
        }
      }

      await page.setViewportSize(DEFAULT_VIEWPORT);

      if (!step.noScreenshot) {
        await page.screenshot({ path: join(SHOTS, step.name + '.png'), fullPage: true });
      }
    } catch (err) {
      problems.push(String(err.message ?? err).split('\n')[0].slice(0, 200));
    }

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);

    if (problems.length) {
      failed++;
      label('fail', step.name);
      for (const problem of problems) console.log('          ' + problem);
    } else {
      label('pass', step.name);
    }
  }

  await browser.close();
  console.log('\n  ' + (ran - failed) + '/' + ran + ' steps passed. Screenshots in .verify/screens\n');
  process.exit(failed ? 1 : 0);
}

run();
