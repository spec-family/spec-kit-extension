# Changelog

All notable changes to this extension are documented here. The version is
`extension.yml`'s, and each release is the tag `v<version>`, whose archive is
what Spec Kit installs.

## [0.1.0] - Unreleased

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
  that section as its notes.
