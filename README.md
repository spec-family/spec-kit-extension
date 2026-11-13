# spec-family checks for Spec Kit

A [Spec Kit](https://github.com/github/spec-kit) extension that holds the
code to what a Spec Kit project's specs, tasks and constitution say, with two
of the [spec-family](https://github.com/spec-family) tools, in CI:

- **spec-graph** reads what Spec Kit writes - each file of `specs/<feature>/`
  and `.specify/memory/constitution.md` - and finds a link to a requirement
  that is not there, a task ticked `[X]` that cites no requirement and names
  no commit, a task ticked while its requirement is still `Specified`, and a
  document resting on one that was superseded.
- **spec-guard** runs the rules the constitution and the ADRs state, written
  as a directive under the sentence that states each, against the code, and
  holds each requirement marked `Implemented` to a test that exists and could
  fail.

Both are deterministic: no model reads the documents, nothing leaves the
machine, and a run says the same thing every time. The checks themselves run
in CI. The extension's part is to give the project that CI job, and to have
the coding agent run the same checks after `tasks` and `implement` and say
what each finding means.

## What it does not do

- **It does not replace CI.** The commands and hooks ask the agent to run the
  checks; an agent can skip an optional hook, and the CI job is where every
  change meets them.
- **It reads only what is marked.** A requirement is checked where it opens
  with a label, `Implemented` or `Specified`; a task is held to evidence where
  the configuration names the tasks as checklists; a rule in the constitution
  is run where a directive stands under it. Nothing else is checked, and no
  model reads the prose, so two documents that disagree in meaning are not
  found.
- **It does not run your tests.** `spec-guard claims` checks that a
  requirement's test is there and could fail; whether it passes is your test
  runner's to say, in the same CI run.
- **It does not decide whether the code is correct**, or whether a spec asks
  for the right thing. That is the tests' job, and the person's.
- **It does not stop an agent writing a file.** Refusing a write a task
  protects is [spec-harness](https://github.com/spec-family/spec-harness),
  which this extension does not install.
- **It does not protect its own rules.** An agent that can edit the
  constitution, the configuration or the workflow can loosen the rule it is
  breaking. Protected branches and code owners close that gap.
- **A feature's files are separate documents.** A spec superseded while its
  `tasks.md` still holds open tasks is not reported: spec-graph reads each file
  of a feature as a document of its own for now
  ([ADR-0031](https://github.com/spec-family/spec-graph/blob/main/docs/adr/0031-sdd-layouts-are-read-as-written.md)).
- **It does not read a spec's status.** Spec Kit writes every spec
  `**Status**: Draft` and never changes the line, so the configuration names
  the specs in `ignoreStatus`, and both tools read them as in force: their
  directives run, and an `Implemented` requirement's test counts, whatever
  the line says. Any other document's status is still read, so an ADR in
  `Draft` runs no directive.
- **Status words are read in English**, whatever language the documents are
  written in.
- **The tools are before 1.0.** Their output can change between minor
  releases, which is why the job runs the versions the project pins.

## Install

The extension needs Spec Kit 1.4.0 or later, Node.js 22 or later and npm.

```bash
specify extension add spec-family --from https://github.com/spec-family/spec-kit-extension/archive/refs/tags/v0.3.0.zip
```

Or from a clone:

```bash
specify extension add --dev /path/to/spec-kit-extension
```

Read the release before you install it: Spec Kit's community catalogue
records an extension's metadata and archive, not a review of its contents.

## Set up the checks

Once the project's first feature has a spec, run the setup command in your
agent, in its form of Spec Kit commands, `/speckit.spec-family.ci` or
`/speckit-spec-family-ci`. It:

1. installs spec-graph 0.26.0 and spec-guard 0.35.0 as devDependencies,
   pinned exactly, writing a minimal `package.json` first where the project
   has none;
2. writes `.spec-graph.json` and `.spec-guard.json` from the templates, and
   sets `testPrefixes` to how the project's tests are written, leaving
   `checklists` off until the tasks cite their evidence;
3. copies the CI job to `.github/workflows/spec-family.yml`;
4. runs the checks once and explains what they find.

It overwrites nothing that is already there without asking, and leaves the
commit, and making the job a required check, to you.

## Commands

| Command | What it does |
| --- | --- |
| `speckit.spec-family.graph` | Runs `spec-graph check` and explains each finding: what the document claims that is not so, the line to fix, and the usual fix. An argument such as `specs/001-photo-albums` narrows the explanation to one feature |
| `speckit.spec-family.guard` | Runs `spec-guard` and `spec-guard claims`, quotes the rule each failure breaks, and explains each finding. `rules` or `claims` runs one. It also helps write a directive under a principle of the constitution, and runs `spec-guard prove` to show the rule could fail |
| `speckit.spec-family.ci` | Sets up the checks, as above |

None of them changes a document or the code without the user agreeing, and
none makes a finding go away by loosening the configuration.

## Hooks

| After | Offers |
| --- | --- |
| `tasks` | `speckit.spec-family.graph`: the new tasks, and the spec and plan they cite |
| `implement` | `speckit.spec-family.guard`: the code against the constitution, each `Implemented` requirement against its test; and `speckit.spec-family.graph`: each ticked task against what it cites |

Each hook is optional: the agent asks before running it.

## The CI job

[`templates/spec-family.yml`](templates/spec-family.yml), copied to
`.github/workflows/spec-family.yml`, runs on every pull request and every
push to the default branch:

```yaml
- run: npm ci
- name: The code against the rules the constitution and the ADRs state (spec-guard)
  run: npx --no-install @spec-family/spec-guard --format github
- name: Each requirement marked Implemented against its test (spec-guard claims)
  if: ${{ !cancelled() }}
  run: npx --no-install @spec-family/spec-guard claims --format github
- name: The specs, plans and tasks against each other and the repository (spec-graph)
  if: ${{ !cancelled() }}
  run: npx --no-install @spec-family/spec-graph check --format github
```

The tools run from the project's own `node_modules`, at the versions
`package.json` pins; `--no-install` makes npx stop rather than fetch a
package by that name from the registry. The checkout has `fetch-depth: 0`,
because spec-graph looks in git for the commits a ticked task names and stops
in a shallow clone rather than guess. Each finding is an annotation on the
line it names.

## Configuration

spec-graph reads Spec Kit's layout with no configuration
([SDD layouts](https://github.com/spec-family/spec-graph/blob/main/docs/reference/sdd-layouts.md)).
The two files the setup writes turn on the rest:

[`.spec-graph.json`](templates/spec-graph.json):

```json
{
  "ignoreStatus": ["specs/**/spec.md"],
  "claims": {
    "files": ["specs/*/spec.md"],
    "labels": { "Implemented": "done", "Specified": "open" }
  }
}
```

[`.spec-guard.json`](templates/spec-guard.json):

```json
{
  "specs": [".specify/memory/constitution.md", "specs/**/*.md"],
  "ignoreStatus": ["specs/**/spec.md"],
  "claims": {
    "files": ["specs/*/spec.md"],
    "labels": {
      "Implemented": { "evidence": "test" },
      "Specified": {}
    },
    "testPrefixes": ["test('"]
  }
}
```

- `claims` makes each requirement that opens with a label a claim: done when
  it is `Implemented`, open while it is `Specified`.
- `ignoreStatus`, the same list in both files, names the specs, whose
  `**Status**: Draft` Spec Kit never changes: both tools read them with no
  status, as in force. Every other document's status is read.
- `checklists` is off. Spec Kit's `implement` ticks each task it finishes
  without citing a requirement or naming a commit, so it would turn the first
  run red on every ticked task. Once the tasks cite the requirement they
  build or name the commit that did the work, as below, add it to
  `.spec-graph.json`, and each ticked task is held to what it cites:

  ```json
  "checklists": ["specs/*/tasks.md"]
  ```

- `specs` names the documents whose directives spec-guard runs: by default it
  reads only `docs/**/*.md`. Add your ADRs' directory where you keep them.
- `testPrefixes` is how a test is told from a mention of its name: `test('`
  for `node:test`, Vitest or Jest, `def test_` for pytest, `func Test` for
  Go.

The tools stop with exit 2 when a configured pattern matches no file, rather
than check nothing, so set this up after the first spec exists.

## Writing specs the checks can hold

A requirement opens with its label, and one marked `Implemented` has a
directive under it that counts its test. `@spec-item` names it, so a task can
cite it:

```md
<!-- @spec-item id="fr-001" -->
- `Implemented` **FR-001**: The shares MUST add up to the bill, to the cent.
  <!-- @assert-count target="test/split.test.js" symbol="test('the shares add up to the bill'" min="1" -->
```

A ticked task cites the requirement it built, or names the commit that did
the work:

```md
- [X] T004 [US1] Split the bill in src/lib/split.js ([FR-001](spec.md#fr-001), [FR-002](spec.md#fr-002))
- [X] T007 Set up the project (commit "Set up the project")
```

A principle of the constitution is run against the code where a directive
stands under it:

```md
### I. Library first

Every feature is a function in `src/lib/` before it is a command. The library
imports nothing from the command line in `src/cli/`.

<!-- @assert-import-absence target="src/lib" module="src/cli" reason="the library stands without the command line" -->
```

[spec-guard's directives](https://github.com/spec-family/spec-guard/blob/main/docs/reference/directives.md)
lists every kind, and its
[import rules](https://github.com/spec-family/spec-guard/blob/main/docs/reference/imports.md)
read JavaScript, TypeScript, Python, Go, Rust and C#.

## The fixture

[`fixture/`](fixture) is a small Spec Kit project - a constitution with three
principles, a feature built and tested, a second not built yet, both specs
`**Status**: Draft` as Spec Kit leaves them - that the checks pass over. It
uses the templates' configuration, with `checklists` turned on, since its
tasks cite their evidence. [`scripts/check-fixture.mjs`](scripts/check-fixture.mjs)
runs the CI job's steps over it exactly as the template writes them, and then
over eight copies changed one way each. Seven have to fail the step the job
runs for them, with the rule they break: a task ticked while its requirement
is `Specified`, a task ticked that cites nothing, a link to a requirement that
is not there, an `Implemented` requirement with no test under it, the
configuration without `ignoreStatus`, the library importing the command line,
and the library formatting a fractional amount. The eighth has to pass: the
task that cites nothing, under the template's own `.spec-graph.json`, which
leaves `checklists` off.

```bash
npm test
npm ci --prefix fixture
node scripts/check-fixture.mjs
```

`npm test` checks `extension.yml` against the rules Spec Kit 1.4.0 applies
when it loads and installs an extension and those its community catalogue
applies to a submission, with a short Node script and no Spec Kit install,
and checks that the version pins, the configuration templates and the
fixture agree.

## Installed by Spec Kit, in CI

[`.github/workflows/install.yml`](.github/workflows/install.yml) installs
Spec Kit's own CLI, `specify` 1.4.0 from the commit its tag names, on the
runner, makes a project with `specify init`, and installs this extension into
it twice over: from an archive made as GitHub makes a tag's, by URL, into the
GitHub Copilot integration a non-interactive init chooses; and from the
checkout with `--dev`, into the generic integration's flat command files.
[`scripts/check-install.mjs`](scripts/check-install.mjs) then fails unless:

- `specify extension list --json` and `info --json` show the extension, its
  three commands, three templates and three hooks;
- the installed copy under `.specify/extensions/spec-family/` holds the
  released files, and none of the fixture, scripts or tests;
- `.specify/extensions.yml` registers the hooks after `tasks` and
  `implement`, enabled, in order;
- each command is registered where the integration reads it,
  `.github/skills/speckit-spec-family-<command>/SKILL.md` or
  `.agent/commands/speckit.spec-family.<command>.md`, with every reference to
  another command rendered in the integration's own spelling.

The commands are prompts: an agent reads them and acts. What can be done
without an agent, [`scripts/run-commands.mjs`](scripts/run-commands.mjs) does
in the same project, reading the installed commands: the setup the `ci`
command asks for, and then every shell line in the three commands' fenced
blocks, each of which has to exit 0 over the fixture's constitution, specs and
code. How an agent follows the prose is not tested.

## Releasing

A release is a `v<version>` tag on a commit `main` has.
[`.github/workflows/release.yml`](.github/workflows/release.yml):

1. checks that the tag, `extension.yml`'s version and a dated `CHANGELOG.md`
   section, `## [0.3.0] - YYYY-MM-DD`, agree, and runs the tests;
2. installs the extension with Spec Kit's CLI from the tag's own archive,
   `https://github.com/spec-family/spec-kit-extension/archive/refs/tags/v<version>.zip`,
   the download URL the community catalogue is given, and runs the same checks
   as `install.yml` on what it installed;
3. only then makes the GitHub release, with that section as its notes.

The release attaches nothing: Spec Kit installs the tag's archive. A manual
run of the workflow rehearses steps 1 and 2 on GitHub's archive of the
commit it runs on, and makes no release.

## Versions

| | Version |
| --- | --- |
| This extension | 0.3.0 |
| spec-graph, pinned by the setup | 0.26.0 |
| spec-guard, pinned by the setup | 0.35.0 |
| Spec Kit | 1.4.0 or later, before 2.0.0 |
| Node.js | 22 or later |

## See also

- [The spec family](https://github.com/spec-family/spec-core/blob/main/docs/overview.md):
  what each tool checks, and what they do not do.
- [An example repository](https://github.com/spec-family/example) where an
  `Implemented` claim with no test, a ticked box with no commit and an agent's
  refused write each turn CI red.
- [spec-graph's rules](https://github.com/spec-family/spec-graph/blob/main/docs/reference/rules.md)
  and [spec-guard's claims](https://github.com/spec-family/spec-guard/blob/main/docs/reference/claims.md).
- [Spec Kit's extension documentation](https://github.com/github/spec-kit/tree/main/docs/extensions).

## License

MIT, in `LICENSE`.
