export const WIDTH = 1280;
export const HEIGHT = 720;
export type Point = { x: number; y: number };
export type Sample = Point & { time: number };
export type Stroke = { from: Sample; to: Sample; player: number };
export type Keypoint = Point & { score?: number; name?: string };
export type Pose = { id?: number; score?: number; keypoints: Keypoint[] };

// The video uses object-fit: contain; mirror and letterbox exactly once here.
export function toStage(p: Point, width: number, height: number): Point {
  const scale = Math.min(WIDTH / width, HEIGHT / height);
  return { x: (WIDTH - width * scale) / 2 + (width - p.x) * scale,
    y: (HEIGHT - height * scale) / 2 + p.y * scale };
}

export function segmentHitsCircle(a: Point, b: Point, center: Point, radius: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length2)) : 0;
  return Math.hypot(a.x + t * dx - center.x, a.y + t * dy - center.y) <= radius;
}

// Relative motion prevents fast fruit from tunneling between two hand samples.
export function movingHit(stroke: Stroke, fruitFrom: Point, fruitTo: Point, radius: number): boolean {
  return segmentHitsCircle(
    { x: stroke.from.x - fruitFrom.x, y: stroke.from.y - fruitFrom.y },
    { x: stroke.to.x - fruitTo.x, y: stroke.to.y - fruitTo.y }, { x: 0, y: 0 }, radius);
}

export class Blade {
  private last: Sample | null = null;
  reset() { this.last = null; }
  push(point: Point | null, time: number, player: number, minSpeed: number): Stroke | null {
    if (!point || !Number.isFinite(point.x + point.y + time)) { this.reset(); return null; }
    const to = { ...point, time }, from = this.last;
    this.last = to;
    if (!from) return null;
    const dt = time - from.time, distance = Math.hypot(to.x - from.x, to.y - from.y);
    // Never bridge lost frames or an implausible keypoint teleport.
    if (dt <= 0 || dt > 220 || distance > WIDTH * 0.32 || distance / (dt / 1000) < minSpeed) return null;
    return { from, to, player };
  }
}

export type Assigned = { pose: Pose; player: number; changed: boolean };
export class PlayerSlots {
  private slots: { id: number | null; lastSeen: number }[] = [0, 1].map(() => ({ id: null, lastSeen: 0 }));
  reset() { this.slots = [0, 1].map(() => ({ id: null, lastSeen: 0 })); }
  update(poses: Pose[], time: number, width: number, count: number): Assigned[] {
    const valid = poses.filter(p => p.id !== undefined && (p.score ?? 1) >= 0.25 &&
      (p.keypoints[11]?.score ?? 0) >= 0.35 && (p.keypoints[12]?.score ?? 0) >= 0.35);
    const used = new Set<number>(), result: Assigned[] = [];
    for (let player = 0; player < count; player++) {
      const slot = this.slots[player];
      let pose = valid.find(p => p.id === slot.id && !used.has(p.id!));
      let changed = false;
      if (!pose && (slot.id === null || time - slot.lastSeen > 1200)) {
        // Fixed zones are for acquisition, not a fresh left-to-right sort each frame.
        const candidates = valid.filter(p => !used.has(p.id!) && !this.slots.some((s, i) => i !== player && s.id === p.id));
        const home = count === 1 ? 0.5 : player === 0 ? 0.25 : 0.75;
        const center = (p: Pose) => 1 - (p.keypoints[11].x + p.keypoints[12].x) / (2 * width);
        pose = candidates.filter(p => count === 1 || (player === 0 ? center(p) < 0.48 : center(p) > 0.52))
          .sort((a, b) => Math.abs(center(a) - home) - Math.abs(center(b) - home))[0];
        changed = !!pose && pose.id !== slot.id;
      }
      if (pose) {
        slot.id = pose.id!; slot.lastSeen = time; used.add(pose.id!);
        result.push({ pose, player, changed });
      }
    }
    return result;
  }
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}
