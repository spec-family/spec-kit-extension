# Feature Specification: Add a tip

**Feature Branch**: `002-add-a-tip`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Add a tip to the bill before it is split."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a tip before splitting (Priority: P1)

A diner adds a tip as a percentage of the bill, and the bill with the tip is
split as [splitting a bill](../001-split-a-bill/spec.md#fr-001) splits it.

**Acceptance Scenarios**:

1. **Given** a bill of 1000 cents, a tip of 10% and 3 people, **When** it is
   split, **Then** the shares are 367, 367 and 366 cents.

## Requirements *(mandatory)*

### Functional Requirements

<!-- @spec-item id="fr-001" -->
- `Specified` **FR-001**: A tip MUST be a whole percentage of the bill, rounded
  to the cent before the split.
