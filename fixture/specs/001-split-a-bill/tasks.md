---
description: "Task list for splitting a bill"
---

# Tasks: Split a bill

**Input**: Design documents from `/specs/001-split-a-bill/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Evidence**: a ticked task cites the requirement in [spec.md](spec.md) that
holds it, or names the commit that did the work, as `commit "Subject"`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: User Story 1 - Split a bill evenly (Priority: P1)

**Goal**: a bill of whole cents split between people, the shares adding up to
the bill.

**Independent Test**: split 1000 cents between 3 people and read 334, 333 and
333.

### Tests for User Story 1

- [X] T001 [P] [US1] Test that the shares add up to the bill in test/split.test.js ([FR-001](spec.md#fr-001))
- [X] T002 [P] [US1] Test that no two shares differ by more than a cent in test/split.test.js ([FR-002](spec.md#fr-002))
- [X] T003 [P] [US1] Test that a split between no one is refused in test/split.test.js ([FR-003](spec.md#fr-003))

### Implementation for User Story 1

- [X] T004 [US1] Split the bill in src/lib/split.js ([FR-001](spec.md#fr-001), [FR-002](spec.md#fr-002))
- [X] T005 [US1] Refuse a split between no one in src/lib/split.js ([FR-003](spec.md#fr-003))

**Checkpoint**: User Story 1 is built and tested.

## Phase 2: Weighted shares (Priority: P2)

- [ ] T006 [US2] Weight a share in src/lib/split.js ([FR-004](spec.md#fr-004))
