import type { Clock, Strike } from './closest-strike';
import type { FeedSnapshot } from './lightning-feed';

export type RecentSnapshot = {
  mode: 'demo' | 'live' | null;
  connection: 'loading' | 'online' | 'disconnected' | 'denied';
  strikes: Strike[];
};

/** Per-account, per-backend memory cache. Dispose it on sign-out or backend change. */
export class RecentLightning {
  private observations = new Map<string, Strike>();
  private mode: RecentSnapshot['mode'] = null;
  private connection: RecentSnapshot['connection'] = 'loading';
  constructor(private readonly clock: Clock) {}

  receive(batch: FeedSnapshot): void {
    if (batch.mode !== this.mode) this.observations.clear();
    this.mode = batch.mode;
    this.connection = 'online';
    const now = this.clock.now();
    for (const strike of batch.strikes) {
      const age = now - strike.occurredAtMs;
      if (age >= 0 && age < 300_000) {
        this.observations.set(strike.id, { ...strike, position: { ...strike.position } });
      }
    }
    this.expire();
  }
  disconnect(): void { this.connection = 'disconnected'; }
  deny(): void { this.observations.clear(); this.connection = 'denied'; }
  snapshot(): RecentSnapshot {
    this.expire();
    return {
      mode: this.mode, connection: this.connection,
      strikes: [...this.observations.values()].map(strike => ({ ...strike, position: { ...strike.position } })),
    };
  }
  private expire(): void {
    const now = this.clock.now();
    for (const [id, strike] of this.observations) {
      const age = now - strike.occurredAtMs;
      if (!Number.isFinite(age) || age < 0 || age >= 300_000) this.observations.delete(id);
    }
  }
}
