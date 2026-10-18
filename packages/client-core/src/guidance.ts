import type { Clock } from './closest-strike';
import { validatedRoute, type Route, type Place, type RoutePort } from './route-planner';
import { RouteProgress, type NavigationFix, type ProgressSnapshot } from './route-progress';
export interface SpeechPort { speak(text: string): void; stop(): void; }
export type GuidanceSnapshot = {
  phase: 'idle' | 'guiding' | 'rerouting' | 'arrived';
  route: Route | null; destination: Place | null; progress: ProgressSnapshot | null;
  error: 'route' | null;
};
export class Guidance {
  private state: GuidanceSnapshot = { phase: 'idle', route: null, destination: null, progress: null, error: null };
  private progress: RouteProgress | null = null;
  private generation = 0;
  private pending = false;
  private lastAttempt = -Infinity;
  private attempts = 0;
  private lastSpeechTime = -Infinity;
  private announcements = new Set<string>();
  private latestFix: NavigationFix | null = null;
  constructor(private readonly routes: Pick<RoutePort, 'calculate'>, private readonly speech: SpeechPort, private readonly clock: Clock, private readonly arrivalText: string) {}
  snapshot(): GuidanceSnapshot {
    return { ...this.state, route: this.state.route ? validatedRoute(this.state.route) : null, destination: this.state.destination ? { ...this.state.destination, position: { ...this.state.destination.position } } : null, progress: this.state.progress ? { ...this.state.progress } : null };
  }
  start(candidate: Route, destination: Place, fix: NavigationFix): void {
    const route = validatedRoute(candidate);
    const progress = new RouteProgress(route, this.clock);
    const snapshot = progress.update(fix);
    if (snapshot.status === 'location-unavailable') throw new Error('NAVIGATION_LOCATION');
    this.end();
    this.progress = progress; this.latestFix = { ...fix };
    this.state = { phase: 'guiding', route, destination: { ...destination, position: { ...destination.position } }, progress: snapshot, error: null };
    this.announce();
  }
  end(): void {
    this.generation++; this.pending = false; this.progress = null; this.latestFix = null;
    this.attempts = 0; this.lastAttempt = -Infinity; this.announcements.clear(); this.lastSpeechTime = -Infinity;
    this.state = { phase: 'idle', route: null, destination: null, progress: null, error: null };
    this.stopSpeech();
  }
  pause(): void {
    if (this.state.phase === 'idle' || this.state.phase === 'arrived') return;
    this.generation++; this.pending = false; this.latestFix = null;
    this.state.phase = 'guiding';
    if (this.state.progress) this.state.progress = { ...this.state.progress, status: 'location-unavailable', needsReroute: false };
    this.stopSpeech();
  }
  retry(): void { this.attempts = 0; this.lastAttempt = -Infinity; this.state.error = null; }
  async update(fix: NavigationFix): Promise<void> {
    if (!this.progress || this.state.phase === 'arrived') return;
    const previous = this.state.progress?.status;
    const result = this.progress.update(fix);
    this.state.progress = result;
    this.latestFix = result.status === 'location-unavailable' ? null : { ...fix };
    if (result.status !== 'tracking' && previous === 'tracking') this.stopSpeech();
    if (result.status === 'tracking') { this.attempts = 0; this.state.error = null; }
    if (result.status === 'arrived') {
      this.generation++; this.pending = false; this.state.phase = 'arrived'; this.stopSpeech();
      this.say('arrival', this.arrivalText); return;
    }
    if (!this.pending && result.status === 'tracking') this.announce();
    if (result.needsReroute && !this.pending && this.attempts < 3 && this.clock.now() - this.lastAttempt >= 30000) await this.reroute();
  }
  private async reroute(): Promise<void> {
    if (!this.latestFix || !this.state.destination) return;
    const generation = this.generation;
    const destination = { ...this.state.destination.position };
    const origin = { latitude: this.latestFix.latitude, longitude: this.latestFix.longitude };
    this.pending = true; this.attempts++; this.lastAttempt = this.clock.now();
    this.state.phase = 'rerouting'; this.stopSpeech();
    try {
      const candidate = await this.routes.calculate(origin, destination);
      if (generation !== this.generation) return;
      const route = validatedRoute(candidate);
      const progress = new RouteProgress(route, this.clock);
      const snapshot = this.latestFix ? progress.update(this.latestFix) : null;
      if (snapshot?.status === 'off-route') throw new Error('REROUTE_ORIGIN_MISMATCH');
      this.progress = progress; this.announcements.clear(); this.attempts = 0;
      this.state = { ...this.state, phase: 'guiding', route, progress: snapshot, error: null };
      this.announce();
    } catch {
      if (generation === this.generation) this.state = { ...this.state, phase: 'guiding', error: 'route' };
    } finally { if (generation === this.generation) this.pending = false; }
  }
  private announce(): void {
    const { route, progress } = this.state;
    if (!route || !progress || progress.status !== 'tracking') return;
    const current = route.steps[progress.stepIndex];
    if (this.say(`step:${progress.stepIndex}`, current.instructions)) return;
    const next = route.steps[progress.stepIndex + 1];
    if (next && progress.maneuverDistanceMeters <= 150 && this.clock.now() - this.lastSpeechTime >= 5000) this.say(`approach:${progress.stepIndex + 1}`, next.instructions);
  }
  private say(key: string, text: string): boolean {
    if (!text.trim() || this.announcements.has(key)) return false;
    this.announcements.add(key); this.lastSpeechTime = this.clock.now();
    try { this.speech.speak(text); } catch { /* Visual guidance remains usable if speech fails. */ }
    return true;
  }
  private stopSpeech(): void { try { this.speech.stop(); } catch { /* Ending guidance must remain available. */ } }
}
