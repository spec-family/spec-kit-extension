#!/usr/bin/env node
// The commands are prompts: an agent reads them and does what they say. This
// does by script the part of that which is not judgement, in a project
// `specify init` made and `specify extension add` installed this extension
// into, reading the commands from the installed copy:
//
// - what `speckit.spec-family.ci` asks: a package.json where there is none,
//   its `npm install` line as written, the two configuration files and the
//   workflow copied from the installed templates;
// - every shell line in a fenced bash block of the three installed commands,
//   each of which has to exit 0, over a project holding the fixture's
//   constitution, specs and code.
//
//   node scripts/run-commands.mjs <project>
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlSubset } from './yaml-subset.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [project] = process.argv.slice(2);
if (project === undefined) {
  console.error('usage: node scripts/run-commands.mjs <project>');
  process.exit(2);
}
const manifest = parseYamlSubset(readFileSync(join(root, 'extension.yml'), 'utf8'));
const installed = join(project, '.specify', 'extensions', manifest.extension.id);

let failures = 0;
const run = (line) => {
  const result = spawnSync(line, { cwd: project, encoding: 'utf8', shell: true });
  const ok = result.status === 0;
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${line}`);
  if (!ok) {
    failures += 1;
    console.log(`exit ${result.status}\n${result.stdout}${result.stderr}`.replace(/^/gm, '       '));
  }
  return ok;
};

// The shell lines of each installed command, in order.
const shell = Object.fromEntries(
  manifest.provides.commands.map(({ name, file }) => {
    const text = readFileSync(join(installed, file), 'utf8');
    const lines = [...text.matchAll(/^( *)```bash\n([\s\S]*?)^\1```$/gm)].flatMap(([, indent, body]) =>
      body
        .split('\n')
        .map((line) => line.slice(indent.length).trim())
        .filter(Boolean),
    );
    return [name, lines];
  }),
);
const setup = shell[`speckit.${manifest.extension.id}.ci`] ?? [];

// The fixture's documents and code, in place of the scratch project's own:
// its constitution replaces the template `specify init` wrote.
for (const path of ['specs', 'src', 'test', '.specify/memory/constitution.md']) {
  cpSync(join(root, 'fixture', path), join(project, path), { recursive: true, force: true });
}

// Step 2 of the setup command: a package.json where there is none.
if (!existsSync(join(project, 'package.json'))) {
  writeFileSync(join(project, 'package.json'), `${JSON.stringify({ name: 'scratch', private: true }, null, 2)}\n`);
}

// Step 3: its install line, as written.
const installs = setup.filter((line) => line.startsWith('npm install'));
if (installs.length !== 1) {
  console.error(`run-commands: the setup command has ${installs.length} npm install lines, and this script knows 1`);
  process.exit(1);
}
if (!run(installs[0])) process.exit(1);

// Steps 4 and 5: the configuration and the workflow, from the installed
// templates, where none is yet.
for (const [template, target] of [
  ['templates/spec-graph.json', '.spec-graph.json'],
  ['templates/spec-guard.json', '.spec-guard.json'],
  ['templates/spec-family.yml', '.github/workflows/spec-family.yml'],
]) {
  if (existsSync(join(project, target))) {
    console.error(`run-commands: ${target} is there already, and the setup command would ask before writing it`);
    process.exit(1);
  }
  mkdirSync(dirname(join(project, target)), { recursive: true });
  copyFileSync(join(installed, template), join(project, target));
  console.log(`ok     ${target} from the installed ${template}`);
}

// Every check a command runs, once each, in the order the commands give them.
const checks = [...new Set(Object.values(shell).flat().filter((line) => line.startsWith('npx ')))];
if (checks.length < 4) {
  console.error(`run-commands: the commands run ${checks.length} checks, fewer than the 4 this script knows`);
  process.exit(1);
}
for (const line of checks) run(line);

// The job the setup copied runs nothing the commands did not.
const workflow = readFileSync(join(project, '.github', 'workflows', 'spec-family.yml'), 'utf8');
for (const [, line] of workflow.matchAll(/^ +run: (npx .+?)(?: --format github)?$/gm)) {
  const ran = checks.includes(line);
  console.log(`${ran ? 'ok    ' : 'FAILED'} the workflow's "${line}" is a check a command runs`);
  if (!ran) failures += 1;
}

if (failures > 0) {
  console.error(`run-commands: ${failures} step(s) failed`);
  process.exit(1);
}
console.log(`\n${checks.length} checks the commands run, and the setup they ask for, pass in a project Spec Kit made`);
