// Proves the guards actually catch a violation. A probe that reports nothing caught is
// probably broken, so every rule in check-rules.mjs has a fixture that must trip it and a
// fixture that must not.
//
// The fixtures earned a second round. The first version of this suite was green while the
// guard let six real leaks through, including an owner's email rendered straight onto the
// page — because every fixture had been written in the spelling the author had in mind
// (`ownerPhone`) rather than the one Angular produces (`listing.owner.phone`). A fixture
// only ever proves the guard catches what somebody already thought of, so the ones below
// are deliberately written the way the framework writes them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { scanContactLeaks, scanForbiddenStack, scanForbiddenImports } from './check-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLEAN = join(HERE, 'fixtures', 'clean-app');
const LEAKING = join(HERE, 'fixtures', 'leaking-app');

// Every rule the contact guard claims to enforce. If a rule is added to check-rules.mjs
// without a fixture that trips it, this list and the assertion below stop agreeing.
const CONTACT_RULES = [
  'tel-link',
  'mailto-link',
  'whatsapp',
  'owner-contact-field',
  'owner-contact-index',
  'call-owner',
  'hardcoded-pk-number',
  'owner-contact-nearby',
];

const IMPORT_RULES = ['material-import', 'tailwind-import'];

test('a correct source tree passes the contact guard', () => {
  const result = scanContactLeaks(join(CLEAN, 'src'));
  assert.equal(result.status, 'clean', `unexpected findings: ${JSON.stringify(result.findings, null, 2)}`);
  assert.ok(result.filesScanned >= 2, 'the clean fixture should have been read, not skipped');
});

test("a seeker's own phoneNumber is not an owner contact leak", () => {
  const result = scanContactLeaks(join(CLEAN, 'src'));
  const onSignup = result.findings.filter((f) => f.file.includes('signup'));
  assert.deepEqual(onSignup, [], 'phoneNumber on the register form is a legitimate field');
});

/**
 * Business rule 116. The Admin user detail screen is the one place in the product that
 * shows a phone number and a CNIC, and it is required. A guard that blocked it would be
 * a guard somebody turns off, which costs more than it ever saved.
 */
test('the admin user detail screen is allowed its phone number and CNIC', () => {
  const result = scanContactLeaks(join(CLEAN, 'src'));
  const onAdmin = result.findings.filter((f) => f.file.includes('admin-user-detail'));
  assert.deepEqual(onAdmin, [], 'rule 116 requires these fields on this screen');
});

/**
 * The API returns owner as a nested object — ListingDetailDto.owner is a ListingOwnerDto
 * of { displayName, identityVerified, identityCheckedAt } — so binding through a dot is
 * the correct, everyday idiom and must stay clean.
 */
test('binding the owner object the API actually returns is not a leak', () => {
  const result = scanContactLeaks(join(CLEAN, 'src'));
  const onDetail = result.findings.filter((f) => f.file.includes('property-detail'));
  assert.deepEqual(onDetail, [], 'listing.owner.displayName is the real shape and is legitimate');
});

test('every contact rule is tripped by the leaking fixture', () => {
  const result = scanContactLeaks(join(LEAKING, 'src'));
  assert.equal(result.status, 'violations');

  const caught = new Set(result.findings.map((f) => f.rule));
  for (const rule of CONTACT_RULES) {
    assert.ok(caught.has(rule), `rule "${rule}" caught nothing — it is not being enforced`);
  }
});

/**
 * The regression, named line by line. These six are the exact leaks that passed the first
 * version of the guard; each one is asserted individually so that a future loosening of a
 * pattern says which idiom it stopped catching, rather than only that a count changed.
 */
test('the idioms Angular actually produces are each caught', () => {
  const findings = scanContactLeaks(join(LEAKING, 'src')).findings;
  const caughtOn = (needle) => findings.some((f) => f.text.includes(needle));

  assert.ok(caughtOn('tel:{{ listing.owner.phone }}'), 'an interpolated tel: link');
  assert.ok(caughtOn("'tel:' + listing.owner.phone"), 'a concatenated tel: link');
  assert.ok(caughtOn('{{ listing.owner.email }}'), "an owner's email rendered on the page");
  assert.ok(caughtOn('owner?.contactNumber'), 'optional chaining onto a contact field');
  assert.ok(caughtOn("owner['phone']"), 'a contact field read through an index');
  assert.ok(caughtOn('mailto:'), 'a mailto: link');
});

test('a finding names the file and the line, so it can be acted on', () => {
  const result = scanContactLeaks(join(LEAKING, 'src'));
  for (const finding of result.findings) {
    assert.match(finding.file, /leaking-app/);
    assert.ok(finding.line > 0, 'a finding without a line number is not actionable');
    assert.ok(finding.why.length > 0, 'a finding must say why it is a violation');
  }
});

