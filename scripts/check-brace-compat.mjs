import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const store = fileURLToPath(new URL('../node_modules/.pnpm/', import.meta.url));
const require = createRequire(import.meta.url);
const versions = new Set();
for (const entry of readdirSync(store).filter(name => name.startsWith('minimatch@'))) {
  const directory = path.join(store, entry, 'node_modules/minimatch');
  const metadata = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const api = require(directory);
  const match = typeof api === 'function' ? api : api.minimatch;
  assert.equal(match('map/strike-2.ts', 'map/{strike-1,strike-2}.ts'), true, metadata.version);
  assert.equal(match('map/strike-3.ts', 'map/{strike-1,strike-2}.ts'), false, metadata.version);
  assert.equal(match('map/strike-2.ts', 'map/strike-{1..3}.ts'), true, metadata.version);
  versions.add(Number(metadata.version.split('.')[0]));
}
assert.ok([...versions].some(version => version < 10), 'legacy consumer must be exercised');
assert.ok([...versions].some(version => version >= 10), 'modern consumer must be exercised');
console.log('Legacy and modern minimatch brace expansion passed');
