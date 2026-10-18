import { requireNativeModule } from 'expo';
import type { CarPresentationPort, NavigationFix, Place } from '@simple-strike/client-core';
import type { MapCoordinate, MapRing, MapStrike, MapViewport } from './index';

export type CarSnapshot = {
  authorized: boolean;
  labels: Record<string, string>;
  vehicleAvailable: boolean;
  vehicle: MapCoordinate;
  center: MapCoordinate;
  radiusMeters: number;
  strikes: MapStrike[];
  rings: MapRing[];
  route: MapCoordinate[];
  routeId: string;
  routeSummary: string;
  maneuverDistanceMeters: number;
  instructionId: string;
  guidanceStatus: string;
  guidancePhase: string;
  destinationName: string;
  instruction: string;
  distanceRemainingMeters: number;
  expectedTravelSeconds: number;
  sourceMode: string;
  closestText: string;
};
export type CarCommand =
  | { name: 'zoomIn' | 'zoomOut' | 'recenter' | 'startRoute' | 'endRoute'; values: Record<string, never> }
  | { name: 'search'; values: { query: string } }
  | { name: 'select'; values: Place }
  | { name: 'pan'; values: MapViewport }
  | { name: 'location'; values: NavigationFix }
  | { name: 'locationState'; values: { state: string } };
type Subscription = { remove(): void };
type NativeCarPlay = {
  beginCarPresentation(): Promise<number>;
  publishCarPresentation(generation: number, snapshot: CarSnapshot): Promise<void>;
  endCarPresentation(generation: number): Promise<void>;
  carPlayIsActive(): Promise<boolean>;
  addListener(event: 'carPlayCommand', listener: (event: CarCommand) => void): Subscription;
  addListener(event: 'carPlayActivity', listener: (event: { active: boolean }) => void): Subscription;
};
function native(): NativeCarPlay {
  return requireNativeModule<NativeCarPlay>('StrikeMap');
}
export const carPresentationPort: CarPresentationPort<CarSnapshot> = {
  begin: () => native().beginCarPresentation(),
  publish: (generation, snapshot) => native().publishCarPresentation(generation, snapshot),
  end: generation => native().endCarPresentation(generation),
};
export function observeCarCommands(listener: (command: CarCommand) => void): Subscription {
  return native().addListener('carPlayCommand', listener);
}
export function observeCarActivity(listener: (active: boolean) => void): Subscription {
  let disposed = false;
  let changed = false;
  const subscription = native().addListener('carPlayActivity', event => { changed = true; if (!disposed) listener(event.active); });
  void native().carPlayIsActive().then(active => { if (!disposed && !changed) listener(active); }).catch(() => undefined);
  return { remove() { disposed = true; subscription.remove(); } };
}
