import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { useEffect, useRef, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, TextInput } from 'react-native';
import { createConfigurationApiClient } from '@simple-strike/api-client';
import { backendConnection, connectionIdentity, normalizeBackendURL, SessionScope, type ClientRuntimeConfig } from '@simple-strike/client-core';
import { type MessageKey } from '@simple-strike/i18n';
import { createDeviceTranslator } from '../src/i18n';
import { loadMobileConfig } from '../src/config';
import ConnectedHome from '../src/ConnectedHome';
import CarPlaySetup from '../src/CarPlaySetup';

const defaults = loadMobileConfig(Constants.expoConfig?.extra);
const settingsKey = 'backend_connection_v1';
const i18n = createDeviceTranslator(getLocales);
type Connection = { config: ClientRuntimeConfig; scope: SessionScope };
async function prepare(config: ClientRuntimeConfig): Promise<Connection> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, connectionIdentity(config));
  return { config, scope: new SessionScope(`application_session_${hash}`, {
    read: key => SecureStore.getItemAsync(key),
    write: (key, value) => SecureStore.setItemAsync(key, value),
    remove: key => SecureStore.deleteItemAsync(key),
  }) };
}

export default function Home() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [address, setAddress] = useState(defaults.apiURL);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync(settingsKey);
        if (saved) {
          const value = JSON.parse(saved);
          const config = backendConnection(value.apiURL, { version: 1, oidcIssuer: value.oidcIssuer, oidcClientId: value.oidcClientId }, defaults.environment);
          const restored = await prepare(config);
          if (active) { setAddress(config.apiURL); setConnection(restored); }
        }
      } catch { if (active) setError('connection.storageError'); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; pending.current?.abort(); };
  }, []);

  async function connect() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setBusy(true); setError(null);
    try {
      const url = normalizeBackendURL(address, defaults.environment);
      const metadata = await createConfigurationApiClient(url).read(controller.signal);
      const config = backendConnection(url, metadata, defaults.environment);
      const next = await prepare(config);
      if (controller.signal.aborted) return;
      await SecureStore.setItemAsync(settingsKey, JSON.stringify(config));
      if (!controller.signal.aborted) setConnection(next);
    } catch { setError('connection.failed'); }
    finally { clearTimeout(timeout); pending.current = null; setBusy(false); }
  }
  async function changeServer() {
    if (!connection) return;
    await connection.scope.close();
    await SecureStore.deleteItemAsync(settingsKey);
    setConnection(null); setError(null);
  }

  if (connection) return <ConnectedHome key={connection.scope.key} config={connection.config} scope={connection.scope} onChangeServer={changeServer} />;
  return <SafeAreaView style={styles.container}>
    <CarPlaySetup translator={i18n} />
    <Text style={styles.title} accessibilityRole="header">{i18n.t('app.title')}</Text>
    <Text>{i18n.t('connection.description')}</Text>
    <TextInput style={styles.input} accessibilityLabel={i18n.t('connection.address')} placeholder={i18n.t('connection.address')} value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={ready && !busy} />
    {error ? <Text accessibilityRole="alert">{i18n.t(error)}</Text> : null}
    {!ready || busy ? <Text>{i18n.t('common.loading')}</Text> : null}
    <Button title={i18n.t('connection.connect')} disabled={!ready || busy || !address.trim()} onPress={() => void connect()} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 20 },
  title: { fontSize: 32, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#777777', borderRadius: 8, padding: 12, minHeight: 48 },
});
