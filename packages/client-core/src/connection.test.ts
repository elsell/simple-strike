import assert from 'node:assert/strict';
import test from 'node:test';
import { backendConnection, connectionIdentity, normalizeBackendURL } from './connection.js';

const metadata = { version: 1, oidcIssuer: 'https://id.example/dex', oidcClientId: 'mobile' };
test('discovery binds authentication metadata to the entered API destination', () => {
  const connection = backendConnection(' https://API.example/ ', { ...metadata, apiURL: 'https://other.example' }, 'production');
  assert.deepEqual(connection, { environment: 'production', apiURL: 'https://api.example', oidcIssuer: metadata.oidcIssuer, oidcClientId: 'mobile' });
});
test('invalid backend and identity configuration fails closed', () => {
  for (const url of ['', 'not a URL', 'http://api.example', 'https://user:secret@api.example', 'https://api.example?q=1', 'https://api.example/#x', 'ftp://api.example']) {
    assert.throws(() => normalizeBackendURL(url, 'production'));
  }
  for (const value of [null, {}, { ...metadata, version: 2 }, { ...metadata, oidcClientId: '' }, { ...metadata, oidcClientId: 'mobile other' }, { ...metadata, oidcIssuer: 'http://id.example' }, { ...metadata, oidcIssuer: 'https://id.example?key=x' }]) {
    assert.throws(() => backendConnection('https://api.example', value, 'production'));
  }
  assert.equal(normalizeBackendURL('http://localhost:8080/', 'development'), 'http://localhost:8080');
});
test('session identity separates each API, issuer and client while normalizing equivalent URLs', () => {
  const base = backendConnection('https://api.example/', metadata, 'production');
  assert.equal(connectionIdentity(base), connectionIdentity(backendConnection('https://API.example', metadata, 'production')));
  for (const changed of [{ ...base, apiURL: 'https://other.example' }, { ...base, oidcIssuer: 'https://other.example' }, { ...base, oidcClientId: 'other' }]) {
    assert.notEqual(connectionIdentity(base), connectionIdentity(changed));
  }
});

test('OIDC issuer identity preserves the exact configured path and trailing slash', () => {
  const connection = backendConnection('https://api.example', { ...metadata, oidcIssuer: 'https://id.example/dex/' }, 'production');
  assert.equal(connection.oidcIssuer, 'https://id.example/dex/');
  assert.notEqual(connectionIdentity(connection), connectionIdentity(backendConnection('https://api.example', metadata, 'production')));
});
