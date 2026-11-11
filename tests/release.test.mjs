import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { releaseNotes } from '../scripts/check-release.mjs';

const changelog = [
  '# Changelog',
  '',
  'Text above the sections.',
  '',
  '## [0.2.0] - 2026-12-01',
  '',
  '### Added',
  '',
  '- A second thing.',
  '',
  '## [0.1.0] - 2026-11-12',
  '',
  '### Added',
  '',
  '- The first thing.',
  '',
].join('\n');

describe('a release', () => {
  test("carries its dated section as the notes, and nothing of the next", () => {
    assert.equal(releaseNotes('v0.1.0', '0.1.0', changelog, '2026-11-12'), '### Added\n\n- The first thing.\n');
    assert.equal(releaseNotes('v0.2.0', '0.2.0', changelog, '2026-12-01'), '### Added\n\n- A second thing.\n');
  });

  test('reads a heading without brackets, as the family writes them', () => {
    assert.equal(releaseNotes('v1.0.0', '1.0.0', '## 1.0.0 - 2027-01-02\n\nDone.\n', '2027-01-02'), 'Done.\n');
  });
});

describe('a release is refused', () => {
  const refused = (args, expected) => assert.throws(() => releaseNotes(...args), (caught) => caught.message.includes(expected));

  test('for a tag that is no v<version>, or another version than the manifest', () => {
    refused(['0.1.0', '0.1.0', changelog, '2026-11-12'], 'is not v<major>');
    refused(['v0.1', '0.1.0', changelog, '2026-11-12'], 'is not v<major>');
    refused(['v0.1.1', '0.1.0', changelog, '2026-11-12'], "does not match extension.yml's version 0.1.0");
  });

  test('for a version CHANGELOG.md has no section for', () => {
    refused(['v0.3.0', '0.3.0', changelog, '2026-12-01'], 'no section for 0.3.0');
  });

  test('for a section not dated, dated no day, or dated after today', () => {
    refused(['v0.1.0', '0.1.0', '## [0.1.0] - Unreleased\n\nText.\n', '2026-11-12'], 'is not dated');
    refused(['v0.1.0', '0.1.0', '## [0.1.0]\n\nText.\n', '2026-11-12'], 'is not dated');
    refused(['v0.1.0', '0.1.0', '## [0.1.0] - 2026-02-30\n\nText.\n', '2026-11-12'], 'which is no date');
    refused(['v0.1.0', '0.1.0', changelog, '2026-11-11'], 'after today');
  });

  test('for a section that says nothing', () => {
    refused(['v0.1.0', '0.1.0', '## [0.1.0] - 2026-11-12\n\n## [0.0.9] - 2026-11-01\n\nOld.\n', '2026-11-12'], 'says nothing');
  });

  test('for a heading that only starts with the version', () => {
    refused(['v0.1.0', '0.1.0', '## [0.1.0x] - 2026-11-12\n\nText.\n', '2026-11-12'], 'no section for 0.1.0');
  });
});
