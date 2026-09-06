#!/usr/bin/env node
// Mechanical guards for the two frontend rules an agent drifts on.
//
//   contact — an owner's contact details never appear (AGENTS.md §3.1, brief §1.1 and §10.1)
//   stack   — no Angular Material, no Tailwind (AGENTS.md §4, brief §12)
//
// Both are decisions, not preferences, and both are invisible in a diff until somebody
// opens the page. Run `npm run guard`. `npm run guard:test` proves this file actually
// catches a violation rather than passing vacuously.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, '..');

const SCANNED_EXTENSIONS = new Set(['.ts', '.html', '.scss', '.css', '.js', '.mjs', '.json']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage', 'out-tsc']);

// What the API actually returns about an owner, and the whole of it:
//
//   ListingDetailDto.owner  -> ListingOwnerDto  { displayName, identityVerified, identityCheckedAt }
//   AdminPropertyDto.owner  -> ListingOwnerSummaryDto { id, fullName, identityStatus, identityCheckedAt }
//   plus the flat ownerDisplayName / ownerId / ownerName / ownerResponseNote on other DTOs
//
// So any contact field hanging off an owner was invented on the client, in whichever
// spelling. Note the shape: `owner` is a NESTED OBJECT on the two DTOs a listing screen
// actually binds to, which makes `listing.owner.phone` the most likely spelling of this
// mistake rather than an exotic one. An earlier version of these patterns allowed only
// `ownerPhone` and `owner_phone` and let every dotted form through — a probe found six
// leaks passing, including an owner's email rendered straight onto the page.
//
// The one place the API does return a phone number and a CNIC is AdminUserDto, the
// Admin user detail screen, which business rule 116 requires. Those fields are named
// `phoneNumber` and `cnicNumber` with no owner prefix, so nothing below matches them —
// deliberately, because a guard that blocks a required screen gets switched off.
// Two groups, because one word behaves differently from the rest. `phone`, `mobile`,
// `email`, `whatsapp` and `contact` are contact words wherever they appear, so a suffix
// does not make them innocent — `contactNumber`, `phoneNo` and `emailAddress` all count,
// and requiring a word boundary after them was how `owner?.contactNumber` escaped.
// `number` on its own is not a contact word, so it keeps the boundary: `owner.number`
// counts and `owner.numberOfListings` does not.
// Two groups, because one word behaves differently from the rest. `phone`, `mobile`,
// `email`, `whatsapp`, `contact` and `cnic` are contact words wherever they appear, so a
// suffix does not make them innocent — `contactNumber`, `phoneNo`, `emailAddress` and
// `cnicNumber` all count, and requiring a word boundary after them was how
// `owner?.contactNumber` escaped. `number` on its own is not a contact word, so it keeps
// the boundary: `owner.number` counts and `owner.numberOfListings` does not.
const CONTACT_WORD = '(?:phone|mobile|email|whatsapp|contact|cnic|number\\b)';

// `landlord` is the synonym a model reaches for when it has been told not to say `owner`,
// which is the moment the rule matters most.
const OWNER_TOKEN = '(?:owner|landlord)';

// An escape hatch, on purpose, and a narrow one.
//
// The guard cannot tell a seeker looking at an owner from an owner filling in their own
// registration form, and the register command really does take a phoneNumber and a CNIC.
// A rule with no way to say "this one is fine" is a rule that gets deleted the first time
// it is wrong, which costs more than every false positive it ever caught. So a line may
// opt out — visibly, greppable, and one line at a time.
//
//   <input formControlName="cnicNumber">  <!-- guard:allow-owner-contact: the owner's own -->
const SUPPRESSION = /guard:allow-owner-contact/i;

const CONTACT_PATTERNS = [
  // No digit requirement after the colon. `tel:{{ owner.phone }}` and `'tel:' + phone`
  // are how a dynamic dial link is actually written, and both used to walk straight past.
  { id: 'tel-link', re: /(?<![\w-])tel:/i, why: 'a tel: link — there is no owner phone number to dial' },
  { id: 'mailto-link', re: /(?<![\w-])mailto:/i, why: 'a mailto: link — an owner has no published email address' },
  { id: 'whatsapp', re: /wa\.me|api\.whatsapp\.com|whatsapp/i, why: 'WhatsApp — removed from the product in spec v3.0' },
  // owner.phone, owner?.phone, owner!.email, ownerPhone, owner_phone, landlord.email.
  {
    id: 'owner-contact-field',
    re: new RegExp(`${OWNER_TOKEN}\\s*[?!]?\\s*[._-]?\\s*${CONTACT_WORD}`, 'i'),
    why: 'an owner contact field the API does not return',
  },
  // owner['phone'], owner["email"] — the same mistake through an index.
  {
    id: 'owner-contact-index',
    re: new RegExp(`${OWNER_TOKEN}\\s*[?!]?\\s*\\[\\s*['"\`]${CONTACT_WORD}`, 'i'),
    why: 'an owner contact field read through an index — still a field the API does not return',
  },
  { id: 'call-owner', re: /\b(call|dial|ring)[\s_-]?owner\b/i, why: 'a call-owner action — contact happens through messaging and visit requests' },
  // Mobiles, landlines and UAN numbers alike. The mobile-only version missed
  // `+92 42 111 222 333`, which is what a help line on a listing page looks like.
  {
    id: 'hardcoded-pk-number',
    re: /(?:\+92|\b0)[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}\b/,
    why: 'a hardcoded Pakistani phone number',
  },
];

// Applied only to lines no rule above matched.
//
// The rules above want the contact word right next to the owner. This one allows anything
// in between on the same line, which catches `owner.profile.phone`, `ownerInfo.phone` and
// `ownerProfile.emailAddress` — every one of which is as likely as `owner.phone` and all of
// which walked past the tight patterns.
//
// No word boundary after the owner token either: `ownerInfo.phone` and
// `ownerProfile.emailAddress` are wrapper objects, and a trailing boundary refuses both.
// The cost is that a line carrying `ownerDisplayName` and somebody else's `email` within
// forty characters will fire; the escape hatch above is the answer to that, and a false
// positive somebody can silence in one visible line is cheaper than a leak nobody sees.
//
// It is deliberately last and deliberately line-scoped. Widening the tight rules to reach
// this far would have made them fire twice on the same line and made their reasons vague;
// letting this one cross lines would make it fire on a component that mentions an owner at
// the top and a form field at the bottom.
const BROAD_CONTACT_PATTERN = {
  id: 'owner-contact-nearby',
  re: new RegExp(`\\b${OWNER_TOKEN}[^\\n]{0,40}?${CONTACT_WORD}`, 'i'),
  why:
    'an owner and a contact field close enough together to be the same thought — ' +
    'if this is the owner filling in their own details, mark the line guard:allow-owner-contact',
};

const FORBIDDEN_DEPENDENCIES = [
  { re: /^@angular\/material$|^@angular\/cdk$/, why: 'Angular Material was rejected deliberately — the shared SCSS components are the design system' },
  { re: /^tailwindcss$|^@tailwindcss\//, why: 'Tailwind was rejected deliberately — the design system is hand-written SCSS' },
];

// A manifest is not the only way these arrive. An agent writing
// `import { MatButtonModule } from '@angular/material/button'` has made the decision in
// the source whatever package.json says, and the manifest may be a step behind or the
// dependency hoisted from somewhere else.
const FORBIDDEN_IMPORTS = [
  { id: 'material-import', re: /['"\`]@angular\/(material|cdk)(?:\/[\w-]+)*['"\`]/, why: 'an Angular Material or CDK import — the design system is hand-written SCSS' },
  { id: 'tailwind-import', re: /['"\`]tailwindcss(?:\/[\w-]+)*['"\`]|@tailwind\s+(base|components|utilities)\b/, why: 'Tailwind — the design system is hand-written SCSS' },
];

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (SCANNED_EXTENSIONS.has(extname(entry))) files.push(path);
  }
  return files;
}

/**
 * Is this line inside a comment?
 *
 * Only the broad rule asks. A proximity heuristic over English prose misfires on exactly
 * the sentences that explain it — "not an owner's, so the contact guard must not flag it"
 * puts an owner and a contact word four words apart, and the first thing the widened rule
 * caught was the fixture describing itself. The tight rules keep scanning comments,
 * because a commented-out `owner.phone` is still somebody's intent.
 *
 * A state machine rather than a per-line test, because the middle line of a block comment
 * carries no marker of its own and is the line a sentence usually lands on.
 */
function commentTracker() {
  let open = false;

  return (line) => {
    const wasOpen = open;
    const trimmed = line.trim();

    for (const [start, end] of [
      ['<!--', '-->'],
      ['/*', '*/'],
    ]) {
      if (line.includes(start) && !line.includes(end, line.indexOf(start) + start.length)) {
        open = true;
      } else if (open && line.includes(end)) {
        open = false;
        return true;
      }
    }

    return (
      wasOpen ||
      open ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('<!--') ||
      trimmed.startsWith('#')
    );
  };
}

/**
 * Scans a source tree for owner-contact leaks.
 * Returns { status: 'skipped' | 'clean' | 'violations', findings, filesScanned }.
 * 'skipped' is deliberately not 'clean': a scan of nothing has proved nothing.
 */
export function scanContactLeaks(sourceRoot) {
  if (!existsSync(sourceRoot)) return { status: 'skipped', findings: [], filesScanned: 0 };

  const findings = [];
  const files = walk(sourceRoot);

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const isComment = commentTracker();

    lines.forEach((line, index) => {
      const commented = isComment(line);

      if (SUPPRESSION.test(line)) return;

      const record = (pattern) =>
        findings.push({
          check: 'contact',
          rule: pattern.id,
          why: pattern.why,
          file: relative(WORKSPACE, file),
          line: index + 1,
          text: line.trim().slice(0, 120),
        });

      let matched = false;

      for (const pattern of CONTACT_PATTERNS) {
        if (pattern.re.test(line)) {
          record(pattern);
          matched = true;
        }
      }

      // Only when nothing more specific had anything to say, so that a line does not
      // collect a precise finding and a vague one saying the same thing — and never in
      // prose, where a proximity rule is guessing.
      if (!matched && !commented && BROAD_CONTACT_PATTERN.re.test(line)) {
        record(BROAD_CONTACT_PATTERN);
      }
    });
  }

  return { status: findings.length ? 'violations' : 'clean', findings, filesScanned: files.length };
}

/**
 * Scans a package.json for the two dependencies the design system rules out.
 * Returns the same shape as scanContactLeaks.
 */
export function scanForbiddenStack(packageJsonPath) {
  if (!existsSync(packageJsonPath)) return { status: 'skipped', findings: [], filesScanned: 0 };

  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  const findings = [];

  for (const name of declared) {
    for (const forbidden of FORBIDDEN_DEPENDENCIES) {
      if (forbidden.re.test(name)) {
        findings.push({
          check: 'stack',
          rule: 'forbidden-dependency',
          why: forbidden.why,
          file: relative(WORKSPACE, packageJsonPath),
          line: 0,
          text: name,
        });
      }
    }
  }

  return { status: findings.length ? 'violations' : 'clean', findings, filesScanned: 1 };
}

/**
 * Scans a source tree for Material, CDK and Tailwind reaching in through an import
 * rather than through the manifest. Same shape as the other two scans.
 */
export function scanForbiddenImports(sourceRoot) {
  if (!existsSync(sourceRoot)) return { status: 'skipped', findings: [], filesScanned: 0 };

  const findings = [];
  const files = walk(sourceRoot);

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_IMPORTS) {
        if (pattern.re.test(line)) {
          findings.push({
            check: 'stack',
            rule: pattern.id,
            why: pattern.why,
            file: relative(WORKSPACE, file),
            line: index + 1,
            text: line.trim().slice(0, 120),
          });
        }
      }
    });
  }

  return { status: findings.length ? 'violations' : 'clean', findings, filesScanned: files.length };
}

