export interface SessionStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// Serialize storage changes so a pending native write cannot undo local sign-out.
export class SessionScope {
  private pending: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(readonly key: string, private readonly storage: SessionStorage) {}
  get active(): boolean { return !this.closed; }
  async read(): Promise<string | null> {
    const value = await this.storage.read(this.key);
    return this.closed ? null : value;
  }
  save(value: string | null): Promise<void> {
    if (this.closed) return Promise.resolve();
    const next = this.pending.catch(() => undefined).then(async () => {
      if (this.closed) return;
      if (value === null) await this.storage.remove(this.key);
      else await this.storage.write(this.key, value);
    });
    this.pending = next;
    return next;
  }
  close(): Promise<void> {
    this.closed = true;
    this.pending = this.pending.catch(() => undefined).then(() => this.storage.remove(this.key));
    return this.pending;
  }
}
