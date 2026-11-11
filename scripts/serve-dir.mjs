#!/usr/bin/env node
// Serves one directory's files on the loopback address, so `specify extension
// add --from` can download an archive the way it downloads a release's: Spec
// Kit takes plain HTTP only from a loopback address.
//
//   node scripts/serve-dir.mjs <dir> <port>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';

const [dir, port] = process.argv.slice(2);
createServer((request, response) => {
  // One name, no directory: nothing outside <dir> is served.
  const name = basename(decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname));
  const path = join(dir, name);
  if (name === '' || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': statSync(path).size });
  createReadStream(path).pipe(response);
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${dir} on http://127.0.0.1:${port}/`));
