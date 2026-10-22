#!/usr/bin/env python3
"""Verify an explicitly configured demo backend. Does not test browser PKCE login."""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request


def call(url, body=None, token=None, form=False):
    data = None if body is None else (urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode())
    headers = {}
    if body is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=15) as response:
            return response.status, json.loads(response.read() or b'null')
    except urllib.error.HTTPError as error:
        return error.code, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', required=True)
    parser.add_argument('--issuer', required=True)
    args = parser.parse_args()
    api, issuer = args.api.rstrip('/'), args.issuer.rstrip('/')
    for address in (api, issuer):
        parsed = urllib.parse.urlparse(address)
        if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1', '::1') or parsed.username:
            parser.error('this shared-credential test only accepts explicit loopback HTTP URLs')
    assert call(api + '/readyz')[0] in (200, 204), 'backend is not ready'
    status, identity = call(issuer + '/token', {
        'grant_type': 'password', 'client_id': 'simple-strike-mobile',
        'username': 'demo@example.com', 'password': 'password', 'scope': 'openid profile email',
    }, form=True)
    assert status == 200, f'Dex token request failed: {status}'
    status, session = call(api + '/v1/sessions', {'identityToken': identity['id_token']})
    assert status in (200, 201), f'session exchange failed: {status}'
    token = session['data']['token']
    for invalid in (None, 'malformed', identity['id_token']):
        assert call(api + '/v1/lightning/strikes', token=invalid)[0] == 401, 'invalid credential accepted'
    status, batch = call(api + '/v1/lightning/strikes', token=token)
    assert status == 200, f'feed request failed: {status}'
    assert batch['data']['mode'] == 'demo' and batch['data']['observations'], 'missing labeled demo observations'
    status, audits = call(api + '/v1/audit-events', token=token)
    assert status == 200, f'audit query failed: {status}'
    assert any(event['action'] == 'resource.viewed' and event['targetType'] == 'lightning_feed' for event in audits['data']), 'missing durable feed audit'
    print('PASS: demo OIDC credentials, application-session exchange, protected feed, and durable audit.')
    print('PASS: missing/malformed sessions and raw OIDC tokens are rejected.')
    print(f'Received {len(batch["data"]["observations"])} simulated observations.')


if __name__ == '__main__':
    main()
