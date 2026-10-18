import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createLightningApiClient } from '@simple-strike/api-client';
import { closestStrike, LightningFeed, MapSession, RecentLightning, readLightningWithSession } from '@simple-strike/client-core';
import DrivingMap from './DrivingMap.ios';
import NavigationSheet from './NavigationSheet.ios';
import { useDrivingNavigation } from './useDrivingNavigation.ios';
import type { LightningScreenProps } from './LightningScreen';

const clock = { now: () => Date.now() };

export default function LightningScreen(props: LightningScreenProps) {
  const current = useRef(props);
  current.current = props;
  const [cache] = useState(() => new RecentLightning(clock));
  const [map] = useState(() => new MapSession({ latitude: 27.95, longitude: -82.46 }));
  const [active, setActive] = useState(AppState.currentState === 'active');
  const navigation = useDrivingNavigation(props.translator, active);
  const [now, setNow] = useState(clock.now());
  const [locationState, setLocationState] = useState('undetermined');
  const [vehicleAvailable, setVehicleAvailable] = useState(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') setVehicleAvailable(false);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previous = 0;
    const animate = (timestamp: number) => {
      if (timestamp - previous >= 33) { previous = timestamp; setNow(clock.now()); }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let denied = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const feed = new LightningFeed({
      async read(signal) {
        const timeout = new AbortController();
        const cancel = () => timeout.abort();
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        const deadline = setTimeout(cancel, 10_000);
        try { return await readLightningWithSession(
          (token, requestSignal) => createLightningApiClient(props.apiURL, () => token).read(requestSignal),
          () => current.current.token, timeout.signal,
        ); }
        finally { clearTimeout(deadline); signal.removeEventListener('abort', cancel); }
      },
    }, {
      received(batch) { cache.receive(batch); failures = 0; redraw(value => value + 1); },
      failed(error) {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) {
          denied = true; cache.deny();
          if (status === 401) current.current.onUnauthorized();
        } else { failures++; cache.disconnect(); }
        redraw(value => value + 1);
      },
    });
    const refresh = async () => {
      await feed.refresh();
      if (!disposed && !denied) timer = setTimeout(() => void refresh(), Math.min(30_000, 3000 * 2 ** Math.min(failures, 4)));
    };
    void refresh();
    return () => { disposed = true; clearTimeout(timer); feed.stop(); };
  }, [props.apiURL, active, cache]);

  const snapshot = cache.snapshot();
  const viewport = map.snapshot();
  const nearest = vehicleAvailable ? closestStrike(viewport.vehicle, snapshot.strikes, { now: () => now },
    candidate => candidate.ageMs >= 0 && candidate.ageMs < 300_000 && candidate.distanceMeters <= 50 * 1609.344) : null;
  const t = props.translator;
  const closestText = !vehicleAvailable ? null : nearest ? t.t('map.closest', {
    distance: t.number(nearest.distanceMeters / 1609.344, { maximumFractionDigits: 1 }),
    age: nearest.ageMs < 60_000
      ? t.t('map.secondsAgo', { count: Math.floor(nearest.ageMs / 1000) })
      : t.t('map.minutesAgo', { count: Math.floor(nearest.ageMs / 60_000) }),
  }) : snapshot.mode !== null && snapshot.connection !== 'denied' ? t.t('map.noNearby') : null;
  const rings = snapshot.strikes.map(strike => {
    const age = Math.max(0, now - strike.occurredAtMs);
    const progress = Math.min(1, age / 300_000);
    return { id: strike.id, ...strike.position, radiusMeters: age / 1000 * 343,
      opacity: 1 - progress, fillOpacity: 0.13 * (1 - progress), lineWidth: 1 + 3 * progress };
  });
  return <><DrivingMap map={viewport} feed={snapshot} navigation={navigation} rings={rings} translator={t}
    locationEnabled={active} vehicleAvailable={vehicleAvailable} locationState={locationState} closestText={closestText}
    onLocation={position => { navigation.receive(position); map.updatePosition(position); setVehicleAvailable(true); setLocationState('authorized'); redraw(value => value + 1); }}
    onLocationState={state => { setLocationState(state); if (state !== 'authorized') { setVehicleAvailable(false); navigation.unavailable(); } }}
    onExplore={position => { map.explore(position, position.radiusMeters); redraw(value => value + 1); }}
    onStartRoute={() => { if (navigation.start()) { map.recenter(); redraw(value => value + 1); } }}
    onEndRoute={() => { navigation.end(); map.endRoute(); redraw(value => value + 1); }}
    onRecenter={() => { map.recenter(); redraw(value => value + 1); }}
    onZoomIn={() => { map.zoomIn(); redraw(value => value + 1); }}
    onZoomOut={() => { map.zoomOut(); redraw(value => value + 1); }} />
    <NavigationSheet navigation={navigation} translator={t} near={viewport.center} vehicleAvailable={vehicleAvailable}
      onStart={() => { if (navigation.start()) { map.recenter(); redraw(value => value + 1); } }} />
  </>;
}
