export type FruitKind = 'melon' | 'pineapple';
export const DURATION = 60_000;
export const POINTS = { melon: 1, pineapple: 2 } as const;
export type Spawn = { at: number; kind: FruitKind; x: number; vx: number; vy: number; radius: number };
export function pace(ms: number) {
  const segment = Math.min(3, Math.floor(Math.max(0, ms) / 15000));
  const t = Math.min(1, Math.max(0, (ms - segment * 15000) / 15000));
  const intervals = [1500, 1200, 950, 750, 600], probabilities = [.05, .10, .15, .25, .35];
  return { interval: intervals[segment] + (intervals[segment + 1] - intervals[segment]) * t,
    pineapple: probabilities[segment] + (probabilities[segment + 1] - probabilities[segment]) * t };
}
export function makePlan(random = Math.random): Spawn[] {
  const plan: Spawn[] = [];
  for (let at = 400; at < DURATION - 1500; at += pace(at).interval) {
    plan.push({ at, kind: random() < pace(at).pineapple ? 'pineapple' : 'melon',
      x: 230 + random() * 180, vx: (random() - .5) * 36,
      vy: -650 - random() * 110, radius: 44 + random() * 14 });
  }
  return plan;
}
export function spawnForPlayer(event: Spawn, player: number, players: number) {
  return { ...event, x: players === 1 ? event.x * 2 : player === 0 ? event.x : 1280 - event.x,
    vx: player === 1 ? -event.vx : event.vx, player };
}
export type RoundState = 'waiting' | 'countdown' | 'playing' | 'finished';
export class Round {
  state: RoundState = 'waiting';
  plan: Spawn[];
  elapsed = 0;
  countdown = 3;
  scores = [0, 0];
  counts = [{ melon: 0, pineapple: 0 }, { melon: 0, pineapple: 0 }];
  private startAt = 0;
  private pausedAt: number | null = null;
  private cursor = 0;
  private awarded = new Set<string>();
  constructor(public players: number, random = Math.random) { this.plan = makePlan(random); }
  ready(now: number) {
    if (this.state !== 'waiting') return;
    this.state = 'countdown'; this.startAt = now + 3000;
  }
  cancelCountdown() {
    if (this.state === 'countdown') { this.state = 'waiting'; this.countdown = 3; }
  }
  pause(now: number, paused: boolean) {
    if (paused && this.pausedAt === null) this.pausedAt = now;
    if (!paused && this.pausedAt !== null) { this.startAt += now - this.pausedAt; this.pausedAt = null; }
  }
  tick(now: number): { event: Spawn; index: number; born: number }[] {
    if (this.pausedAt !== null || this.state === 'waiting' || this.state === 'finished') return [];
    this.countdown = Math.max(0, Math.ceil((this.startAt - now) / 1000));
    if (now < this.startAt) return [];
    this.state = 'playing'; this.elapsed = Math.min(DURATION, now - this.startAt);
    if (this.elapsed >= DURATION) { this.state = 'finished'; return []; }
    const due = [];
    while (this.cursor < this.plan.length && this.plan[this.cursor].at <= this.elapsed) {
      const index = this.cursor++, event = this.plan[index];
      // A stalled browser skips expired events for BOTH players, never bursts stale fruit.
      if (this.elapsed - event.at < 2500) due.push({ event, index, born: this.startAt + event.at });
    }
    return due;
  }
  award(index: number, player: number, now: number, sampleTime: number) {
    const event = this.plan[index], key = `${index}:${player}`;
    if (this.state !== 'playing' || this.pausedAt !== null || now >= this.startAt + DURATION ||
      player < 0 || player >= this.players || !event || sampleTime < this.startAt + event.at ||
      this.awarded.has(key)) return 0;
    this.awarded.add(key); this.counts[player][event.kind]++;
    this.scores[player] += POINTS[event.kind];
    return POINTS[event.kind];
  }
}
