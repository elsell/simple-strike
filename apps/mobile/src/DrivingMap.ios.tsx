import { Button, StyleSheet, Text, View } from 'react-native';
import type { MapSnapshot } from '@simple-strike/client-core';
import type { Translator } from '@simple-strike/i18n';
import type { RecentSnapshot } from '@simple-strike/client-core';
import type { DrivingNavigation } from './useDrivingNavigation.ios';
import StrikeMap, { type MapLocation, type MapViewport, type MapRing } from '../modules/strike-map';

export type DrivingMapProps = {
  map: MapSnapshot;
  navigation: DrivingNavigation;
  onStartRoute(): void;
  onEndRoute(): void;
  feed: RecentSnapshot;
  vehicleAvailable: boolean;
  locationState: string;
  closestText: string | null;
  rings: MapRing[];
  translator: Translator;
  locationEnabled: boolean;
  onLocation(position: MapLocation): void;
  onLocationState(state: string): void;
  onExplore(position: MapViewport): void;
  onRecenter(): void;
  onZoomIn(): void;
  onZoomOut(): void;
};

/** Native presentation. The parent owns feed lifecycle and interaction state. */
export default function DrivingMap(props: DrivingMapProps) {
  const { translator: t, navigation: n } = props;
  const route = n.session.route ?? n.preview.route;
  const progress = n.session.progress;
  return <View style={styles.container}>
    <StrikeMap
      style={StyleSheet.absoluteFill}
      center={props.map.center}
      radiusMeters={props.map.radiusMeters}
      strikes={props.feed.strikes.map(strike => ({ id: strike.id, ...strike.position }))}
      rings={props.rings}
      route={route?.coordinates ?? []}
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
    {route ? <View style={styles.guidance}>
      <Text style={styles.text}>{n.session.destination?.name ?? n.preview.destination?.name}</Text>
      {n.session.phase === 'idle' ? <>
        <Text style={styles.text}>{t.t('navigation.summary', { distance: t.number(route.distanceMeters / 1609.344, { maximumFractionDigits: 1 }), minutes: t.number(Math.ceil(route.expectedTravelSeconds / 60)) })}</Text>
        {n.startFailed ? <Text style={styles.text}>{t.t('navigation.locationRequired')}</Text> : null}
        <Button title={t.t('navigation.start')} disabled={!props.vehicleAvailable} onPress={props.onStartRoute} />
      </> : <>
        <Text style={styles.text}>{t.t(n.session.phase === 'arrived' ? 'navigation.arrived' : n.session.phase === 'rerouting' ? 'navigation.rerouting' : progress?.status === 'off-route' ? 'navigation.offRoute' : progress?.status !== 'tracking' ? 'navigation.locationRequired' : 'navigation.guiding')}</Text>
        {progress?.status === 'tracking' && n.session.phase === 'guiding' ? <>
          <Text style={styles.maneuver}>{route.steps[progress.stepIndex]?.instructions}</Text>
          <Text style={styles.text}>{t.t('navigation.remaining', { distance: t.number(progress.remainingMeters / 1609.344, { maximumFractionDigits: 1 }) })}</Text>
        </> : null}
        {n.session.error ? <Button title={t.t('navigation.retry')} onPress={n.retry} /> : null}
      </>}
      <Button title={t.t(n.session.phase === 'idle' ? 'navigation.clear' : 'navigation.end')} onPress={props.onEndRoute} />
    </View> : null}
    <View style={styles.controls}>
      {n.session.phase === 'idle' ? <Button title={t.t('navigation.navigate')} onPress={n.show} /> : null}
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
  guidance: { position: 'absolute', left: 12, bottom: 28, maxWidth: '65%', borderRadius: 16, padding: 12, backgroundColor: '#20242aee' },
  maneuver: { color: '#ffffff', fontSize: 20, fontWeight: '600', marginTop: 8 },
  controls: { position: 'absolute', right: 12, bottom: 28, borderRadius: 16, padding: 8, gap: 10, backgroundColor: '#20242aee' },
});
