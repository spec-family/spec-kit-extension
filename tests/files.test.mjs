import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CORE_COMMANDS } from '../scripts/check-manifest.mjs';
import { parseYamlSubset } from '../scripts/yaml-subset.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const manifest = parseYamlSubset(read('extension.yml'));

// Every file of the repository but git's and the fixture's installed
// packages.
const files = (() => {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.git' || name === 'node_modules') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
})();
const textFiles = files.filter((file) => !/\.(png|jpg|gif|ico|zip)$/.test(file));

describe('the tool versions', () => {
  const pins = JSON.parse(read('fixture/package.json')).devDependencies;

  test('are pinned exactly in the fixture', () => {
    assert.deepEqual(Object.keys(pins).sort(), ['@spec-family/spec-graph', '@spec-family/spec-guard']);
    for (const version of Object.values(pins)) assert.match(version, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  });

  test('are the same wherever a file names one', () => {
    let named = 0;
    for (const file of textFiles.filter((path) => !path.startsWith('fixture/') && !path.startsWith('tests/'))) {
      for (const [, tool, version] of read(file).matchAll(/(@spec-family\/spec-(?:graph|guard))@([0-9][0-9.]*[0-9])/g)) {
        assert.equal(version, pins[tool], `${file} names ${tool}@${version}`);
        named += 1;
      }
      // `spec-graph 0.24.1`, and a table row, `| spec-graph, pinned ... | 0.24.1 |`.
      for (const [, tool, version] of read(file).matchAll(/\b(spec-(?:graph|guard))(?: |,[^|\n]*\| )([0-9]+\.[0-9]+\.[0-9]+)\b/g)) {
        assert.equal(version, pins[`@spec-family/${tool}`], `${file} names ${tool} ${version}`);
        named += 1;
      }
    }
    assert.ok(named >= 8, `only ${named} places name a version`);
  });

  test("of this extension are the manifest's wherever the README names one", () => {
    const readme = read('README.md');
    const { version } = manifest.extension;
    const tags = [...readme.matchAll(/archive\/refs\/tags\/v([0-9.]+[0-9])\.zip/g)].map((match) => match[1]);
    assert.ok(tags.length > 0);
    for (const tag of tags) assert.equal(tag, version);
    assert.ok(readme.includes(`| This extension | ${version} |`));
  });
});

describe('the templates', () => {
  test('are the configuration the fixture passes with', () => {
    assert.equal(read('templates/spec-graph.json'), read('fixture/.spec-graph.json'));
    assert.equal(read('templates/spec-guard.json'), read('fixture/.spec-guard.json'));
  });

  test('pin each action to a commit, with the version beside it, as every workflow and action here does', () => {
    const actions = files.filter((file) => /^\.github\/actions\/[a-z-]+\/action\.yml$/.test(file));
    const workflows = ['templates/spec-family.yml', ...files.filter((file) => file.startsWith('.github/workflows/'))];
    assert.ok(workflows.length >= 4 && actions.length >= 1, [...workflows, ...actions].join(', '));
    for (const file of [...workflows, ...actions]) {
      const uses = [...read(file).matchAll(/uses: (.+)$/gm)].map((match) => match[1]);
      assert.ok(uses.length >= 1, file);
      for (const use of uses) {
        const local = /^\.\/(\.github\/actions\/[a-z-]+)$/.exec(use);
        if (local !== null) assert.ok(actions.includes(`${local[1]}/action.yml`), `${file}: ${use} is no action here`);
        else assert.match(use, /^[a-z-]+\/[a-z-]+@[0-9a-f]{40} # v[0-9]+\.[0-9]+\.[0-9]+$/, `${file}: ${use}`);
      }
    }
    for (const file of workflows) {
      assert.match(read(file), /^permissions:\n {2}contents: read$/m, `${file} reads the repository and no more, by default`);
      for (const [, label] of read(file).matchAll(/runs-on: (.+)$/gm)) assert.equal(label, 'ubuntu-24.04', file);
    }
  });

  test('give contents: write to the job that makes the release, and to no other', () => {
    const writes = [];
    for (const file of files.filter((path) => path.startsWith('.github/'))) {
      const text = read(file);
      for (const match of text.matchAll(/contents: write/g)) {
        const job = [...text.slice(0, match.index).matchAll(/^ {2}([a-z-]+):$/gm)].at(-1)?.[1];
        writes.push(`${file}#${job}`);
      }
    }
    assert.deepEqual(writes, ['.github/workflows/release.yml#github-release']);
  });

  test('run each tool from the project, never by a bare name', () => {
    const runs = [...read('templates/spec-family.yml').matchAll(/run: (.+)$/gm)].map((match) => match[1]);
    assert.deepEqual(runs, [
      'npm ci',
      'npx --no-install @spec-family/spec-guard --format github',
      'npx --no-install @spec-family/spec-guard claims --format github',
      'npx --no-install @spec-family/spec-graph check --format github',
    ]);
  });
});

describe('the commands', () => {
  const provided = manifest.provides.commands;

  test('each opens with the description the manifest gives it', () => {
    for (const { file, description } of provided) {
      const text = read(file);
      assert.ok(text.startsWith(`---\ndescription: "${description}"\n---\n`), file);
    }
  });

  test('refer to other commands by a token Spec Kit renders, for a command that exists', () => {
    const known = new Set([...provided.map(({ name }) => name), ...CORE_COMMANDS.map((name) => `speckit.${name}`)]);
    let tokens = 0;
    for (const { file } of provided) {
      for (const [, encoded] of read(file).matchAll(/__SPECKIT_COMMAND_([A-Z][A-Z0-9_-]*)__/g)) {
        assert.ok(known.has(`speckit.${encoded.toLowerCase().split('_').join('.')}`), `${file}: ${encoded}`);
        tokens += 1;
      }
      assert.doesNotMatch(read(file), /\/speckit[.-][a-z]/, `${file} writes a command's invocation instead of its token`);
    }
    assert.ok(tokens > 0);
  });

  test('are each named in the README', () => {
    const readme = read('README.md');
    for (const { name } of provided) assert.ok(readme.includes(name), name);
  });
});

describe('every file', () => {
  test('is LF, with no control character', () => {
    for (const file of textFiles) {
      const text = read(file);
      assert.ok(!text.includes('\r'), `${file} has a CR`);
      assert.doesNotMatch(text, /[\x00-\x08\x0b-\x1f\x7f]/, `${file} has a control character`);
    }
  });

  // A bare `npx spec-graph` fetches whatever the registry holds under the
  // name; a family tool runs from the project, by its scoped name. A file may
  // still warn against the bare form.
  test('runs a family tool only by its scoped name, from the project', () => {
    const invocation = /npx (?:--?[a-z-]+ )*(?:@spec-family\/|spec-)[a-z-]+/g;
    const scoped = /^npx --no-install @spec-family\/spec-[a-z]+$/;
    let checked = 0;
    for (const file of textFiles.filter((path) => path !== 'tests/files.test.mjs')) {
      const text = read(file);
      for (const match of text.matchAll(invocation)) {
        const warning = text.slice(Math.max(0, match.index - 40), match.index).includes('bare');
        assert.ok(scoped.test(match[0]) || warning, `${file}: ${match[0]}`);
        checked += 1;
      }
    }
    assert.ok(checked > 10, `only ${checked} invocations found`);
  });

  test('names no product of another project as ours', () => {
    for (const file of textFiles) {
      assert.doesNotMatch(read(file), /\bmente\b/i, file);
      for (const heading of read(file).matchAll(/^#+ .*$/gm)) assert.doesNotMatch(heading[0], /anthropic|claude/i, `${file}: ${heading[0]}`);
    }
  });
});

describe('the release', () => {
  test('is the version CHANGELOG.md opens with, unreleased or dated', () => {
    const top = read('CHANGELOG.md').match(/^## .*$/m)?.[0];
    assert.match(top, /^## \[?[0-9]+\.[0-9]+\.[0-9]+\]? - (Unreleased|[0-9]{4}-[0-9]{2}-[0-9]{2})$/);
    assert.equal(top.match(/[0-9]+\.[0-9]+\.[0-9]+/)[0], manifest.extension.version);
  });

  test('is installed in CI into the Spec Kit release the manifest asks for at least', () => {
    const pinned = read('.github/actions/scratch-project/action.yml').match(/SPECKIT_COMMIT: ([0-9a-f]{40}) # v([0-9]+\.[0-9]+\.[0-9]+)$/m);
    assert.ok(pinned, 'the scratch-project action pins Spec Kit by a commit, with its tag beside it');
    assert.ok(manifest.requires.speckit_version.startsWith(`>=${pinned[2]},`), manifest.requires.speckit_version);
    for (const file of ['.github/workflows/install.yml', '.github/workflows/release.yml']) {
      assert.match(read(file), /uses: \.\/\.github\/actions\/scratch-project$/m, `${file} makes its project with the shared action`);
      assert.doesNotMatch(read(file), /SPECKIT_COMMIT|setup-uv/, `${file} pins no Spec Kit or uv of its own`);
    }
  });

  test('waits, in release.yml, on installing from the tag\'s own archive', () => {
    const release = read('.github/workflows/release.yml');
    assert.match(release, /^ {4}needs: \[verify, install\]$/m);
    assert.ok(release.includes('https://github.com/$GITHUB_REPOSITORY/archive/refs/tags/$GITHUB_REF_NAME.zip'));
    assert.match(release, /node scripts\/check-install\.mjs "\$RUNNER_TEMP\/scratch" copilot/);
    assert.match(release, /node scripts\/run-commands\.mjs "\$RUNNER_TEMP\/scratch"/);
  });

  test('leaves the development files out of the installed copy', () => {
    const ignored = read('.extensionignore').split('\n').filter((line) => line && !line.startsWith('#'));
    for (const path of ['.github/', 'fixture/', 'scripts/', 'tests/', 'package.json']) assert.ok(ignored.includes(path), path);
    for (const shipped of ['extension.yml', 'commands/', 'templates/', 'README.md', 'LICENSE']) assert.ok(!ignored.includes(shipped), shipped);
  });
});
