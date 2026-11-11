#!/usr/bin/env node
// Validates extension.yml by the rules Spec Kit 1.4.0 applies when it loads
// and installs an extension (ExtensionManifest._validate and the install-time
// name checks in src/specify_cli/extensions/__init__.py, read 2026-11-11),
// the stricter ones its community catalogue applies to a submission
// (docs/extensions/publishing.md, "Submission validation"), and a few of our
// own that catch a manifest Spec Kit accepts and then ignores in part: a hook
// on an event no command emits, or naming a command nobody provides.
//
//   node scripts/check-manifest.mjs [extension.yml]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseYamlSubset } from './yaml-subset.mjs';

// Spec Kit's core commands; an extension id or command namespace may not be
// one of them. Spec Kit 1.4.0 reads them off its templates/commands/, and
// falls back to this list.
export const CORE_COMMANDS = ['analyze', 'checklist', 'clarify', 'constitution', 'converge', 'implement', 'plan', 'specify', 'tasks'];

// The hook events Spec Kit's commands emit (docs/extensions/api.md, "Hook
// Events", with the bundled bug extension's).
export const HOOK_EVENTS = [
  ...['specify', 'plan', 'tasks', 'implement', 'analyze', 'checklist', 'clarify', 'constitution', 'bug_assess', 'bug_fix', 'bug_test'].flatMap(
    (command) => [`before_${command}`, `after_${command}`],
  ),
];

const TOP_LEVEL = ['schema_version', 'extension', 'requires', 'provides', 'hooks', 'events', 'tags', 'defaults', 'config'];
const COMMAND_NAME = /^speckit\.([a-z0-9-]+)\.([a-z0-9-]+)$/;
const SLUG = /^[a-z0-9-]+$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const SPECIFIER = /^(~=|===|==|!=|<=|>=|<|>)\s*[0-9][0-9A-Za-z.*+!-]*$/;
// PEP 440, the public version form.
const PEP440 = /^v?([0-9]+!)?[0-9]+(\.[0-9]+)*((a|b|rc)[0-9]+)?(\.post[0-9]+)?(\.dev[0-9]+)?$/i;

const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';

// Spec Kit's relative_extension_path_violation, for a path read under both
// POSIX and Windows rules.
export const pathViolation = (value) => {
  if (typeof value !== 'string' || value === '') return 'must be a non-empty string';
  if (value.trim() !== value) return 'must not have leading or trailing whitespace';
  if (value.includes('\\')) return 'must use forward slashes as path separators';
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split('/').includes('..')) {
    return "must be a relative path within the extension directory (no absolute paths, drive letters, or '..' segments)";
  }
  if (value.endsWith('/')) return 'must name a file or command, not a directory';
  for (const part of value.split('/')) {
    if (part === '' || part === '.' || /[<>:"|?*\x00-\x1f]/.test(part) || WINDOWS_RESERVED.test(part) || /[. ]$/.test(part)) {
      return 'must use portable path components (no reserved names or platform-invalid characters)';
    }
  }
  return null;
};

