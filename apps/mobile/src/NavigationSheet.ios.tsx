import { useState } from 'react';
import { Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { MapPosition } from '@simple-strike/client-core';
import type { Translator } from '@simple-strike/i18n';
import type { DrivingNavigation } from './useDrivingNavigation.ios';
export default function NavigationSheet({ navigation: n, translator: t, near, vehicleAvailable, onStart }: { navigation: DrivingNavigation; translator: Translator; near: MapPosition; vehicleAvailable: boolean; onStart(): void }) {
  const [query, setQuery] = useState('');
  const busy = n.preview.phase === 'searching' || n.preview.phase === 'calculating';
  return <Modal visible={n.open} animationType="slide" presentationStyle="pageSheet" onRequestClose={n.close}>
    <SafeAreaView style={styles.sheet}>
      <Text style={styles.heading} accessibilityRole="header">{t.t('navigation.navigate')}</Text>
      <TextInput style={styles.input} accessibilityLabel={t.t('navigation.destination')} placeholder={t.t('navigation.destination')} value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={() => void n.search(query, near)} />
      <Button title={t.t('navigation.search')} disabled={!query.trim() || busy} onPress={() => void n.search(query, near)} />
      {busy ? <Text>{t.t('common.loading')}</Text> : null}
      {n.preview.error || n.startFailed ? <Text accessibilityRole="alert">{t.t(n.preview.error === 'location' || n.startFailed ? 'navigation.locationRequired' : 'navigation.failed')}</Text> : null}
      {!vehicleAvailable ? <Text>{t.t('navigation.locationRequired')}</Text> : null}
      <ScrollView>
        {n.preview.phase === 'results' && n.preview.places.length === 0 ? <Text>{t.t('navigation.noResults')}</Text> : null}
        {n.preview.places.map(place => <Button key={place.id} title={place.name} disabled={!vehicleAvailable} onPress={() => void n.select(place)} />)}
        {n.preview.route ? <>
          <Text style={styles.heading}>{n.preview.destination?.name}</Text>
          <Text>{t.t('navigation.summary', { distance: t.number(n.preview.route.distanceMeters / 1609.344, { maximumFractionDigits: 1 }), minutes: t.number(Math.ceil(n.preview.route.expectedTravelSeconds / 60)) })}</Text>
          <Button title={t.t('navigation.start')} disabled={!vehicleAvailable} onPress={onStart} />
        </> : null}
      </ScrollView>
      <Button title={t.t('common.close')} onPress={n.close} />
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({ sheet: { flex: 1, padding: 24, gap: 16 }, heading: { fontSize: 24, fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#777777', borderRadius: 8, padding: 12, minHeight: 48 } });
