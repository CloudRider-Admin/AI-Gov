/**
 * Prisma 6.x generates types into .prisma/client/ but @prisma/client
 * doesn't ship matching .d.ts files. Its package.json "exports" map
 * points types at ./default.d.ts (which chains to ./index.d.ts),
 * but neither exists in the published package.
 *
 * This script copies the generated declarations so TypeScript resolves them.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
const dst = path.join(__dirname, '..', 'node_modules', '@prisma', 'client');

const files = ['default.d.ts', 'index.d.ts'];

for (const file of files) {
  const from = path.join(src, file);
  const to = path.join(dst, file);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
  }
}

console.log('Prisma client type declarations patched.');