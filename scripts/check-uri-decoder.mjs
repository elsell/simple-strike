import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const store = fileURLToPath(new URL('../node_modules/.pnpm/', import.meta.url));
const consumers = readdirSync(store).filter(name => name.startsWith('query-string@7.'));
assert.ok(consumers.length > 0, 'exercise the Expo query-string consumer');
for (const consumer of consumers) {
  const directory = path.join(store, consumer, 'node_modules/query-string');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    const require = createRequire(path.join(process.argv[1], 'index.js'));
    const resolved = require.resolve('decode-uri-component');
    const metadata = JSON.parse(readFileSync(path.join(path.dirname(resolved), 'package.json'), 'utf8'));
    assert.equal(metadata.version, '0.5.0');
    const decode = require('decode-uri-component');
    assert.equal((await import(pathToFileURL(resolved).href)).default, decode);
    assert.equal(decode('%C3%A5'), 'å');
    const query = require(process.argv[1]);
    assert.equal(query.parse('name=%C3%A5').name, 'å');
    const malformed = '%80'.repeat(10000);
    assert.equal(query.parse('value=' + malformed).value, malformed);
    assert.equal(query.parse('value=%E0%A4%A').value, '%E0%A4%A');
  `, directory], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
}
console.log('URI decoder compatibility and bounded malformed-input checks passed');
