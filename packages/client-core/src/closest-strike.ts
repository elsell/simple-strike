import type { MapPosition } from './map-session';

export type Strike = {
  id: string;
  position: MapPosition;
  occurredAtMs: number;
};
export type StrikeDistance = { strike: Strike; distanceMeters: number; ageMs: number };
export type Eligibility = (candidate: StrikeDistance) => boolean;
export type Clock = { now(): number };

export function distanceMeters(a: MapPosition, b: MapPosition): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians)
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

/** Selection only: caller supplies eligibility and localization owns display text. */
export function closestStrike(
  vehicle: MapPosition,
  strikes: readonly Strike[],
  clock: Clock,
  eligible: Eligibility,
): StrikeDistance | null {
  const now = clock.now();
  let closest: StrikeDistance | null = null;
  for (const observation of strikes) {
    const candidate: StrikeDistance = {
      strike: { ...observation, position: { ...observation.position } },
      distanceMeters: distanceMeters(vehicle, observation.position),
      ageMs: now - observation.occurredAtMs,
    };
    if (eligible(candidate) && (!closest || candidate.distanceMeters < closest.distanceMeters)) {
      closest = candidate;
    }
  }
  return closest;
}
