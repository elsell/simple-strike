import type { MapPosition } from './map-session';
import type { Clock } from './closest-strike';
import { distanceMeters } from './closest-strike';
import type { Route } from './route-planner';
import { RouteGeometry } from './route-geometry';
export type NavigationFix = MapPosition & { accuracyMeters: number; timestampMs: number };
export type ProgressSnapshot = {
  status: 'tracking' | 'off-route' | 'location-unavailable' | 'arrived';
  alongMeters: number; remainingMeters: number; maneuverDistanceMeters: number; stepIndex: number; needsReroute: boolean;
};
export function usableNavigationFix(fix: NavigationFix | null, now: number): fix is NavigationFix {
  return fix != null && Number.isFinite(now) && Number.isFinite(fix.latitude) && Math.abs(fix.latitude) <= 90 && Number.isFinite(fix.longitude) && Math.abs(fix.longitude) <= 180 &&
    Number.isFinite(fix.accuracyMeters) && fix.accuracyMeters >= 0 && fix.accuracyMeters <= 50 && Number.isFinite(fix.timestampMs) && fix.timestampMs <= now && now - fix.timestampMs <= 10000;
}
export class RouteProgress {
  private readonly geometry: RouteGeometry;
  private readonly endpoint: MapPosition;
  private readonly stepEnds: number[];
  private readonly totalDistance: number;
  private along = 0;
  private lastMatchTime: number | null = null;
  private deviationSince: number | null = null;
  private lastFixTime = -Infinity;
  constructor(route: Route, private readonly clock: Clock) {
    this.geometry = new RouteGeometry(route.coordinates);
    this.endpoint = { ...route.coordinates[route.coordinates.length - 1] };
    if (!Number.isFinite(route.distanceMeters) || route.distanceMeters <= 0 || route.steps.length === 0) throw new Error('INVALID_ROUTE');
    this.totalDistance = route.distanceMeters;
    let distance = 0;
    this.stepEnds = route.steps.map(step => {
      if (!Number.isFinite(step.distanceMeters) || step.distanceMeters < 0) throw new Error('INVALID_STEP');
      distance += step.distanceMeters; return distance;
    });
    if (!Number.isFinite(distance) || distance <= 0) throw new Error('INVALID_STEPS');
    this.stepEnds = this.stepEnds.map(end => end / distance * this.totalDistance);
  }
  update(fix: NavigationFix): ProgressSnapshot {
    const now = this.clock.now();
    if (!usableNavigationFix(fix, now) || fix.timestampMs <= this.lastFixTime) {
      this.deviationSince = null; return this.snapshot('location-unavailable');
    }
    this.lastFixTime = fix.timestampMs;
    const forward = this.lastMatchTime === null ? 250 : 100 + 60 * Math.max(0, Math.min(10, (now - this.lastMatchTime) / 1000));
    const match = this.geometry.match(fix, { minimum: Math.max(0, this.along - 30), maximum: Math.min(this.geometry.lengthMeters, this.along + forward) });
    if (match.distanceMeters > Math.max(75, 2 * fix.accuracyMeters)) {
      this.deviationSince ??= now;
      return this.snapshot('off-route', now - this.deviationSince >= 8000);
    }
    this.deviationSince = null;
    this.lastMatchTime = now;
    this.along = Math.max(this.along, match.alongMeters);
    const arrived = this.geometry.lengthMeters - this.along <= 25 && fix.accuracyMeters <= 30 && distanceMeters(fix, this.endpoint) <= 40;
    return this.snapshot(arrived ? 'arrived' : 'tracking');
  }
  private snapshot(status: ProgressSnapshot['status'], needsReroute = false): ProgressSnapshot {
    const traveled = this.along / this.geometry.lengthMeters * this.totalDistance;
    let stepIndex = this.stepEnds.findIndex(end => end > traveled);
    if (stepIndex < 0) stepIndex = this.stepEnds.length - 1;
    return { status, alongMeters: this.along, remainingMeters: Math.max(0, this.totalDistance - traveled), maneuverDistanceMeters: Math.max(0, this.stepEnds[stepIndex] - traveled), stepIndex, needsReroute };
  }
}
