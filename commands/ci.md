---
description: "Install spec-graph and spec-guard pinned, write their configuration, and add the GitHub Actions job that runs them"
---

# Give the project its spec-family checks in CI

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding, if it is not empty. It may name
the default branch, the test framework, or a directory of ADRs.

## What this sets up

The checks belong in CI, where every change meets them the same way. This
command gives the project:

- spec-graph 0.25.0 and spec-guard 0.34.0 as devDependencies, pinned exactly,
  so every run uses the versions this extension was written for;
- `.spec-graph.json` and `.spec-guard.json`, the configuration a Spec Kit
  project needs;
- `.github/workflows/spec-family.yml`, a GitHub Actions job that runs
  `spec-guard`, `spec-guard claims` and `spec-graph check` on every pull
  request and every push to the default branch.

The templates are in this extension's installed copy, under
`.specify/extensions/spec-family/templates/`.

## Steps

1. **Check that the project is ready.**
   - Work at the repository root, where `.specify/` is.
   - At least one feature needs a spec, `specs/<feature>/spec.md`: the tools
     stop with exit 2 when a configured pattern matches no file, rather than
     check nothing. If there is none yet, stop and say to run this after
     `__SPECKIT_COMMAND_SPECIFY__`.
   - `node --version` is 22 or later, and `npm` runs. If not, stop and say
     what is missing.

2. **Have a `package.json`.** The tools are pinned in it. If the project has
   none, as a Python, Go or Rust project may not, tell the user that one is
   needed only to pin the two tools, then write it:

   ```json
   {
     "name": "<the repository's directory name>",
     "private": true
   }
   ```

   Make sure `.gitignore` holds `node_modules/`.

3. **Install the tools, pinned exactly:**

   ```bash
   npm install --save-dev --save-exact @spec-family/spec-graph@0.25.0 @spec-family/spec-guard@0.34.0
   ```

   Never install them without a version, never use `--yes`, and never run a
   bare `npx spec-graph` or `npx spec-guard`: those names on the registry are
   not these tools. Keep `package-lock.json`; the job's `npm ci` needs it.

4. **Write the configuration.** Copy
   `.specify/extensions/spec-family/templates/spec-graph.json` to
   `.spec-graph.json`, and `templates/spec-guard.json` to `.spec-guard.json`.
   Where either file already exists, or `package.json` already has a
   `"spec-graph"` or `"specGuard"` key, do not overwrite it: show the user
   what the template adds, and merge only what they agree to. spec-guard
   refuses its options in both `package.json` and `.spec-guard.json`. Then:

   - **`testPrefixes`** in `.spec-guard.json` is how a test is told from a
     mention of its name. Set it to how the project's tests open, and ask
     the user when it is not clear:

     | Tests written with | `testPrefixes` |
     | --- | --- |
     | `node:test`, Vitest, Jest or Mocha | `["test('", "it('"]` |
     | pytest | `["def test_"]` |
     | Go's `testing` | `["func Test"]` |
     | Rust, tests named `test_...` | `["fn test_"]` |

   - **ADRs.** Where the project keeps ADRs, such as `docs/adr/*.md`, add
     that pattern to `specs` in `.spec-guard.json`, so the rules they state
     are run too. spec-graph reads `docs/` already.

   What the keys do:

   - spec-graph reads Spec Kit's layout with no configuration. `claims`
     makes each requirement that opens with a label, `Implemented` or
     `Specified`, an item with that state.
   - spec-guard reads `docs/**/*.md` unless told otherwise, so `specs` names
     the constitution and the specs. `claims` holds each `Implemented`
     requirement to a directive that counts its test.
   - `ignoreStatus`, the same list in both files, names the specs. Spec Kit
     writes each spec `**Status**: Draft` and never changes the line, so
     both tools read the specs with no status, as in force: their
     directives run, and an `Implemented` requirement's test counts. Every
     other document's status is still read, so an ADR in `Draft` runs no
     directive. Keep the two lists the same.
   - **`checklists` is off.** Spec Kit's `implement` ticks each task it
     finishes without citing a requirement or naming a commit, so holding
     ticked tasks to evidence would turn the first run red on every one.
     Once the project's tasks cite the requirement they build, as
     `([FR-001](spec.md#fr-001))`, or name the commit that did the work, as
     `(commit "Subject")`, turn it on with this key in `.spec-graph.json`,
     and each ticked task in `specs/*/tasks.md` is held to what it cites:

     ```json
     "checklists": ["specs/*/tasks.md"]
     ```

5. **Add the job.** Copy
   `.specify/extensions/spec-family/templates/spec-family.yml` to
   `.github/workflows/spec-family.yml`. If that file exists, show the user
   the difference and ask. Set `branches: [main]` to the project's default
   branch. Leave `fetch-depth: 0` in place: spec-graph looks in git for the
   commits a ticked task names, and stops in a shallow clone rather than
   guess.

6. **Run the checks once**, as the job will:

   ```bash
   npx --no-install @spec-family/spec-guard
   npx --no-install @spec-family/spec-guard claims
   npx --no-install @spec-family/spec-graph check
   ```

   A project whose requirements carry no labels yet has no claims, and
   `claims` reports 0: that is expected. A ticked task that cites nothing
   is a finding as soon as `checklists` is on; explain the findings as
   `__SPECKIT_COMMAND_SPEC-FAMILY_GRAPH__` and
   `__SPECKIT_COMMAND_SPEC-FAMILY_GUARD__` do, and fix only what the user
   agrees to.

7. **Say what is left to the user**, and do none of it unasked:
   - review and commit `package.json`, `package-lock.json`, the two
     configuration files and the workflow;
   - make the job a required check of the default branch, a setting on the
     forge;
   - label the requirements a spec holds, `Implemented` with a directive
     counting its test, `Specified` until then;
   - turn on `checklists` once the tasks cite their evidence, as step 4
     says;
   - write directives under the constitution's rules, as
     `__SPECKIT_COMMAND_SPEC-FAMILY_GUARD__` describes;
   - move to newer versions of the tools on purpose, by changing both pins
     in `package.json` together.