function report(name, result, target) {
  if (result.status === 'skipped') {
    console.log(`  SKIPPED  ${name} — ${target} does not exist yet, so nothing was checked`);
    return 0;
  }
  if (result.status === 'clean') {
    console.log(`  PASS     ${name} — ${result.filesScanned} file(s) scanned, nothing found`);
    return 0;
  }
  console.log(`  FAIL     ${name} — ${result.findings.length} violation(s)`);
  for (const f of result.findings) {
    console.log(`\n    ${f.file}:${f.line}`);
    console.log(`      ${f.text}`);
    console.log(`      ${f.why}`);
  }
  console.log('');
  return result.findings.length;
}

function main() {
  // The Angular application lives in frontend/app so that `ng new` cannot overwrite the
  // workspace manifest that holds these guards.
  const appRoot = process.argv[2] ? resolve(process.argv[2]) : join(WORKSPACE, 'app');
  const sourceRoot = join(appRoot, 'src');
  const packageJsonPath = join(appRoot, 'package.json');

  console.log(`RoomRaah frontend guards — ${relative(WORKSPACE, appRoot) || '.'}\n`);

  let violations = 0;
  violations += report('contact', scanContactLeaks(sourceRoot), relative(WORKSPACE, sourceRoot));
  violations += report('stack', scanForbiddenStack(packageJsonPath), relative(WORKSPACE, packageJsonPath));
  violations += report('stack-imports', scanForbiddenImports(sourceRoot), relative(WORKSPACE, sourceRoot));

  if (violations > 0) {
    console.log(`\n${violations} violation(s). These are product rules, not style preferences — see frontend/AGENTS.md §3 and §4.`);
    process.exit(1);
  }
  console.log('\nNo violations.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
