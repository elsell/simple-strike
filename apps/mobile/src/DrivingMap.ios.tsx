import { Button, StyleSheet, Text, View } from 'react-native';
import type { MapSnapshot } from '@simple-strike/client-core';
import type { Translator } from '@simple-strike/i18n';
import type { RecentSnapshot } from '@simple-strike/client-core';
import StrikeMap, { type MapCoordinate, type MapViewport, type MapRing } from '../modules/strike-map';

export type DrivingMapProps = {
  map: MapSnapshot;
  feed: RecentSnapshot;
  vehicleAvailable: boolean;
  locationState: string;
  closestText: string | null;
  rings: MapRing[];
  translator: Translator;
  locationEnabled: boolean;
  onLocation(position: MapCoordinate): void;
  onLocationState(state: string): void;
  onExplore(position: MapViewport): void;
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
      radiusMeters={props.map.radiusMeters}
      strikes={props.feed.strikes.map(strike => ({ id: strike.id, ...strike.position }))}
      rings={props.rings}
      locationEnabled={props.locationEnabled}
      onLocation={event => props.onLocation(event.nativeEvent)}
      onLocationState={event => props.onLocationState(event.nativeEvent.state)}
      onExplore={event => props.onExplore(event.nativeEvent)}
    />
    <View style={styles.status} pointerEvents="none">
      <Text style={styles.text}>{t.t(props.feed.mode === null ? 'map.loadingFeed' : props.feed.mode === 'demo' ? 'map.demo' : 'map.live')}</Text>
      {props.feed.connection === 'disconnected' ? <Text style={styles.text}>{t.t('map.disconnected')}</Text> : null}
      {props.feed.connection === 'denied' ? <Text style={styles.text}>{t.t('map.accessDenied')}</Text> : null}
      {!props.vehicleAvailable ? <Text style={styles.text}>{t.t(['denied', 'restricted', 'unavailable'].includes(props.locationState) ? 'map.locationUnavailable' : 'map.locating')}</Text> : null}
      {props.closestText ? <Text style={styles.text}>{props.closestText}</Text> : null}
      <Text style={styles.text}>{t.t('map.estimatedThunder')}</Text>
      {props.vehicleAvailable ? <Text style={styles.text}>{t.t(props.map.following ? 'map.following' : 'map.exploring')}</Text> : null}
    </View>
    <View style={styles.controls}>
      <Button title={t.t('map.zoomIn')} onPress={props.onZoomIn} />
      <Button title={t.t('map.zoomOut')} onPress={props.onZoomOut} />
      <Button title={t.t('map.recenter')} disabled={!props.vehicleAvailable} onPress={props.onRecenter} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320 },
  status: { position: 'absolute', top: 16, left: 16, borderRadius: 16, padding: 14, backgroundColor: '#20242aee' },
  text: { color: '#e4e8ef', fontSize: 14, marginTop: 4 },
  controls: { position: 'absolute', right: 12, bottom: 28, borderRadius: 16, padding: 8, gap: 10, backgroundColor: '#20242aee' },
});
