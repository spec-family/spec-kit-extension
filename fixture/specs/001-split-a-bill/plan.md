# Implementation Plan: Split a bill

**Branch**: `001-split-a-bill` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-split-a-bill/spec.md`

## Summary

A function in the library splits a bill of whole cents between people, and a
command line prints the shares. The cents that do not divide evenly go one
each to the first people.

## Technical Context

**Language/Version**: JavaScript, Node.js 22 or later
**Primary Dependencies**: none
**Storage**: N/A
**Testing**: `node --test`
**Target Platform**: any platform Node.js runs on
**Project Type**: single project
**Performance Goals**: N/A
**Constraints**: money in whole cents
**Scale/Scope**: one function and one command

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Against the [constitution](../../.specify/memory/constitution.md):

- **I. Library first**: the split is `splitBill` in `src/lib/split.js`; the
  command line in `src/cli/split.js` imports it, never the other way round.
- **II. Money is whole cents**: the function takes and returns cents.
- **III. A requirement marked built names its test**: each functional
  requirement marked `Implemented` counts its test in `test/split.test.js`.

## Project Structure

### Documentation (this feature)

```text
specs/001-split-a-bill/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lib/split.js
└── cli/split.js
test/
└── split.test.js
```

**Structure Decision**: single project.
