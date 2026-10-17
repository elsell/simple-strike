export type MapPosition = { latitude: number; longitude: number };
export type MapSnapshot = {
  vehicle: MapPosition;
  center: MapPosition;
  following: boolean;
  radiusMeters: number;
};

/** Client interaction state. Route computation and device location belong to ports. */
export class MapSession {
  private vehicle: MapPosition;
  private center: MapPosition;
  private following = true;
  private radiusMeters = 20 * 1609.344;

  constructor(initialPosition: MapPosition) {
    this.vehicle = { ...initialPosition };
    this.center = { ...initialPosition };
  }

  updatePosition(position: MapPosition): void {
    this.vehicle = { ...position };
    if (this.following) this.center = { ...position };
  }

  explore(center: MapPosition): void {
    this.following = false;
    this.center = { ...center };
  }

  zoomIn(): void {
    this.scaleRadius(0.5);
  }

  zoomOut(): void {
    this.scaleRadius(2);
  }

  private scaleRadius(factor: number): void {
    const next = this.radiusMeters * factor;
    if (Number.isFinite(next) && next > 0) this.radiusMeters = next;
  }

  recenter(): void {
    this.following = true;
    this.center = { ...this.vehicle };
  }

  /** Called after the navigation adapter confirms route guidance has ended. */
  endRoute(): void {
    this.recenter();
  }

  snapshot(): MapSnapshot {
    return {
      vehicle: { ...this.vehicle },
      center: { ...this.center },
      following: this.following,
      radiusMeters: this.radiusMeters,
    };
  }
}
