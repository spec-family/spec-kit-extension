---
description: "Check the code against the rules the constitution and the ADRs state, and each Implemented requirement against its test, with spec-guard"
---

# Check the code with spec-guard

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding, if it is not empty. `rules` runs
only the constitution's and the ADRs' rules, `claims` only the requirements'
evidence; anything else narrows which findings to explain.

## What this checks

A rule in the constitution or an ADR is checked where a directive - an HTML
comment such as `<!-- @assert-import-absence target="src/lib" module="src/cli" -->`
- stands under the sentence that states it. spec-guard runs each directive
against the code, the same way every time, and a rule the code has stopped
keeping fails the build. Directives in a document whose status is `Draft`,
`Proposed`, `Rejected`, `Deprecated`, `Superseded` or `Archived` are read and
not run; any other status, or none, keeps them running.

A requirement in a spec is a claim where it opens with a label as a code span,
such as `` `Implemented` **FR-001**: ... ``. `spec-guard claims` holds each
`Implemented` requirement to a directive under it that counts its test by
name, in a spec in force, which spec-guard can show would fail if the test
were gone.

The same checks run in CI, in the job that
`__SPECKIT_COMMAND_SPEC-FAMILY_CI__` adds. Running them here shows the result
before the push; CI is where they count.

## Steps

1. **Check that spec-guard is installed.** At the repository root, look for
   `node_modules/@spec-family/spec-guard/package.json`. If it is missing and
   `package.json` lists `@spec-family/spec-guard`, run `npm ci`. If
   `package.json` does not list it, stop and tell the user to run
   `__SPECKIT_COMMAND_SPEC-FAMILY_CI__` first. Never run a bare
   `npx spec-guard`: it fetches and runs whatever the registry holds under
   that name, which is not this tool.

2. **Run the rules**, from the repository root:

   ```bash
   npx --no-install @spec-family/spec-guard
   ```

3. **Run the claims**, where `.spec-guard.json` has a `claims` key:

   ```bash
   npx --no-install @spec-family/spec-guard claims
   ```

4. **Read each exit code.**
   - `0`: every rule holds, or every claim has its evidence. Say so in one
     line, with the counts the output gives.
   - `1`: there are findings. Go on to step 5.
   - `2`: the result cannot be trusted - the configuration does not load, or
     a pattern in `specs` or `claims.files` matches no file. Report the
     message as it is, with the fix it names. Do not change the configuration
     to get past it unless the user asks.

5. **Explain each finding.** Quote the sentence the directive stands under:
   that is the rule the code broke, in the project's own words.

   | Finding | What it means here | The usual fix |
   | --- | --- | --- |
   | A directive fails, with the files and lines that break it | The code no longer keeps a rule the constitution or an ADR states | Change the code to keep the rule. If the rule itself should change, that is an amendment for the user to decide, made with `__SPECKIT_COMMAND_CONSTITUTION__` or a new ADR, the sentence and its directive together |
   | `no files were inspected, so this assertion verified nothing` | The directive's `target` names no file, often after the code moved | Point `target` at where the code is now |
   | `unevidenced-claim` | A requirement says `Implemented`, and no directive under it counts a test, or the spec holding it is still `Draft`, so its directives are not run | Write the test, then a directive under the requirement that counts it, as `<!-- @assert-count target="test/split.test.js" symbol="test('the shares add up to the bill'" min="1" -->`, the `symbol` opening with one of the `testPrefixes` in `.spec-guard.json`; once the feature is built, set the spec's `**Status**:` from `Draft` to `Accepted`; or lower the label to `Specified` |
   | `mixed-labels` | One requirement carries two labels | Keep the one that is true |
   | A label "stands in prose and is no claim" | A label word outside a requirement's opening, for information only | Nothing; it changes no exit code |

   The hint under `unevidenced-claim` shows a directive with
   `symbol="fn test_..."` whatever the project's tests look like; write the
   symbol from the project's own `testPrefixes`.

6. **Fix only what the user agrees to.** Propose the fixes together, and make
   the ones the user chooses. Never edit a directive alone to let the code
   pass, never add `allow-empty`, an `exclude` or a narrower `target` to
   quiet a finding, and never raise a label without its evidence.

7. **Run them again** after the fixes, and report the result.

## Writing a rule the code is held to

A sentence of the constitution with no directive under it is not checked.
When the user asks, propose a directive under a principle, and show it before
writing it:

| The rule says | Directive |
| --- | --- |
| This text is gone from this code | `<!-- @assert-absence target="src/lib" symbol="parseFloat" reason="money is whole cents" -->` |
| This exists at least, exactly or at most N times | `<!-- @assert-count target="src" symbol="createServer" max="1" -->` |
| This code does not import that module | `<!-- @assert-import-absence target="src/lib" module="src/cli" -->` |
| Dependencies point one way through these layers | `@assert-layers`, in [spec-guard's import rules](https://github.com/spec-family/spec-guard/blob/main/docs/reference/imports.md) |
| These files exist | `<!-- @assert-present file="SECURITY.md" -->` |

Import rules read JavaScript, TypeScript, Python, Go, Rust and C#. Every
directive and attribute is in
[spec-guard's directives](https://github.com/spec-family/spec-guard/blob/main/docs/reference/directives.md).
After writing one, show that it could fail:

```bash
npx --no-install @spec-family/spec-guard prove
```

## What it does not do

- It runs no test. `claims` checks that a test is there and could fail;
  whether it passes is the test runner's to say, in the same CI run.
- It reads only what is marked: a sentence with no directive under it, and a
  requirement with no label, are not checked.
- It does not decide whether the code is correct, or whether a rule asks for
  the right thing. That is the tests' job, and the person's.
- It does not protect its own rules. An agent that can edit the constitution,
  `.spec-guard.json` or the workflow can loosen the rule it breaks; protected
  branches and code owners close that gap.
