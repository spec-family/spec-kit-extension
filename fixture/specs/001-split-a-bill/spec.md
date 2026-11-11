# Feature Specification: Split a bill

**Feature Branch**: `001-split-a-bill`

**Created**: 2026-11-11

**Status**: Accepted

**Input**: User description: "Split a restaurant bill evenly between the people at the table."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Split a bill evenly (Priority: P1)

A diner enters the bill and the number of people at the table and reads each
person's share.

**Why this priority**: it is the whole of the first release.

**Independent Test**: split 1000 cents between 3 people and read 334, 333 and
333.

**Acceptance Scenarios**:

1. **Given** a bill of 1000 cents and 3 people, **When** it is split, **Then**
   the shares are 334, 333 and 333 cents.
2. **Given** a bill and 0 people, **When** it is split, **Then** the split is
   refused.

### Edge Cases

- A bill of 0 cents is split into shares of 0.
- A fractional number of cents is refused, as the constitution keeps money in
  whole cents.

## Requirements *(mandatory)*

### Functional Requirements

<!-- @spec-item id="fr-001" -->
- `Implemented` **FR-001**: The shares MUST add up to the bill, to the cent.
  <!-- @assert-count target="test/split.test.js" symbol="test('the shares add up to the bill'" min="1" -->

<!-- @spec-item id="fr-002" -->
- `Implemented` **FR-002**: No two shares MAY differ by more than one cent.
  <!-- @assert-count target="test/split.test.js" symbol="test('no two shares differ by more than a cent'" min="1" -->

<!-- @spec-item id="fr-003" -->
- `Implemented` **FR-003**: A split between no one, or of a fractional number of
  cents, MUST be refused.
  <!-- @assert-count target="test/split.test.js" symbol="test('a bill split between no one is refused'" min="1" -->

<!-- @spec-item id="fr-004" -->
- `Specified` **FR-004**: A share MAY be weighted, so one person pays twice
  another's share.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every split of the acceptance scenarios gives the shares they
  name.
