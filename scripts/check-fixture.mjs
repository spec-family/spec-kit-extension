#!/usr/bin/env node
// Runs the CI template's checks over the fixture, a small Spec Kit project,
// exactly as the template writes them, and then over copies of the fixture
// broken one way each. A job that only ever passes shows nothing: each copy
// has to fail, on the step the case names, with the rule the case names.
//
//   node scripts/check-fixture.mjs        after `npm ci` in fixture/
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = join(root, 'fixture');
const template = readFileSync(join(root, 'templates', 'spec-family.yml'), 'utf8');

const PREFIX = 'npx --no-install @spec-family/';
const steps = [...template.matchAll(/^ +run: (.+)$/gm)].map((match) => match[1]).filter((run) => run.startsWith('npx'));
const fail = (message) => {
  console.error(`check-fixture: ${message}`);
  process.exit(1);
};

if (steps.length !== 3) fail(`the template runs ${steps.length} tools, and this script knows 3`);
for (const step of steps) {
  if (!step.startsWith(PREFIX) || /["']/.test(step)) fail(`a step runs a tool other than as "${PREFIX}<tool> <args>": ${step}`);
}
if (!existsSync(join(fixture, 'node_modules', '@spec-family'))) fail('run `npm ci` in fixture/ first');

// A step's tool and arguments, run by the bin the fixture installed, so a copy
// outside the fixture runs the version the template pins.
const command = (step) => {
  const [tool, ...args] = step.slice(PREFIX.length).split(' ');
  const manifest = JSON.parse(readFileSync(join(fixture, 'node_modules', '@spec-family', tool, 'package.json'), 'utf8'));
  return { tool, args, bin: join(fixture, 'node_modules', '@spec-family', tool, manifest.bin[tool]) };
};

const run = (step, cwd) => {
  const { args, bin } = command(step);
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

let failures = 0;
const report = (ok, line, output) => {
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${line}`);
  if (!ok) {
    failures += 1;
    console.log(output.replace(/^/gm, '       '));
  }
};

// The fixture as it is: every step passes, run as the template writes it.
for (const step of steps) {
  const result = spawnSync(step, { cwd: fixture, encoding: 'utf8', shell: true });
  report(result.status === 0, `fixture: ${step}`, `exit ${result.status}\n${result.stdout}${result.stderr}`);
}

const edit = (from, to) => (text) => {
  if (!text.includes(from)) fail(`a case looks for text the fixture no longer holds: ${from}`);
  return text.replace(from, to);
};

const cases = [
  {
    name: 'a task ticked while the requirement it cites is still Specified',
    step: 'spec-graph check',
    rule: 'premature-completion',
    files: { 'specs/001-split-a-bill/tasks.md': edit('- [ ] T006', '- [X] T006') },
  },
  {
    name: 'a task ticked that cites no requirement and names no commit',
    step: 'spec-graph check',
    rule: 'unevidenced-completion',
    files: {
      'specs/001-split-a-bill/tasks.md': edit(
        '**Checkpoint**',
        '- [X] T007 [US1] Print each share in src/cli/split.js\n\n**Checkpoint**',
      ),
    },
  },
  {
    name: 'a link to a requirement another feature does not have',
    step: 'spec-graph check',
    rule: 'broken-reference',
    files: { 'specs/002-add-a-tip/spec.md': edit('spec.md#fr-001)', 'spec.md#fr-009)') },
  },
  {
    name: 'a requirement marked Implemented with no test counted under it',
    step: 'spec-guard claims',
    rule: 'unevidenced-claim',
    files: {
      'specs/001-split-a-bill/spec.md': edit(
        `  <!-- @assert-count target="test/split.test.js" symbol="test('the shares add up to the bill'" min="1" -->\n`,
        '',
      ),
    },
  },
  {
    name: 'a requirement marked Implemented in a spec still in Draft',
    step: 'spec-guard claims',
    rule: 'unevidenced-claim',
    files: { 'specs/001-split-a-bill/spec.md': edit('**Status**: Accepted', '**Status**: Draft') },
  },
  {
    name: 'the library importing the command line, against principle I',
    step: 'spec-guard --format',
    rule: 'assert-import-absence',
    files: { 'src/lib/split.js': edit('export function', "import '../cli/split.js';\n\nexport function") },
  },
  {
    name: 'the library formatting a fractional amount, against principle II',
    step: 'spec-guard --format',
    rule: 'assert-absence',
    files: { 'src/lib/split.js': edit('  return Array.from', '  void (share / 100).toFixed(2);\n  return Array.from') },
  },
];

for (const { name, step: which, rule, files } of cases) {
  const step = steps.find((s) => s.slice(PREFIX.length).startsWith(which));
  if (step === undefined) fail(`no step of the template runs "${which}"`);
  const copy = mkdtempSync(join(tmpdir(), 'spec-family-fixture-'));
  try {
    cpSync(fixture, copy, { recursive: true, filter: (source) => basename(source) !== 'node_modules' });
    for (const [file, change] of Object.entries(files)) {
      const path = join(copy, file);
      writeFileSync(path, change(readFileSync(path, 'utf8')));
    }
    const { status, output } = run(step, copy);
    report(status === 1 && output.includes(rule), `${name}: ${which} exits 1 with ${rule}`, `exit ${status}\n${output}`);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

if (failures > 0) fail(`${failures} of ${steps.length + cases.length} checks failed`);
console.log(`\n${steps.length + cases.length} checks: the fixture passes each step, and each broken copy fails the step it should`);
