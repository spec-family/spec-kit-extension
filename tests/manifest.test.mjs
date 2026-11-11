import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkManifestFile, pathViolation, validateManifest } from '../scripts/check-manifest.mjs';
import { parseYamlSubset } from '../scripts/yaml-subset.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestText = readFileSync(new URL('../extension.yml', import.meta.url), 'utf8');
const fresh = () => parseYamlSubset(manifestText);

describe('extension.yml', () => {
  test('passes every rule the check knows', () => {
    assert.deepEqual(checkManifestFile(`${root}extension.yml`).errors, []);
  });

  test('declares each hook on an event Spec Kit emits, for a command it provides', () => {
    const { hooks, provides } = fresh();
    const names = provides.commands.map((command) => command.name);
    assert.deepEqual(Object.keys(hooks), ['after_tasks', 'after_implement']);
    for (const entry of Object.values(hooks).flat()) assert.ok(names.includes(entry.command), entry.command);
  });
});

describe('the check refuses', () => {
  const refused = (change, expected) => {
    const data = fresh();
    change(data);
    const errors = validateManifest(data, root);
    assert.ok(
      errors.some((message) => message.includes(expected)),
      `expected an error with "${expected}", got ${JSON.stringify(errors)}`,
    );
  };

  test('an id with a capital, or one a core command owns', () => {
    refused((data) => (data.extension.id = 'Spec-family'), 'does not match');
    refused((data) => (data.extension.id = 'tasks'), "core command's namespace");
  });

  test('a version with a v, or not X.Y.Z', () => {
    refused((data) => (data.extension.version = 'v0.1.0'), 'not X.Y.Z');
    refused((data) => (data.extension.version = '0.1'), 'not X.Y.Z');
  });

  test('a description of 200 characters or more', () => {
    refused((data) => (data.extension.description = 'x'.repeat(200)), 'under 200');
  });

  test('a command outside the namespace, or whose file is not there', () => {
    refused((data) => (data.provides.commands[0].name = 'speckit.other.graph'), "not in the extension's namespace");
    refused((data) => (data.provides.commands[0].name = 'spec-family.graph'), 'does not match speckit.{extension}.{command}');
    refused((data) => (data.provides.commands[0].file = 'commands/missing.md'), 'is not there');
    refused((data) => (data.provides.commands[0].file = '../commands/graph.md'), "'..' segments");
  });

  test('a template with a strategy, or a name that is no slug', () => {
    refused((data) => (data.provides.templates[0].strategy = 'replace'), 'strategy is not authorable');
    refused((data) => (data.provides.templates[0].name = 'Spec_Family'), 'is not lowercase');
  });

  test('a hook on an event no command emits, or for a command not provided', () => {
    refused((data) => (data.hooks.after_task = data.hooks.after_tasks), 'not one Spec Kit');
    refused((data) => (data.hooks.after_tasks.command = 'speckit.spec-family.nothing'), 'not one this extension provides');
    refused((data) => (data.hooks.after_implement[0].priority = 0), 'priority');
    refused((data) => delete data.hooks.after_tasks.prompt, 'needs a prompt');
  });

  test('a speckit_version that is no specifier', () => {
    refused((data) => (data.requires.speckit_version = '1.4.0'), 'not a version specifier');
  });

  test('tags fewer than 2 or more than 5', () => {
    refused((data) => (data.tags = ['testing']), '2 to 5');
  });

  test('a path Spec Kit refuses, on either platform', () => {
    for (const path of ['/abs.md', 'C:/x.md', 'a\\b.md', 'a/../b.md', 'dir/', ' x.md', 'con.md', 'a/b?.md']) assert.ok(pathViolation(path), path);
    assert.equal(pathViolation('commands/graph.md'), null);
  });
});

describe('the YAML reader', () => {
  test('reads what PyYAML reads in the subset', () => {
    assert.deepEqual(parseYamlSubset('a: "1.0"\nb: 1.0\nc: yes\nd:\n  - x: 1\n    y: \'it\'\'s\'\n  - plain # a comment\ne:\n- z\n'), {
      a: '1.0',
      b: 1,
      c: true,
      d: [{ x: 1, y: "it's" }, 'plain'],
      e: ['z'],
    });
  });

  test('reads an unquoted 1.0 as a number, which the check then refuses as schema_version', () => {
    const data = fresh();
    data.schema_version = parseYamlSubset('v: 1.0\n').v;
    assert.ok(validateManifest(data, root).some((message) => message.includes('schema_version')));
  });

  test('refuses what it does not take, by line', () => {
    for (const [text, line] of [
      ['a: [x, y]\n', 1],
      ['a: &anchor x\n', 1],
      ['a:\n\tb: x\n', 2],
      ['a: 2026-11-11\n', 1],
      ['a: x\na: y\n', 2],
      ['a: |\n  x\n', 1],
      ['a: "x\n', 1],
      ['a: 010\n', 1],
      ['a:\n    b: x\n  c: y\n', 3],
    ]) {
      assert.throws(() => parseYamlSubset(text), (caught) => caught.line === line, JSON.stringify(text));
    }
  });
});
