---
description: "Check the specs, plans and tasks against each other and the repository with spec-graph, and explain each finding"
---

# Check the documents with spec-graph

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding, if it is not empty. It may name a
feature directory, such as `specs/001-photo-albums`: then explain only the
findings in that directory, and say how many there are elsewhere.

## What this checks

spec-graph reads the Markdown Spec Kit writes - each file of
`specs/<feature>/`, and `.specify/memory/constitution.md` - with no
configuration, and checks it the same way every time: no model reads it, and
nothing leaves the machine. It finds:

- a link that names a document or an anchor that is not there;
- a document resting on, or handing its open work to, one that was
  superseded or retired, and a superseded document that still reads as
  current;
- where `.spec-graph.json` names the tasks as checklists, a task ticked
  `[X]` that cites no requirement and names no commit, a task ticked while
  the requirement it cites is still `Specified`, and a commit named that git
  does not hold.

The same check runs in CI, in the job that
`__SPECKIT_COMMAND_SPEC-FAMILY_CI__` adds. Running it here shows the result
before the push; CI is where it counts.

## Steps

1. **Check that spec-graph is installed.** At the repository root, look for
   `node_modules/@spec-family/spec-graph/package.json`. If it is missing and
   `package.json` lists `@spec-family/spec-graph`, run `npm ci`. If
   `package.json` does not list it, stop and tell the user to run
   `__SPECKIT_COMMAND_SPEC-FAMILY_CI__` first. Never run a bare
   `npx spec-graph`: it fetches and runs whatever the registry holds under
   that name, which is not this tool.

2. **Run it** from the repository root:

   ```bash
   npx --no-install @spec-family/spec-graph check
   ```

3. **Read the exit code.**
   - `0`: the documents are consistent. Say so in one line, with the counts
     from the first line of the output.
   - `1`: there are findings. Go on to step 4.
   - `2`: the result cannot be trusted - the configuration does not load, a
     pattern in it matches no file, git is missing, or the clone is shallow.
     Report the message as it is, with the fix it names. Do not change the
     configuration to get past it unless the user asks.

4. **Explain each finding.** A finding names a file and a line, a rule, what
   is untrue, and a hint after `>`. The file and line are where it is fixed.
   For each, say in plain words what the document claims that is not so, and
   propose the fix:

   | Rule | What it means here | The usual fix |
   | --- | --- | --- |
   | `unevidenced-completion` | A task is ticked, and nothing it cites shows the work was done | Cite the requirement it built, as `([FR-001](spec.md#fr-001))`, where the requirement carries `<!-- @spec-item id="fr-001" -->` on the line above it; or name the commit that did it, as `commit "Subject"`; or untick it |
   | `premature-completion` | A task is ticked, and the requirement it cites is still `Specified` | Raise the requirement to `Implemented` once its test exists, then run `__SPECKIT_COMMAND_SPEC-FAMILY_GUARD__`; or untick the task |
   | `unknown-commit` | A task names a commit that the history does not hold | Correct the subject or the hash; in CI, the checkout needs `fetch-depth: 0` |
   | `broken-reference` | A link names a document or anchor that is not there, often a feature directory renamed or a requirement renumbered | Point the link at what exists |
   | `stale-premise` | A live document depends on one that was superseded or retired | Rest it on what replaced that document, or retire it as well |
   | `ghost-handover`, `orphaned-obligation` | Open work handed to, or left in, a document that can no longer take it | Move the open work to a live document, or close it |
   | `live-supersession` | A superseded document still reads as current | Give it the status `Superseded`, and say what replaced it |
   | `state-conflict` | A requirement's checkbox and its label disagree about whether work remains | Make them agree |

   For a rule not in the table, the message and its hint say what is wrong
   and what to do, and
   [spec-graph's rules](https://github.com/spec-family/spec-graph/blob/main/docs/reference/rules.md)
   list them all.

5. **Fix only what the user agrees to.** Propose the fixes together, and make
   the ones the user chooses. Never make a finding go away by loosening the
   check: no new `ignoreReferences`, `severities` or baseline, no narrower
   patterns in `.spec-graph.json`, no task unticked that was really done, and
   no label raised without its evidence.

6. **Run it again** after the fixes, and report the result.

## What it does not do

- It reads only what is marked. A task is held to its evidence only where
  `.spec-graph.json` names the tasks as `checklists`, and a requirement is a
  claim only where it opens with a label, such as `Implemented` or
  `Specified`, as a code span.
- It reads no code and runs no test. `__SPECKIT_COMMAND_SPEC-FAMILY_GUARD__`
  holds the code to the constitution, and each `Implemented` requirement to
  its test.
- No model reads the prose: two documents that disagree in meaning, with no
  link or status between them, are not found.
