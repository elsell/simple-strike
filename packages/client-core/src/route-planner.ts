import type { MapPosition } from './map-session';
export type Place = { id: string; name: string; position: MapPosition };
export type Route = {
  id: string; distanceMeters: number; expectedTravelSeconds: number;
  coordinates: MapPosition[];
  steps: { instructions: string; distanceMeters: number; coordinates: MapPosition[] }[];
};
export interface RoutePort {
  search(query: string, near: MapPosition): Promise<Place[]>;
  calculate(origin: MapPosition, destination: MapPosition): Promise<Route>;
}
export type RoutePreview = {
  phase: 'idle' | 'searching' | 'results' | 'calculating' | 'preview' | 'error';
  places: Place[]; destination: Place | null; route: Route | null;
  error: 'location' | 'search' | 'route' | null;
};
const initial = (): RoutePreview => ({ phase: 'idle', places: [], destination: null, route: null, error: null });
function position(value: MapPosition | null): value is MapPosition {
  return value !== null && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
function copyPlace(value: Place): Place { return { ...value, position: { ...value.position } }; }
function copyRoute(value: Route): Route {
  return { ...value, coordinates: value.coordinates.map(p => ({ ...p })), steps: value.steps.map(step => ({ ...step, coordinates: step.coordinates.map(p => ({ ...p })) })) };
}
export function validatedRoute(route: Route): Route {
  if (!route || !route.id || !Number.isFinite(route.distanceMeters) || route.distanceMeters <= 0 || !Number.isFinite(route.expectedTravelSeconds) || route.expectedTravelSeconds < 0 ||
          !Array.isArray(route.coordinates) || route.coordinates.length < 2 || !route.coordinates.every(position) || !Array.isArray(route.steps) || route.steps.length === 0 ||
          route.steps.some(step => !step || typeof step.instructions !== 'string' || !Number.isFinite(step.distanceMeters) || step.distanceMeters < 0 || !Array.isArray(step.coordinates) || !step.coordinates.every(position))) throw new Error('INVALID_ROUTE');
  return copyRoute(route);
}
export class RoutePlanner {
  private state = initial();
  private generation = 0;
  constructor(private readonly port: RoutePort) {}
  cancel(): void { this.generation++; this.state = initial(); }
  snapshot(): RoutePreview {
    return { ...this.state, places: this.state.places.map(copyPlace), destination: this.state.destination ? copyPlace(this.state.destination) : null, route: this.state.route ? copyRoute(this.state.route) : null };
  }
  async search(query: string, near: MapPosition): Promise<void> {
    const generation = ++this.generation;
    this.state = initial();
    if (!query.trim()) return;
    if (!position(near)) { this.state = { ...this.state, phase: 'error', error: 'location' }; return; }
    this.state.phase = 'searching';
    try {
      const places = await this.port.search(query.trim(), { ...near });
      if (generation !== this.generation) return;
      if (!Array.isArray(places) || places.some(p => !p || !p.id || typeof p.name !== 'string' || !position(p.position))) throw new Error('INVALID_PLACES');
      this.state = { ...initial(), phase: 'results', places: places.map(copyPlace) };
    } catch { if (generation === this.generation) this.state = { ...initial(), phase: 'error', error: 'search' }; }
  }
  async select(destination: Place, origin: MapPosition | null): Promise<void> {
    const generation = ++this.generation;
    this.state = initial();
    if (!position(origin)) { this.state = { ...this.state, phase: 'error', error: 'location' }; return; }
    if (!position(destination.position)) { this.state = { ...this.state, phase: 'error', error: 'route' }; return; }
    this.state = { ...this.state, phase: 'calculating', destination: copyPlace(destination) };
    try {
      const route = await this.port.calculate({ ...origin }, { ...destination.position });
      if (generation !== this.generation) return;
      this.state = { ...this.state, phase: 'preview', route: validatedRoute(route) };
    } catch { if (generation === this.generation) this.state = { ...this.state, phase: 'error', error: 'route' }; }
  }
}
