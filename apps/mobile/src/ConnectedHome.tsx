import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { Button, Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { createSessionApiClient, sessionExpiryAdvanced, sessionRefreshDelay, sessionRefreshLeadMs } from '@simple-strike/api-client';
import { classifySessionFailure, isSessionFailure, refreshSessionCredential, sessionCredentialFromResponse, sessionRetryDelay, validateSessionCredential, type SessionAccessState, type SessionFailure, type ClientRuntimeConfig, type SessionScope } from '@simple-strike/client-core';
import { type MessageKey } from '@simple-strike/i18n';
import { createDeviceTranslator } from './i18n';
import { activateExchangedSession } from './session-establishment';
import { restoreStoredSession } from './session-restoration';
import { useProviderSignIn } from './provider-auth';
import LightningScreen from './LightningScreen';

const i18n = createDeviceTranslator(getLocales);

type Session = { token: string; expiresAt: string };
type Profile = { id: string; email: string; displayName: string };
class LocalizedError extends Error { constructor(readonly key: MessageKey) { super(key); } }

function localizedFailure(cause: unknown, fallback: MessageKey): MessageKey { return cause instanceof LocalizedError ? cause.key : fallback; }

export default function ConnectedHome({ config, scope, onChangeServer }: { config: ClientRuntimeConfig; scope: SessionScope; onChangeServer: () => Promise<void> }) {
  const { apiURL, oidcClientId: clientId, oidcIssuer: issuer } = config;
  async function saveSession(session: Session | null) {
    await scope.save(session ? JSON.stringify(session) : null);
  }
  async function refreshSession(session: Session): Promise<Session> {
    return refreshSessionCredential(
      session,
      async (current) => createSessionApiClient(apiURL, () => current.token).refresh(),
      async (replacement) => saveSession(replacement),
    );
  }

  const [session, setSession] = useState<Session | null>(null);
  const [accessState, setAccessState] = useState<SessionAccessState>('authentication_required');
  const [sessionRenewable, setSessionRenewable] = useState(true);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const providerSignIn = useProviderSignIn(issuer, clientId, 'simplestrike');

  async function changeServer() {
    const token = session?.token;
    setSession(null); setProfile(null); setAccountOpen(false);
    try {
      await onChangeServer();
      if (token) void createSessionApiClient(apiURL, () => token).revoke().catch(() => undefined);
    } catch { setErrorKey('connection.storageError'); }
  }
  async function activate(next: Session, renewable = true) {
    if (!scope.active) return;
    await saveSession(next);
    if (!scope.active) return;
    setSessionRenewable(renewable); setSession(next);
    const nextProfile = await validateSessionCredential<Profile>(next, async (current) =>
      createSessionApiClient(apiURL, () => current.token).profile(),
    );
    if (!scope.active) return;
    setProfile(nextProfile);
    setAccessState('authenticated_online');
    setRetryAttempt(0);
  }
  async function clearSession(message: MessageKey | null = null, state: SessionAccessState = 'authentication_required') {
    const token = session?.token;
    await saveSession(null); setAccountOpen(false); setSession(null); setRetryAttempt(0); setProfile(null); setAccessState(state); setErrorKey(message);
    if (token) try { await createSessionApiClient(apiURL, () => token).revoke(); } catch { /* local disposal is authoritative */ }
  }
  async function handleSessionFailure(cause: unknown, current: Session) {
    if (!scope.active) return;
    const failure: SessionFailure = isSessionFailure(cause) ? cause : { kind: 'network' };
    const decision = classifySessionFailure(failure);
    if (decision.discardCredential) {
      await clearSession(decision.state === 'local_session_unreadable' ? 'errors.localSessionUnreadable' : 'errors.sessionExpired', decision.state);
      return;
    }
    await saveSession(current);
    if (!scope.active) return;
    setSession(current); setAccessState('authenticated_offline');
    if (!decision.retryable) { setSessionRenewable(false); setRetryAttempt(0); }
    if (decision.retryable) setRetryAttempt((attempt) => attempt + 1);
    setErrorKey(decision.retryable ? 'errors.temporarilyUnavailable' : 'errors.apiRejected');
  }

  useEffect(() => {
    void restoreStoredSession({
      read: () => scope.read(),
      now: () => Date.now(),
      refreshLeadMs: sessionRefreshLeadMs,
      refresh: refreshSession,
      expiryAdvanced: sessionExpiryAdvanced,
      activate,
      handleFailure: handleSessionFailure,
      handleUnreadable: () => clearSession('errors.localSessionUnreadable', 'local_session_unreadable'),
    }).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!providerSignIn.identityToken && !providerSignIn.failed) return;
    (async () => {
      try {
        if (providerSignIn.failed || !providerSignIn.identityToken) throw new LocalizedError('errors.identityTokenMissing');
        let apiResponse: Awaited<ReturnType<ReturnType<typeof createSessionApiClient>['exchange']>>;
        try { apiResponse = await createSessionApiClient(apiURL, () => null).exchange(providerSignIn.identityToken); }
        catch { throw { kind: 'network' } satisfies SessionFailure; }
        if (!scope.active) return;
        const next = sessionCredentialFromResponse(apiResponse);
        const activationFailure = await activateExchangedSession(next, activate, saveSession);
        if (activationFailure) await handleSessionFailure(activationFailure.failure, next);
      } catch (cause) {
        if (session) await handleSessionFailure(cause, session);
        else { setAccessState('authentication_required'); setErrorKey(localizedFailure(cause, 'errors.signInFailed')); }
      }
      finally { providerSignIn.acknowledge(); setReady(true); }
    })();
  }, [providerSignIn.identityToken, providerSignIn.failed]);

  useEffect(() => {
    if (!session) return;
    const untilExpiry = Date.parse(session.expiresAt) - Date.now();
    if (untilExpiry <= 0) { void clearSession('errors.sessionExpired'); return; }
    const delay = accessState === 'authenticated_offline' && retryAttempt > 0 ? sessionRetryDelay(retryAttempt, session.expiresAt) : sessionRenewable ? sessionRefreshDelay(session.expiresAt) : untilExpiry;
    const timer = setTimeout(() => {
      if (!sessionRenewable && (accessState !== 'authenticated_offline' || retryAttempt === 0)) { void clearSession('errors.sessionExpired'); return; }
      void (async () => {
        let next: Session;
        try { next = await refreshSession(session); }
        catch (cause) { await handleSessionFailure(cause, session); return; }
        try { await activate(next, sessionExpiryAdvanced(session.expiresAt, next.expiresAt)); }
        catch (cause) { await handleSessionFailure(cause, next); }
      })();
    }, delay);
    return () => clearTimeout(timer);
  }, [session?.token, session?.expiresAt, sessionRenewable, accessState, retryAttempt]);

  if (session && ready) return <SafeAreaView style={styles.signedIn}>
    <View style={styles.toolbar}>
      <Text style={styles.title}>{i18n.t('app.title')}</Text>
      <Button title={i18n.t('auth.account')} onPress={() => setAccountOpen(true)} />
    </View>
    {accessState === 'authenticated_offline' ? <Text style={styles.notice}>{i18n.t('auth.offline')}</Text> : null}
    {errorKey ? <Text style={styles.notice} accessibilityRole="alert">{i18n.t(errorKey)}</Text> : null}
    <LightningScreen key={apiURL} apiURL={apiURL} token={session.token} translator={i18n} onUnauthorized={() => void clearSession('errors.sessionExpired')} />
    <Modal visible={accountOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAccountOpen(false)}>
      <SafeAreaView style={styles.account}>
        <Text style={styles.accountTitle} accessibilityRole="header">{i18n.t('auth.account')}</Text>
        {profile ? <Text>{i18n.t('auth.signedInAs', { name: profile.displayName || profile.email })}</Text> : null}
        <Text>{apiURL}</Text>
        <Button title={i18n.t('connection.change')} onPress={() => void changeServer()} />
        <Button title={i18n.t('auth.signOut')} onPress={() => { setAccountOpen(false); void clearSession(); }} />
        <Button title={i18n.t('common.close')} onPress={() => setAccountOpen(false)} />
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;

  return <SafeAreaView style={styles.account}>
    <Text style={styles.accountTitle}>{i18n.t('app.title')}</Text>
    <Text>{!ready ? i18n.t('common.loading') : i18n.t('auth.ready')}</Text>
    {errorKey ? <Text accessibilityRole="alert">{i18n.t(errorKey)}</Text> : null}
    <Text>{apiURL}</Text>
    <Button title={i18n.t('connection.change')} disabled={!ready} onPress={() => void changeServer()} />
    <Button title={i18n.t('auth.signIn')} disabled={!ready || !scope.active || !providerSignIn.ready} onPress={() => void providerSignIn.begin()} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  signedIn: { flex: 1, backgroundColor: '#20242a' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 48 },
  title: { color: '#ffffff', fontWeight: '700', fontSize: 20 },
  notice: { color: '#ffffff', paddingHorizontal: 16, paddingBottom: 8 },
  account: { flex: 1, padding: 24, gap: 20 },
  accountTitle: { fontSize: 32, fontWeight: '600' },
});
