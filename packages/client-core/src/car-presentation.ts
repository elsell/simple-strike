export interface CarPresentationPort<T> {
  begin(): Promise<number>;
  publish(generation: number, snapshot: T): Promise<void>;
  end(generation: number): Promise<void>;
}

/** Bounded latest-state delivery to a session-scoped native presentation. */
export class CarPresentation<T> {
  private generation: number | null = null;
  private pending: { value: T } | null = null;
  private sending = false;
  private closed = false;
  private closing: Promise<void> | null = null;
  private readonly opening: Promise<void>;
  constructor(private readonly port: CarPresentationPort<T>, private readonly failed: (cause: unknown) => void) {
    this.opening = this.open();
  }
  update(value: T): void {
    if (this.closed) return;
    this.pending = { value };
    void this.flush();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true; this.pending = null;
    this.closing = this.opening.then(async () => {
      if (this.generation !== null) await this.port.end(this.generation);
    });
    return this.closing;
  }
  private async open(): Promise<void> {
    try {
      this.generation = await this.port.begin();
      if (!this.closed) void this.flush();
    } catch (cause) { if (!this.closed) this.failed(cause); }
  }
  private async flush(): Promise<void> {
    if (this.closed || this.sending || this.generation === null || !this.pending) return;
    const value = this.pending.value; this.pending = null; this.sending = true;
    try { await this.port.publish(this.generation, value); }
    catch (cause) { if (!this.closed) this.failed(cause); }
    finally { this.sending = false; if (!this.closed && this.pending) void this.flush(); }
  }
}
