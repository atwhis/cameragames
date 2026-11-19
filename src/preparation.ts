import type { Point } from './motion';
export type Body = { player: number; id: number; points: (Point | null)[] };
export type PreparationView = { ready: boolean; progress: number; message: string;
  line: { x1: number; x2: number; y: number } | null; hands: [boolean, boolean] };
const empty = (): PreparationView => ({ ready: false, progress: 0, message: '请站进活动区，让肩膀到髋部入镜', line: null, hands: [false, false] });
export function upperBodyCheck(points: (Point | null)[]): PreparationView {
  const view = empty();
  const [ls, rs, lh, rh] = [5, 6, 11, 12].map(i => points[i]);
  if (!ls || !rs || !lh || !rh) { view.message = '请让双肩和髋部清晰入镜'; return view; }
  const shoulderY = (ls.y + rs.y) / 2, hipY = (lh.y + rh.y) / 2;
  if (hipY - shoulderY < 20) { view.message = '请面向镜头站直'; return view; }
  const centerX = (ls.x + rs.x + lh.x + rh.x) / 4;
  const halfWidth = Math.max(40, Math.abs(ls.x - rs.x) * .8);
  const y = shoulderY + (hipY - shoulderY) * .65;
  view.line = { x1: centerX - halfWidth, x2: centerX + halfWidth, y };
  view.hands = [!!points[9] && points[9]!.y < y, !!points[10] && points[10]!.y < y];
  if (!points[7] || !points[8]) view.message = '请让双肘清晰入镜';
  else if (!points[9] || !points[10]) view.message = '请稍微分开双手，让手腕清晰入镜';
  else if (!view.hands.every(Boolean)) view.message = '双手抬到腹部线以上，不必高过肩膀';
  else view.message = '保持 1 秒，正在确认';
  return view;
}
export class Preparation {
  private slots: { id: number | null; seen: number; sample: number; good: boolean; held: number; invalidSince: number | null; view: PreparationView }[];
  constructor(public players: number) {
    this.slots = Array.from({ length: players }, () => ({ id: null, seen: -Infinity, sample: -Infinity,
      good: false, held: 0, invalidSince: null, view: empty() }));
  }
  update(bodies: Body[], time: number) {
    this.expire(time);
    for (let player = 0; player < this.players; player++) {
      const slot = this.slots[player], body = bodies.find(b => b.player === player);
      if (!body) { slot.good = false; slot.invalidSince ??= time; continue; }
      if (slot.id !== body.id) {
        slot.id = body.id; slot.held = 0; slot.good = false; slot.view = empty(); slot.sample = -Infinity; slot.invalidSince = null;
      }
      const check = upperBodyCheck(body.points);
      // Presence needs a visible torso, but confirmed players may lower their hands.
      if (check.line) slot.seen = time;
      const good = !!check.line && !!body.points[7] && !!body.points[8] && check.hands.every(Boolean);
      const delta = time - slot.sample;
      if (!slot.view.ready) {
        if (good) {
          if (slot.invalidSince !== null && time - slot.invalidSince > 200) slot.held = 0;
          if (slot.good && delta > 0 && delta <= 250) slot.held += delta;
          else if (delta > 250) slot.held = 0;
          slot.invalidSince = null;
        } else {
          slot.invalidSince ??= time;
          if (time - slot.invalidSince > 200) slot.held = 0;
        }
      }
      const ready = slot.view.ready || slot.held >= 1000;
      slot.view = { ...check, ready, progress: ready ? 1 : Math.min(1, slot.held / 1000),
        message: ready ? '✓ 已准备，可以放下双手' : check.message };
      slot.good = good; slot.sample = time;
    }
  }
  expire(now: number) {
    for (const slot of this.slots) {
      if (now - slot.seen > 1000) { slot.view = empty(); slot.held = 0; slot.good = false; }
      else if (now - slot.sample > 250 && !slot.view.ready) {
        slot.held = 0; slot.good = false; slot.view.progress = 0;
      }
      if (now - slot.sample > 250) slot.view.line = null;
    }
  }
  get views() { return this.slots.map(s => s.view); }
  get allReady() { return this.slots.every(s => s.view.ready); }
  allPresent(now: number) { return this.slots.every(s => now - s.seen <= 250); }
}
