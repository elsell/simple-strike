export type MapPosition = { latitude: number; longitude: number };
export type MapSnapshot = {
  vehicle: MapPosition;
  center: MapPosition;
  following: boolean;
};

/** Client interaction state. Route computation and device location belong to ports. */
export class MapSession {
  private vehicle: MapPosition;
  private center: MapPosition;
  private following = true;

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
    };
  }
}
