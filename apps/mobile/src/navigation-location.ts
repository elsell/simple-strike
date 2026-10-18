import type { GuidanceSnapshot, NavigationFix } from '@simple-strike/client-core';

export function navigationActivity(surfaceActive: boolean, authorized: boolean, phase: GuidanceSnapshot['phase']) {
  const background = authorized && (phase === 'guiding' || phase === 'rerouting');
  return { running: authorized && (surfaceActive || background), background };
}

export interface NavigationLocationPort {
  begin(): Promise<number>;
  end(generation: number): Promise<void>;
  observe(fix: (value: NavigationFix) => void, state: (value: string) => void): { remove(): void };
}

export function openNavigationLocation(port: NavigationLocationPort, fix: (value: NavigationFix) => void, state: (value: string) => void) {
  let closed = false;
  let generation: number | undefined;
  const subscription = port.observe(value => { if (!closed) fix(value); }, value => { if (!closed) state(value); });
  const release = (value: number) => { void port.end(value).catch(() => undefined); };
  void port.begin().then(value => {
    if (closed) release(value);
    else generation = value;
  }).catch(() => { if (!closed) state('unavailable'); });
  return () => {
    if (closed) return;
    closed = true; subscription.remove();
    if (generation !== undefined) release(generation);
  };
}
