import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitBill } from '../src/lib/split.js';

test('the shares add up to the bill', () => {
  for (const [cents, people] of [[1000, 3], [1, 2], [0, 4], [9999, 7]]) {
    assert.equal(splitBill(cents, people).reduce((sum, share) => sum + share, 0), cents);
  }
});

test('no two shares differ by more than a cent', () => {
  const shares = splitBill(1000, 3);
  assert.deepEqual(shares, [334, 333, 333]);
  assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
});

test('a bill split between no one is refused', () => {
  assert.throws(() => splitBill(1000, 0), RangeError);
  assert.throws(() => splitBill(10.5, 2), RangeError);
});
