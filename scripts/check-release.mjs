#!/usr/bin/env node
// A release is a tag, v<version>. The tag is the version claim, extension.yml
// is what Spec Kit reads, and CHANGELOG.md's section is the description of it:
// they must agree, and the section must carry the release's date, before a
// release is made. Prints the section, the release's notes, on stdout.
//
//   node scripts/check-release.mjs v0.1.0 > release-notes.md
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseYamlSubset } from './yaml-subset.mjs';

export function releaseNotes(tag, version, changelog, today) {
  const tagged = /^v([0-9]+\.[0-9]+\.[0-9]+)$/.exec(tag);
  if (tagged === null) throw new Error(`the tag ${tag} is not v<major>.<minor>.<patch>`);
  if (tagged[1] !== version) throw new Error(`the tag ${tag} does not match extension.yml's version ${version}`);

  const lines = changelog.split('\n');
  const escaped = version.split('.').join('\\.');
  const heading = new RegExp(`^## \\[?${escaped}\\]?(?: - (.*))?$`);
  const at = lines.findIndex((line) => heading.test(line));
  if (at === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const date = heading.exec(lines[at])[1];
  if (date === undefined || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    throw new Error(`CHANGELOG.md's ${version} section is not dated: write its heading as "## [${version}] - YYYY-MM-DD", the release's date`);
  }
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error(`CHANGELOG.md's ${version} section is dated ${date}, which is no date`);
  if (date > today) throw new Error(`CHANGELOG.md's ${version} section is dated ${date}, after today, ${today}`);

  const end = lines.findIndex((line, index) => index > at && line.startsWith('## '));
  const notes = lines.slice(at + 1, end === -1 ? lines.length : end).join('\n').trim();
  if (notes === '') throw new Error(`CHANGELOG.md's ${version} section says nothing`);
  return `${notes}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const [tag = ''] = process.argv.slice(2);
  try {
    const manifest = parseYamlSubset(readFileSync(join(root, 'extension.yml'), 'utf8'));
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    process.stdout.write(releaseNotes(tag, manifest.extension.version, changelog, new Date().toISOString().slice(0, 10)));
  } catch (caught) {
    console.error(`::error::${caught.message}`);
    process.exit(1);
  }
}
