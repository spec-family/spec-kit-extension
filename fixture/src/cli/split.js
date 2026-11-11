#!/usr/bin/env node
// split <cents> <people>: prints each person's share, in cents.
import { splitBill } from '../lib/split.js';

const [cents, people] = process.argv.slice(2).map(Number);
try {
  console.log(splitBill(cents, people).join(' '));
} catch (error) {
  console.error(`split: ${error.message}`);
  process.exitCode = 1;
}
