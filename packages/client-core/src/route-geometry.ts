import type { MapPosition } from './map-session';
import { distanceMeters } from './closest-strike';
export type RouteMatch = { alongMeters: number; distanceMeters: number; segmentIndex: number };
type Segment = { start: MapPosition; end: MapPosition; length: number; offset: number; index: number };
const longitudeDelta = (value: number): number => ((value + 540) % 360) - 180;
function validate(position: MapPosition): void {
  if (!position || !Number.isFinite(position.latitude) || Math.abs(position.latitude) > 90 || !Number.isFinite(position.longitude) || Math.abs(position.longitude) > 180) throw new Error('INVALID_ROUTE_POSITION');
}

/** Projects onto the polyline within the caller's plausible progress interval. */
export class RouteGeometry {
  readonly lengthMeters: number;
  private readonly segments: Segment[] = [];
  constructor(coordinates: readonly MapPosition[]) {
    let offset = 0;
    for (const coordinate of coordinates) validate(coordinate);
    for (let index = 0; index + 1 < coordinates.length; index++) {
      const start = { ...coordinates[index] }; const end = { ...coordinates[index + 1] };
      const length = distanceMeters(start, end);
      if (length > 0) this.segments.push({ start, end, length, offset, index });
      offset += length;
    }
    if (!Number.isFinite(offset) || offset <= 0) throw new Error('EMPTY_ROUTE_GEOMETRY');
    this.lengthMeters = offset;
  }
  match(location: MapPosition, interval = { minimum: 0, maximum: this.lengthMeters }): RouteMatch {
    validate(location);
    const { minimum, maximum } = interval;
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum || maximum > this.lengthMeters) throw new Error('INVALID_ROUTE_INTERVAL');
    let best: RouteMatch | null = null;
    for (const segment of this.segments) {
      if (segment.offset > maximum || segment.offset + segment.length < minimum) continue;
      const dx = longitudeDelta(segment.end.longitude - segment.start.longitude) * Math.cos((segment.start.latitude + segment.end.latitude) / 2 * Math.PI / 180);
      const dy = segment.end.latitude - segment.start.latitude;
      const px = longitudeDelta(location.longitude - segment.start.longitude) * Math.cos((segment.start.latitude + segment.end.latitude) / 2 * Math.PI / 180);
      const py = location.latitude - segment.start.latitude;
      const projected = (px * dx + py * dy) / (dx * dx + dy * dy);
      const lower = Math.max(0, (minimum - segment.offset) / segment.length);
      const upper = Math.min(1, (maximum - segment.offset) / segment.length);
      const fraction = Math.max(lower, Math.min(upper, projected));
      const point = {
        latitude: segment.start.latitude + fraction * dy,
        longitude: longitudeDelta(segment.start.longitude + fraction * longitudeDelta(segment.end.longitude - segment.start.longitude)),
      };
      const candidate = { alongMeters: Math.max(minimum, Math.min(maximum, segment.offset + fraction * segment.length)), distanceMeters: distanceMeters(location, point), segmentIndex: segment.index };
      if (!best || candidate.distanceMeters < best.distanceMeters) best = candidate;
    }
    if (!best) throw new Error('NO_ROUTE_MATCH');
    return best;
  }
}
