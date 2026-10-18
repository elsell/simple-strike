import { useEffect, useRef, useState } from 'react';
import { Guidance, RoutePlanner, usableNavigationFix, type NavigationFix, type Place, type MapPosition } from '@simple-strike/client-core';
import type { Translator } from '@simple-strike/i18n';
import { mapKitRoutePort, navigationSpeech } from '../modules/strike-map/routes';

export function useDrivingNavigation(translator: Translator, active: boolean) {
  const [planner] = useState(() => new RoutePlanner(mapKitRoutePort));
  const [guidance] = useState(() => new Guidance(mapKitRoutePort, navigationSpeech(translator.locale), { now: () => Date.now() }, translator.t('navigation.arrived')));
  const [preview, setPreview] = useState(() => planner.snapshot());
  const [session, setSession] = useState(() => guidance.snapshot());
  const [open, setOpen] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const mounted = useRef(true);
  const enabled = useRef(active); enabled.current = active;
  const location = useRef<NavigationFix | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; planner.cancel(); guidance.end(); };
  }, [planner, guidance]);
  useEffect(() => {
    if (!active) {
      location.current = null; planner.cancel(); guidance.pause();
      setPreview(planner.snapshot()); setSession(guidance.snapshot()); setOpen(false);
    }
  }, [active, planner, guidance]);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (location.current && !usableNavigationFix(location.current, Date.now())) {
        location.current = null; guidance.pause(); setSession(guidance.snapshot());
      }
      timer = setTimeout(tick, 1000);
    };
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, [active, guidance]);
  async function search(query: string, near: MapPosition) {
    if (!enabled.current) return;
    const work = planner.search(query, near); setPreview(planner.snapshot());
    await work; if (mounted.current) setPreview(planner.snapshot());
  }
  async function select(place: Place) {
    if (!enabled.current) return;
    setStartFailed(false);
    const work = planner.select(place, usableNavigationFix(location.current, Date.now()) ? location.current : null); setPreview(planner.snapshot());
    await work; if (mounted.current) setPreview(planner.snapshot());
  }
  function receive(fix: NavigationFix) {
    if (!enabled.current) return;
    location.current = usableNavigationFix(fix, Date.now()) ? fix : null;
    const work = guidance.update(fix); setSession(guidance.snapshot());
    void work.finally(() => { if (mounted.current) setSession(guidance.snapshot()); });
  }
  function unavailable() { location.current = null; guidance.pause(); setSession(guidance.snapshot()); }
  function start() {
    if (!enabled.current) return false;
    if (!preview.route || !preview.destination || !location.current) { setStartFailed(true); return; }
    try {
      guidance.start(preview.route, preview.destination, location.current);
      planner.cancel(); setPreview(planner.snapshot()); setSession(guidance.snapshot());
      setOpen(false); setStartFailed(false); return true;
    } catch { setStartFailed(true); return false; }
  }
  function end() { planner.cancel(); guidance.end(); setPreview(planner.snapshot()); setSession(guidance.snapshot()); setStartFailed(false); setOpen(false); }
  function deny() { enabled.current = false; location.current = null; end(); }
  function close() {
    if (preview.phase === 'searching' || preview.phase === 'calculating') { planner.cancel(); setPreview(planner.snapshot()); }
    setOpen(false);
  }
  return { preview, session, open, startFailed, search, select, receive, unavailable, start, end, deny, close,
    show: () => { if (enabled.current) { setStartFailed(false); setOpen(true); } },
    retry: () => { if (enabled.current) { guidance.retry(); setSession(guidance.snapshot()); } },
  };
}
export type DrivingNavigation = ReturnType<typeof useDrivingNavigation>;
