#!/usr/bin/env node
// Checks that `specify extension add` put this extension where Spec Kit puts
// an extension, in a project `specify init` made: the installed copy, the
// three commands registered for the project's integration with their
// references to other commands rendered, the three templates, and the hooks
// registered where Spec Kit's own commands read them. It reads what the CLI
// reports (`specify extension list --json`, `info --json`) and what is on disk;
// `.specify/extensions.yml` is read through `yq`, so nothing here parses
// Spec Kit's YAML by hand.
//
//   node scripts/check-install.mjs <project> <copilot|generic>
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlSubset } from './yaml-subset.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [project, integration] = process.argv.slice(2);
const manifest = parseYamlSubset(readFileSync(join(root, 'extension.yml'), 'utf8'));
const id = manifest.extension.id;

// Where each integration writes a command, and how it spells an invocation:
// the GitHub Copilot integration's default skills layout, and the generic
// integration's flat files in the directory its --commands-dir names.
const LAYOUTS = {
  copilot: {
    file: (name) => `.github/skills/${name.split('.').join('-')}/SKILL.md`,
    invocation: (name) => `/${name.split('.').join('-')}`,
  },
  generic: {
    file: (name) => `.agent/commands/${name}.md`,
    invocation: (name) => `/${name}`,
  },
};
const layout = LAYOUTS[integration];
if (project === undefined || layout === undefined) {
  console.error('usage: node scripts/check-install.mjs <project> <copilot|generic>');
  process.exit(2);
}

let failures = 0;
const check = (ok, what, detail = '') => {
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${what}`);
  if (!ok) {
    failures += 1;
    if (detail) console.log(String(detail).replace(/^/gm, '       '));
  }
};
const json = (command, args) => {
  const result = spawnSync(command, args, { cwd: project, encoding: 'utf8' });
  if (result.status !== 0) {
    check(false, `${command} ${args.join(' ')} exits 0`, `exit ${result.status}\n${result.stdout}${result.stderr}`);
    return null;
  }
  return JSON.parse(result.stdout);
};
const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const commands = manifest.provides.commands.map(({ name }) => name);
const templates = manifest.provides.templates;
const hooks = Object.entries(manifest.hooks).flatMap(([event, config]) => (Array.isArray(config) ? config : [config]).map((hook) => ({ event, ...hook })));

// What the CLI says is installed.
const list = json('specify', ['extension', 'list', '--json']);
if (list !== null) {
  const item = list.find((entry) => entry.id === id);
  check(item !== undefined, `specify extension list shows ${id}`, JSON.stringify(list, null, 2));
  if (item !== undefined) {
    check(item.version === manifest.extension.version && item.enabled === true, `${id} ${manifest.extension.version} is installed and enabled`, JSON.stringify(item, null, 2));
    check(
      item.provides.commands === commands.length && item.provides.templates === templates.length,
      `the CLI counts ${commands.length} commands and ${templates.length} templates`,
      JSON.stringify(item.provides),
    );
  }
}

const info = json('specify', ['extension', 'info', id, '--json']);
if (info !== null) {
  check(same(info.commands.map((command) => command.name).sort(), [...commands].sort()), 'the CLI lists the three commands', JSON.stringify(info.commands, null, 2));
  check(
    same(
      info.templates.map((template) => [template.name, template.sourcePath]).sort(),
      templates.map((template) => [template.name, template.file]).sort(),
    ),
    'the CLI lists the three templates, each at its file',
    JSON.stringify(info.templates, null, 2),
  );
  check(
    same(
      info.hooks.map((hook) => [hook.trigger, hook.targetCommand]),
      hooks.map((hook) => [hook.event, hook.command]),
    ),
    'the CLI lists the hooks, in order',
    JSON.stringify(info.hooks, null, 2),
  );
}

// The installed copy: what a release ships, and none of what .extensionignore
// leaves out.
const installed = join(project, '.specify', 'extensions', id);
const shipped = ['extension.yml', 'README.md', 'LICENSE', 'CHANGELOG.md', ...manifest.provides.commands.map(({ file }) => file), ...templates.map(({ file }) => file)];
for (const file of shipped) {
  check(read(join(installed, file)) === readFileSync(join(root, file), 'utf8'), `the installed copy holds ${file} as released`);
}
for (const file of ['fixture', 'scripts', 'tests', '.github', 'package.json', '.extensionignore']) {
  check(!existsSync(join(installed, file)), `the installed copy leaves out ${file}`);
}

// The hooks, where Spec Kit's commands look for them.
const config = json('yq', ['-o=json', '.', '.specify/extensions.yml']);
if (config !== null) {
  check((config.installed ?? []).includes(id), `.specify/extensions.yml lists ${id} as installed`, JSON.stringify(config.installed));
  for (const event of [...new Set(hooks.map((hook) => hook.event))]) {
    const registered = (config.hooks?.[event] ?? []).filter((hook) => hook.extension === id);
    const expected = hooks.filter((hook) => hook.event === event);
    check(
      same(
        registered.map((hook) => [hook.command, hook.enabled, hook.optional, hook.prompt]),
        expected.map((hook) => [hook.command, true, hook.optional, hook.prompt]),
      ),
      `.specify/extensions.yml registers the ${event} hooks, enabled, in order`,
      JSON.stringify(config.hooks?.[event] ?? null, null, 2),
    );
  }
}

// Each command, registered for the integration, with every reference to
// another command rendered in the integration's own spelling.
for (const { name, file } of manifest.provides.commands) {
  const source = readFileSync(join(root, file), 'utf8');
  const registered = read(join(project, layout.file(name)));
  check(registered !== null, `${name} is registered at ${layout.file(name)}`);
  if (registered === null) continue;
  const title = source.match(/^# .+$/m)[0];
  check(registered.includes(title), `${layout.file(name)} carries the command's text`, registered.slice(0, 600));
  check(!registered.includes('__SPECKIT_COMMAND_'), `${layout.file(name)} has every command reference rendered`);
  for (const [, encoded] of source.matchAll(/__SPECKIT_COMMAND_([A-Z][A-Z0-9_-]*)__/g)) {
    const target = `speckit.${encoded.toLowerCase().split('_').join('.')}`;
    check(registered.includes(layout.invocation(target)), `${layout.file(name)} refers to ${target} as ${layout.invocation(target)}`);
  }
}

// Spec Kit's own record of what it registered for the integration.
const registry = JSON.parse(read(join(project, '.specify', 'extensions', '.registry')) ?? '{}');
const entry = registry.extensions?.[id];
check(
  entry !== undefined && same([...(entry.registered_commands?.[integration] ?? [])].sort(), [...commands].sort()),
  `.specify/extensions/.registry records the three commands for ${integration}`,
  JSON.stringify(entry ?? registry, null, 2),
);

if (failures > 0) {
  console.error(`check-install: ${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nthe extension is installed for ${integration}: copy, commands, templates and hooks where Spec Kit puts them`);
