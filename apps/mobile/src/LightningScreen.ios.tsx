import { useEffect, useRef, useState } from 'react';
import { AppState, Text } from 'react-native';
import { createLightningApiClient } from '@simple-strike/api-client';
import { closestStrike, LightningFeed, MapSession, RecentLightning, readLightningWithSession } from '@simple-strike/client-core';
import DrivingMap from './DrivingMap.ios';
import NavigationSheet from './NavigationSheet.ios';
import { useDrivingNavigation } from './useDrivingNavigation.ios';
import type { LightningScreenProps } from './LightningScreen';
import { observeCarActivity, observeCarCommands, type CarCommand } from '../modules/strike-map/carplay';
import { useCarPresentation } from './useCarPresentation.ios';

import { carNavigationFeedback } from './car-navigation-feedback';

const clock = { now: () => Date.now() };

export default function LightningScreen(props: LightningScreenProps) {
  const current = useRef(props);
  current.current = props;
  const [cache] = useState(() => new RecentLightning(clock));
  const [map] = useState(() => new MapSession({ latitude: 27.95, longitude: -82.46 }));
  const [phoneActive, setPhoneActive] = useState(AppState.currentState === 'active');
  const [carActive, setCarActive] = useState(false);
  const active = phoneActive || carActive;
  const navigation = useDrivingNavigation(props.translator, active && cache.snapshot().connection !== 'denied');
  const [now, setNow] = useState(clock.now());
  const [locationState, setLocationState] = useState('undetermined');
  const [vehicleAvailable, setVehicleAvailable] = useState(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setPhoneActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const subscription = observeCarActivity(setCarActive);
    return () => subscription.remove();
  }, []);
  useEffect(() => { if (!active) setVehicleAvailable(false); }, [active]);

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
          denied = true; cache.deny(); navigation.deny(); map.endRoute();
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
  const carCommands = useRef<(command: CarCommand) => void>(() => undefined);
  carCommands.current = command => {
    if (cache.snapshot().connection === 'denied' || !active) return;
    switch (command.name) {
      case 'zoomIn': map.zoomIn(); break;
      case 'zoomOut': map.zoomOut(); break;
      case 'recenter': map.recenter(); break;
      case 'pan': map.explore(command.values, command.values.radiusMeters); break;
      case 'location': navigation.receive(command.values); map.updatePosition(command.values); setVehicleAvailable(true); setLocationState('authorized'); break;
      case 'locationState': setLocationState(command.values.state); if (command.values.state !== 'authorized') { setVehicleAvailable(false); navigation.unavailable(); } break;
      case 'search': void navigation.search(command.values.query, viewport.center); break;
      case 'select': void navigation.select(command.values); break;
      case 'startRoute': if (navigation.start()) map.recenter(); break;
      case 'retryRoute': navigation.retry(); break;
      case 'endRoute': navigation.end(); map.endRoute(); break;
    }
    redraw(value => value + 1);
  };
  useEffect(() => {
    const subscription = observeCarCommands(command => carCommands.current(command));
    return () => subscription.remove();
  }, []);
  const route = navigation.session.route ?? navigation.preview.route;
  const progress = navigation.session.progress;
  const feedback = carNavigationFeedback(navigation.startFailed, navigation.preview.error, navigation.session.error);
  const carFailed = useCarPresentation({
    authorized: snapshot.connection !== 'denied',
    labels: { phoneSignIn: t.t('carplay.phoneSignIn'), navigate: t.t('navigation.navigate'), start: t.t('navigation.start'), end: t.t('navigation.end'),
      close: t.t('common.close'), pan: t.t('carplay.pan'), source: t.t(snapshot.mode === null ? 'map.loadingFeed' : snapshot.mode === 'demo' ? 'map.demo' : 'map.live'),
      estimatedThunder: t.t('map.estimatedThunder'), retry: t.t('navigation.retry'), searchFailed: t.t('navigation.searchFailed'), noResults: t.t('navigation.noResults'), },
    vehicleAvailable, vehicle: viewport.vehicle, center: viewport.center, radiusMeters: viewport.radiusMeters,
    strikes: snapshot.strikes.map(strike => ({ id: strike.id, ...strike.position })), rings, route: route?.coordinates ?? [],
    navigationError: feedback.key ? t.t(feedback.key) : '', navigationRetry: feedback.retry,
    guidancePhase: navigation.session.phase,
    routeId: route?.id ?? '',
    routeSummary: route ? t.t('navigation.summary', { distance: t.number(route.distanceMeters / 1609.344, { maximumFractionDigits: 1 }), minutes: t.number(Math.ceil(route.expectedTravelSeconds / 60)) }) : '',
    maneuverDistanceMeters: progress?.maneuverDistanceMeters ?? 0,
    instructionId: progress ? `${route?.id}:${progress.stepIndex}` : '',
    guidanceStatus: t.t(navigation.session.phase === 'arrived' ? 'navigation.arrived' : navigation.session.phase === 'rerouting' ? 'navigation.rerouting' : progress?.status === 'off-route' ? 'navigation.offRoute' : 'navigation.locationRequired'),
    destinationName: navigation.session.destination?.name ?? navigation.preview.destination?.name ?? '',
    instruction: progress?.status === 'tracking' && navigation.session.phase === 'guiding' ? route?.steps[progress.stepIndex]?.instructions ?? '' : '',
    distanceRemainingMeters: progress?.remainingMeters ?? route?.distanceMeters ?? 0,
    expectedTravelSeconds: route ? route.expectedTravelSeconds * Math.max(0, Math.min(1, (progress?.remainingMeters ?? route.distanceMeters) / route.distanceMeters)) : 0,
    sourceMode: snapshot.mode ?? '', closestText: closestText ?? '',
  });
  return <>{carFailed ? <Text accessibilityRole="alert">{t.t('carplay.failed')}</Text> : null}<DrivingMap map={viewport} feed={snapshot} navigation={navigation} rings={rings} translator={t}
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
