import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Public modulus and signature derived from the BSD-3-Clause-licensed Forge test:
// https://github.com/digitalbazaar/forge/blob/ceba34402e329f0365134f23fe19898756527d65/tests/unit/rsa.js
// The fixture contains no private key. Control keys are generated only in memory.
let consumer = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
for (const name of ['expo', '@expo/cli', '@expo/code-signing-certificates']) {
  consumer = createRequire(consumer.resolve(name));
}
const forge = consumer('node-forge');
const vector = JSON.parse(readFileSync(new URL('./fixtures/forge-nested-digest.json', import.meta.url), 'utf8'));
const publicKey = forge.pki.rsa.setPublicKey(new forge.jsbn.BigInteger(vector.n, 16), new forge.jsbn.BigInteger('3'));
const digest = forge.md.sha256.create();
digest.update('hello world!');
assert.throws(
  () => publicKey.verify(digest.digest().getBytes(), forge.util.hexToBytes(vector.signature)),
  /ASN\.1 object does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo/,
);

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const verifier = forge.pki.publicKeyFromPem(pair.publicKey.export({ type: 'spki', format: 'pem' }));
for (const algorithm of ['sha256', 'sha384', 'sha512']) {
  const message = 'Simple Strike signature verification regression';
  const signature = sign(algorithm, Buffer.from(message), pair.privateKey).toString('binary');
  const valid = forge.md[algorithm].create();
  valid.update(message);
  assert.equal(verifier.verify(valid.digest().getBytes(), signature), true);
  const altered = forge.md[algorithm].create();
  altered.update(message + ' changed');
  assert.equal(verifier.verify(altered.digest().getBytes(), signature), false);
}
console.log('Installed RSA consumer rejects malformed signatures and preserves valid verification');