export function validateManifest(data, root) {
  const errors = [];
  const error = (message) => errors.push(message);
  const fileThere = (file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile();

  if (!isMap(data)) return ['the manifest is not a mapping'];
  for (const key of ['schema_version', 'extension', 'requires', 'provides']) if (!(key in data)) error(`missing required field: ${key}`);
  for (const key of Object.keys(data)) if (!TOP_LEVEL.includes(key)) error(`unknown top-level field: ${key}`);
  if (errors.length > 0) return errors;
  if (data.schema_version !== '1.0') error(`schema_version is ${JSON.stringify(data.schema_version)}, not the string "1.0"`);

  // extension
  const ext = data.extension;
  if (!isMap(ext)) return [...errors, 'extension is not a mapping'];
  for (const key of ['id', 'name', 'version', 'description']) {
    if (typeof ext[key] !== 'string') error(`extension.${key} is missing or not a string`);
  }
  for (const key of ['author', 'repository', 'license']) {
    if (!isText(ext[key])) error(`extension.${key} is missing; the community catalogue requires it`);
  }
  const id = typeof ext.id === 'string' ? ext.id : '';
  if (!/^[a-z][a-z0-9-]*$/.test(id)) error(`extension.id ${JSON.stringify(id)} does not match ^[a-z][a-z0-9-]*$`);
  if (CORE_COMMANDS.includes(id)) error(`extension.id ${id} is a core command's namespace`);
  if (typeof ext.version === 'string') {
    if (!PEP440.test(ext.version)) error(`extension.version ${ext.version} is not a PEP 440 version`);
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(ext.version)) error(`extension.version ${ext.version} is not X.Y.Z, digits only, as the community catalogue requires`);
  }
  if (typeof ext.description === 'string') {
    if (ext.description.trim() === '') error('extension.description is empty');
    if (ext.description.length >= 200) error(`extension.description is ${ext.description.length} characters; the community catalogue takes under 200`);
  }
  if (typeof ext.repository === 'string' && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(ext.repository)) {
    error(`extension.repository ${ext.repository} is not https://github.com/<owner>/<repo>`);
  }
  if ('category' in ext && !isText(ext.category)) error('extension.category is not a non-empty string');
  if ('effect' in ext && !['read-only', 'read-write'].includes(ext.effect)) error(`extension.effect ${JSON.stringify(ext.effect)} is not read-only or read-write`);

  // requires
  const requires = data.requires;
  if (!isMap(requires)) {
    error('requires is not a mapping');
  } else {
    if (!isText(requires.speckit_version)) {
      error('requires.speckit_version is missing or not a non-empty string');
    } else {
      for (const clause of requires.speckit_version.split(',')) {
        if (!SPECIFIER.test(clause.trim())) error(`requires.speckit_version clause ${JSON.stringify(clause)} is not a version specifier`);
      }
    }
    if ('tools' in requires) {
      if (!Array.isArray(requires.tools)) error('requires.tools is not a list');
      else {
        for (const tool of requires.tools) {
          if (!isMap(tool) || !isText(tool.name)) error('each of requires.tools needs a name');
          else {
            if ('version' in tool && !isText(tool.version)) error(`requires.tools ${tool.name}: version is not a string`);
            if ('required' in tool && typeof tool.required !== 'boolean') error(`requires.tools ${tool.name}: required is not true or false`);
          }
        }
      }
    }
  }

  // provides
  const provides = data.provides;
  if (!isMap(provides)) return [...errors, 'provides is not a mapping'];
  const list = (key) => {
    if (!(key in provides)) return [];
    if (!Array.isArray(provides[key])) {
      error(`provides.${key} is not a list`);
      return [];
    }
    return provides[key];
  };
  const commands = list('commands');
  const templates = list('templates');
  const scripts = list('scripts');
  const hooks = data.hooks;
  if ('hooks' in data && !isMap(hooks)) error('hooks is not a mapping');
  if ('events' in data) error('events are not checked here; this extension declares none');
  if (commands.length === 0 && templates.length === 0 && scripts.length === 0 && !(isMap(hooks) && Object.keys(hooks).length > 0)) {
    error('the extension provides no command, template, script, hook or event');
  }

  const names = new Set();
  for (const command of commands) {
    if (!isMap(command) || !('name' in command) || !('file' in command)) {
      error("each command needs 'name' and 'file'");
      continue;
    }
    const { name, file } = command;
    if (typeof name !== 'string') {
      error('a command name is not a string');
      continue;
    }
    const match = COMMAND_NAME.exec(name);
    if (match === null) error(`command ${name} does not match speckit.{extension}.{command}`);
    else if (match[1] !== id) error(`command ${name} is not in the extension's namespace, ${id}`);
    if (names.has(name)) error(`command ${name} is declared twice`);
    names.add(name);
    const violation = pathViolation(file);
    if (violation) error(`command ${name}: file ${JSON.stringify(file)} ${violation}`);
    else if (!fileThere(file)) error(`command ${name}: file ${file} is not there`);
    if ('description' in command && typeof command.description !== 'string') error(`command ${name}: description is not a string`);
    if ('aliases' in command && !(Array.isArray(command.aliases) && command.aliases.every((alias) => typeof alias === 'string' && !pathViolation(alias)))) {
      error(`command ${name}: aliases are not a list of safe names`);
    }
  }

  for (const [section, entries] of [['templates', templates], ['scripts', scripts]]) {
    const seen = new Set();
    for (const entry of entries) {
      if (!isMap(entry) || !('name' in entry) || !('file' in entry)) {
        error(`each of provides.${section} needs 'name' and 'file'`);
        continue;
      }
      const { name, file } = entry;
      if (typeof name !== 'string' || !SLUG.test(name)) error(`provides.${section}: name ${JSON.stringify(name)} is not lowercase letters, digits and hyphens`);
      if (seen.has(name)) error(`provides.${section}: name ${name} is declared twice`);
      seen.add(name);
      const violation = pathViolation(file);
      if (violation) error(`provides.${section} ${name}: file ${JSON.stringify(file)} ${violation}`);
      else if (!fileThere(file)) error(`provides.${section} ${name}: file ${file} is not there`);
      if ('description' in entry && typeof entry.description !== 'string') error(`provides.${section} ${name}: description is not a string`);
      if ('strategy' in entry) error(`provides.${section} ${name}: strategy is not authorable for an extension`);
      if (section === 'scripts' && 'runtimes' in entry) {
        const runtimes = entry.runtimes;
        if (!Array.isArray(runtimes) || runtimes.some((runtime) => !['bash', 'powershell', 'python'].includes(runtime))) {
          error(`provides.scripts ${name}: runtimes are not a subset of bash, powershell, python`);
        }
      }
    }
  }

  if (isMap(hooks)) {
    for (const [event, config] of Object.entries(hooks)) {
      if (!HOOK_EVENTS.includes(event)) error(`hook event ${event} is not one Spec Kit's commands emit`);
      if (Array.isArray(config) && config.length === 0) error(`hook ${event}: the list is empty`);
      const entries = Array.isArray(config) ? config : [config];
      const seen = new Set();
      for (const entry of entries) {
        if (!isMap(entry)) {
          error(`hook ${event}: an entry is not a mapping`);
          continue;
        }
        if (!isText(entry.command)) error(`hook ${event}: missing the command`);
        else if (!names.has(entry.command)) error(`hook ${event}: command ${entry.command} is not one this extension provides`);
        else if (seen.has(entry.command)) error(`hook ${event}: command ${entry.command} is given twice, and Spec Kit keeps only the last`);
        seen.add(entry.command);
        if ('priority' in entry && !(Number.isInteger(entry.priority) && entry.priority >= 1)) error(`hook ${event}: priority is not an integer of 1 or more`);
        if ('optional' in entry && typeof entry.optional !== 'boolean') error(`hook ${event}: optional is not true or false`);
        if (entry.optional !== false && !isText(entry.prompt)) error(`hook ${event}: an optional hook needs a prompt`);
        for (const key of ['prompt', 'description']) if (key in entry && typeof entry[key] !== 'string') error(`hook ${event}: ${key} is not a string`);
        if ('condition' in entry && entry.condition !== null) error(`hook ${event}: Spec Kit's command templates skip a hook with a condition`);
      }
    }
  }

  if ('tags' in data) {
    const tags = data.tags;
    if (!Array.isArray(tags) || tags.length < 2 || tags.length > 5) error('tags are not a list of 2 to 5, as the submission form asks');
    else for (const tag of tags) if (typeof tag !== 'string' || !SLUG.test(tag)) error(`tag ${JSON.stringify(tag)} is not lowercase letters, digits and hyphens`);
  }

  return errors;
}

export function checkManifestFile(path) {
  const data = parseYamlSubset(readFileSync(path, 'utf8'));
  return { data, errors: validateManifest(data, dirname(path)) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const path = resolve(process.argv[2] ?? join(fileURLToPath(new URL('..', import.meta.url)), 'extension.yml'));
  let result;
  try {
    result = checkManifestFile(path);
  } catch (caught) {
    console.error(`check-manifest: ${path}: ${caught.message}`);
    process.exit(2);
  }
  if (result.errors.length > 0) {
    for (const message of result.errors) console.error(`x ${message}`);
    console.error(`check-manifest: ${result.errors.length} problem(s) in ${path}`);
    process.exit(1);
  }
  const { extension, provides, hooks } = result.data;
  const hookCount = Object.values(hooks ?? {}).reduce((sum, config) => sum + (Array.isArray(config) ? config.length : 1), 0);
  console.log(`ok ${extension.id} ${extension.version}: ${provides.commands?.length ?? 0} commands, ${provides.templates?.length ?? 0} templates, ${hookCount} hooks`);
}
