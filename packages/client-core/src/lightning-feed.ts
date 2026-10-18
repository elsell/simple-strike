import type { Strike } from './closest-strike';

export type FeedSnapshot = { mode: 'demo' | 'live'; strikes: Strike[] };
export type FeedSource = { read(signal: AbortSignal): Promise<FeedSnapshot> };
export type FeedObserver = {
  received(snapshot: FeedSnapshot): void;
  failed(error: unknown): void;
};

/** A delayed rejection of an old token must not discard a rotated credential. */
export async function readLightningWithSession(
  read: (token: string, signal: AbortSignal) => Promise<FeedSnapshot>,
  currentToken: () => string,
  signal: AbortSignal,
): Promise<FeedSnapshot> {
  const token = currentToken();
  try { return await read(token, signal); }
  catch (error) {
    if ((error as { status?: number } | null)?.status === 401 && token !== currentToken()) {
      throw { kind: 'network' };
    }
    throw error;
  }
}

/** One mounted feed session. Scheduling and disconnected display belong to callers. */
export class LightningFeed {
  private stopped = false;
  private controller: AbortController | null = null;
  private pending: Promise<void> | null = null;

  constructor(private readonly source: FeedSource, private readonly observer: FeedObserver) {}

  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.pending) return this.pending;
    const controller = new AbortController();
    this.controller = controller;
    this.pending = this.read(controller).finally(() => {
      this.pending = null;
      this.controller = null;
    });
    return this.pending;
  }

  stop(): void {
    this.stopped = true;
    this.controller?.abort();
  }

  private async read(controller: AbortController): Promise<void> {
    let snapshot: FeedSnapshot;
    try { snapshot = await this.source.read(controller.signal); }
    catch (error) {
      if (!this.stopped) this.observer.failed(error);
      return;
    }
    if (!this.stopped) this.observer.received(snapshot);
  }
}
