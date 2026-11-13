# Changelog

All notable changes to this extension are documented here. The version is
`extension.yml`'s, and each release is the tag `v<version>`, whose archive is
what Spec Kit installs.

## [0.3.0] - 2026-11-14

### Changed

- **The tools are spec-graph 0.26.0 and spec-guard 0.35.0**, pinned by the
  setup, the CI template and the fixture. For what Spec Kit writes:
  - spec-graph no longer reads a word that numbers a part, `Phase 2` in a
    plan or a task list, as a document family, which made most of a Spec
    Kit project's findings references that do not resolve. A file a Spec
    Kit template names, such as `research.md` titled `# Phase 0 Research`,
    takes its id from its path, so the other features' `research.md` are no
    longer left out as duplicates; such a document's id changes, so record
    a spec-graph baseline again once. Every report says what the run left
    out.
  - spec-guard says what an import or layer rule could not follow by path
    rather than pass it, reads a spec saved as UTF-16, and runs a regex rule
    within a time budget.
  - Both now read Markdown up to 20 MiB, the family's limit, where
    spec-graph stopped at 4 MiB, so a large file can report findings it did
    not.

## [0.2.0] - 2026-11-12

### Changed

- **A spec's status is not read.** Spec Kit writes every spec
  `**Status**: Draft` and never changes the line, so spec-guard ran none of a
  spec's directives and counted no `Implemented` requirement's test. Both
  configuration templates now name the specs in `ignoreStatus`,
  `["specs/**/spec.md"]`, which spec-guard 0.34.0 and spec-graph 0.25.0 read
  the same way: those documents are read with no status, as in force. Any
  other document's status is still read. The setup no longer asks the user to
  set a built feature's status to `Accepted`, and `speckit.spec-family.guard`
  says how to add the key to a setup made before it.
- **`checklists` is off by default.** Spec Kit's `implement` ticks each task
  it finishes without citing a requirement or naming a commit, so the first CI
  run was red on every ticked task. `templates/spec-graph.json` leaves the key
  out; `speckit.spec-family.ci` and the README give the line that turns it on
  once the tasks cite their evidence.
- **The tools are spec-graph 0.25.0 and spec-guard 0.34.0**, pinned by the
  setup, the CI template and the fixture. spec-guard's hint under
  `unevidenced-claim` now writes the project's own test prefix, so
  `speckit.spec-family.guard` no longer warns that it does not.
- **The fixture** leaves both specs `**Status**: Draft`, as Spec Kit does, and
  turns `checklists` on. `scripts/check-fixture.mjs` checks eight changed
  copies: the spec in draft now fails only without `ignoreStatus`, and a task
  that cites nothing passes under the template's own `.spec-graph.json`.

## [0.1.0] - 2026-11-11

### Added

- **Commands.** `speckit.spec-family.graph` runs `spec-graph check` over what
  Spec Kit writes and explains each finding; `speckit.spec-family.guard` runs
  `spec-guard` and `spec-guard claims`, and helps write a directive under a
  principle of the constitution; `speckit.spec-family.ci` installs both tools
  pinned, writes their configuration and adds the CI job.
- **Hooks.** After `tasks`, an optional `spec-graph` check; after
  `implement`, optional `spec-guard` and `spec-graph` checks.
- **Templates.** A GitHub Actions job, and the `.spec-graph.json` and
  `.spec-guard.json` a Spec Kit project needs, for spec-graph 0.24.1 and
  spec-guard 0.33.1.
- **A fixture.** A small Spec Kit project the job passes over, and seven
  copies of it broken one way each that the job fails, checked by
  `scripts/check-fixture.mjs`.
- **Installed by Spec Kit in CI.** `specify` 1.4.0, installed on the runner,
  makes a project and installs the extension into it from a release-shaped
  archive by URL and from the checkout with `--dev`; the job fails unless the
  copy, the commands, the templates and the hooks land where Spec Kit puts
  them, and unless every check the commands run passes in that project.
- **Releases.** A `v<version>` tag on `main` whose version and dated
  CHANGELOG section agree with `extension.yml` makes the GitHub release, with
  that section as its notes, once Spec Kit's CLI has installed the extension
  from the tag's own archive URL and the same checks have passed on it.
