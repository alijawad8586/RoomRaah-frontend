/**
 * One command that answers "is everything fine?".
 *
 *   npm run verify              all four gates
 *   npm run verify -- --fast    skip the browser walk (guard, build, unit tests only)
 *   npm run verify -- --smoke   only the browser walk, against whatever is already served
 *
 * The gates run cheapest-failure-first, and the run stops at the first one that fails:
 * there is no point walking a browser through an application that does not compile, and a
 * wall of downstream noise hides the one line that matters.
 *
 * The browser walk needs the application served. If nothing is on 4200 this starts one and
 * stops it again afterwards, because remembering to do that by hand is exactly the kind of
 * step that gets skipped at eleven at night.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const URL = 'http://localhost:4200';

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const smokeOnly = args.includes('--smoke');

const node = process.execPath;

// The CLI is invoked through its own entry script rather than through `npx`/`ng`. On
// Windows those are `.cmd` shims, and Node refuses to spawn a `.cmd` without a shell
// (EINVAL) — turning the shell back on to work around that would just hand the argument
// list to cmd.exe to re-parse. Running the script directly sidesteps both.
const NG = join(APP, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

function run(command, commandArgs, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd, stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function serving() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(URL, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serving()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const gates = [
  {
    name: 'guard   rules that must never drift',
    skip: smokeOnly,
    run: () => run(node, [join(ROOT, 'tools', 'check-rules.mjs')], ROOT),
  },
  {
    name: 'build   production compile and bundle budget',
    skip: smokeOnly,
    run: () => run(node, [NG, 'build', '--configuration', 'production'], APP),
  },
  {
    name: 'test    unit tests',
    skip: smokeOnly,
    run: () => run(node, [NG, 'test', '--watch=false'], APP),
  },
  {
    name: 'smoke   a real browser walks the demo path',
    skip: fast,
    run: async () => {
      let server = null;
      if (!(await serving())) {
        console.log('\n  nothing on 4200 - starting the dev server for this run\n');
        server = spawn(node, [NG, 'serve'], { cwd: APP, stdio: 'ignore', shell: false });
        if (!(await waitForServer(120000))) {
          server.kill();
          console.error('  the dev server never came up');
          return 1;
        }
      }
      const code = await run(node, [join(ROOT, 'tools', 'smoke.mjs')], ROOT);
      if (server) server.kill();
      return code;
    },
  },
];

const started = Date.now();
const results = [];

for (const gate of gates) {
  if (gate.skip) {
    results.push([gate.name, 'skipped']);
    continue;
  }
  console.log('\n=== ' + gate.name + ' ===\n');
  const code = await gate.run();
  results.push([gate.name, code === 0 ? 'passed' : 'FAILED']);
  if (code !== 0) break;
}

const elapsed = Math.round((Date.now() - started) / 1000);
console.log('\n' + '-'.repeat(60));
for (const [name, state] of results) {
  console.log('  ' + (state === 'passed' ? 'ok  ' : state === 'skipped' ? '--  ' : 'X   ') + name);
}
const bad = results.some(([, state]) => state === 'FAILED');
const ranAll = results.every(([, state]) => state !== 'skipped');
console.log('-'.repeat(60));
console.log(
  bad
    ? '\n  Not fine. Fix the gate marked X above, then run this again.\n'
    : '\n  Fine' +
        (ranAll ? '' : ' as far as it was asked to check') +
        '. ' +
        elapsed +
        's.\n',
);
process.exit(bad ? 1 : 0);