test('Angular Material and Tailwind are both refused', () => {
  const result = scanForbiddenStack(join(LEAKING, 'package.json'));
  assert.equal(result.status, 'violations');

  const names = result.findings.map((f) => f.text).sort();
  assert.deepEqual(names, ['@angular/material', 'tailwindcss']);
});

test('an Angular project without them passes the stack guard', () => {
  const result = scanForbiddenStack(join(CLEAN, 'package.json'));
  assert.equal(result.status, 'clean');
});

/**
 * A manifest is not the only door. An agent that writes the import has made the decision
 * in the source whatever package.json says, and the manifest is often a step behind.
 */
test('Material, CDK and Tailwind are refused in the source too, not only the manifest', () => {
  const result = scanForbiddenImports(join(LEAKING, 'src'));
  assert.equal(result.status, 'violations');

  const caught = new Set(result.findings.map((f) => f.rule));
  for (const rule of IMPORT_RULES) {
    assert.ok(caught.has(rule), `rule "${rule}" caught nothing — it is not being enforced`);
  }
});

test('a clean source tree imports neither', () => {
  const result = scanForbiddenImports(join(CLEAN, 'src'));
  assert.equal(result.status, 'clean', `unexpected findings: ${JSON.stringify(result.findings, null, 2)}`);
});

test('scanning nothing reports "skipped", never "clean"', () => {
  // Before the Angular app exists there is no src/ to read. Reporting that as clean would
  // be a green tick for a check that never ran.
  const missing = scanContactLeaks(join(HERE, 'fixtures', 'no-such-app', 'src'));
  assert.equal(missing.status, 'skipped');
  assert.notEqual(missing.status, 'clean');
  assert.equal(missing.filesScanned, 0);

  const noManifest = scanForbiddenStack(join(HERE, 'fixtures', 'no-such-app', 'package.json'));
  assert.equal(noManifest.status, 'skipped');

  const noImports = scanForbiddenImports(join(HERE, 'fixtures', 'no-such-app', 'src'));
  assert.equal(noImports.status, 'skipped');
});

/**
 * The tight rules want the contact word next to the owner. These put a token in between,
 * which is every bit as likely and walked past all of them — `owner.profile.phone` is not
 * an exotic spelling, it is what you write the moment the owner has a profile object.
 */
test('an owner and a contact field with something in between are still caught', () => {
  const findings = scanContactLeaks(join(LEAKING, 'src')).findings;
  const caughtOn = (needle) => findings.some((f) => f.text.includes(needle));

  assert.ok(caughtOn('listing.owner.profile.phone'), 'a nested profile object');
  assert.ok(caughtOn('ownerInfo.phone'), 'a wrapper object');
  assert.ok(caughtOn('ownerProfile.emailAddress'), 'a wrapper object and a suffixed field');
  assert.ok(caughtOn('landlord.phone'), 'the synonym reached for when told not to say owner');
  assert.ok(caughtOn('listing.owner.cnicNumber'), "an owner's CNIC, which only an admin sees");
  assert.ok(caughtOn('Helpline +92 42 111 222 333'), 'a landline, not only a mobile');
});

/**
 * The proximity rule is a heuristic, and heuristics misfire on the sentences that describe
 * them. The first thing the widened rule caught was a fixture comment explaining the rule —
 * "not an owner's, so the contact guard must not flag it" puts the two four words apart.
 * The tight rules still read comments, because a commented-out `owner.phone` is intent.
 */
test('prose about the rule does not trip the rule', () => {
  const result = scanContactLeaks(join(CLEAN, 'src'));

  assert.equal(result.status, 'clean', `unexpected findings: ${JSON.stringify(result.findings, null, 2)}`);
});

/**
 * The escape hatch has to be load-bearing, or it is decoration. Without the marker this
 * exact line is a finding; with it, it is not — and that is what makes it safe to widen a
 * rule that cannot tell an owner reading from an owner typing.
 */
test('the suppression marker is what is doing the work, and only on its own line', () => {
  const line = "<p>Owner accounts need a CNIC for the identity check.</p>";

  const flagged = scanContactLeaks(join(CLEAN, 'src'));
  assert.equal(flagged.status, 'clean');

  // The same text without the marker, written to a directory of its own.
  const probe = mkdtempSync(join(tmpdir(), 'roomraah-suppression-'));

  try {
    mkdirSync(join(probe, 'src'), { recursive: true });
    writeFileSync(join(probe, 'src', 'owner-register.component.html'), `${line}
`);

    const unmarked = scanContactLeaks(join(probe, 'src'));

    assert.equal(unmarked.status, 'violations', 'without the marker this line must be a finding');
    assert.equal(unmarked.findings[0].rule, 'owner-contact-nearby');
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
});
