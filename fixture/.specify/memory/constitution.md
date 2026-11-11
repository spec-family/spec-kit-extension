# Split Bill Constitution

## Core Principles

### I. Library first

Every feature is a function in `src/lib/` before it is a command. The library
imports nothing from the command line in `src/cli/`, so it is tested and
reused without it.

<!-- @assert-import-absence target="src/lib" module="src/cli" reason="the library stands without the command line" -->

### II. Money is whole cents

An amount is an integer number of cents everywhere in the library. Nothing in
`src/lib/` parses or formats a fractional amount; the command line takes and
prints cents.

<!-- @assert-absence target="src/lib" symbol="parseFloat" reason="money is whole cents" -->
<!-- @assert-absence target="src/lib" symbol="toFixed" reason="money is whole cents" -->

### III. A requirement marked built names its test

A functional requirement opens with a label that says how far it holds:
`Implemented` once it is built, `Specified` until then. One marked
`Implemented` has a directive under it that counts the test holding it, and
`spec-guard claims` fails the build where one does not.

## Governance

This constitution outranks every plan. A change to a principle is made with
the constitution command, and a directive under a principle changes with the
principle, never on its own to let a build pass.

**Version**: 1.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
