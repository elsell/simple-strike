import { Button, StyleSheet, Text, View } from 'react-native';
import type { MapSnapshot } from '@simple-strike/client-core';
import type { Translator } from '@simple-strike/i18n';
import type { LightningSnapshot } from '@simple-strike/api-client';
import StrikeMap, { type MapCoordinate, type MapRing } from '../modules/strike-map';

export type DrivingMapProps = {
  map: MapSnapshot;
  feed: LightningSnapshot;
  radiusMeters: number;
  rings: MapRing[];
  translator: Translator;
  locationEnabled: boolean;
  onLocation(position: MapCoordinate): void;
  onLocationState(state: string): void;
  onExplore(position: MapCoordinate): void;
  onRecenter(): void;
  onZoomIn(): void;
  onZoomOut(): void;
};

/** Native presentation. The parent owns feed lifecycle and interaction state. */
export default function DrivingMap(props: DrivingMapProps) {
  const { translator: t } = props;
  return <View style={styles.container}>
    <StrikeMap
      style={StyleSheet.absoluteFill}
      center={props.map.center}
      radiusMeters={props.radiusMeters}
      strikes={props.feed.strikes.map(strike => ({ id: strike.id, ...strike.position }))}
      rings={props.rings}
      locationEnabled={props.locationEnabled}
      onLocation={event => props.onLocation(event.nativeEvent)}
      onLocationState={event => props.onLocationState(event.nativeEvent.state)}
      onExplore={event => props.onExplore(event.nativeEvent)}
    />
    <View style={styles.status} pointerEvents="none">
      <Text style={styles.title}>{t.t('app.title')}</Text>
      <Text style={styles.text}>{t.t(props.feed.mode === 'demo' ? 'map.demo' : 'map.live')}</Text>
      <Text style={styles.text}>{t.t(props.map.following ? 'map.following' : 'map.exploring')}</Text>
    </View>
    <View style={styles.controls}>
      <Button title={t.t('map.zoomIn')} onPress={props.onZoomIn} />
      <Button title={t.t('map.zoomOut')} onPress={props.onZoomOut} />
      <Button title={t.t('map.recenter')} onPress={props.onRecenter} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320 },
  status: { position: 'absolute', top: 16, left: 16, borderRadius: 16, padding: 14, backgroundColor: '#20242aee' },
  title: { color: '#ffffff', fontWeight: '700', fontSize: 20 },
  text: { color: '#e4e8ef', fontSize: 14, marginTop: 4 },
  controls: { position: 'absolute', right: 12, bottom: 28, borderRadius: 16, padding: 8, gap: 10, backgroundColor: '#20242aee' },
});
