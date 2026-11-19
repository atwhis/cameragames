import Phaser from 'phaser';
import { Preparation, type Body, type PreparationView } from './preparation';
import { Round, spawnForPlayer, type Spawn, type FruitKind } from './round';
import { Blade, HEIGHT, WIDTH, movingHit, type Point, type Stroke } from './motion';

export const PLAYER_COLORS = [0xb7ef70, 0xff98b5];
export type Skeleton = Body;
type Fruit = { image: Phaser.GameObjects.Image; born: number; x: number; vx: number; vy: number; radius: number; player: number; index: number; kind: FruitKind };
type Fragment = { image: Phaser.GameObjects.Image; vx: number; vy: number; spin: number; age: number };
const links = [[5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]];

export class WatermelonScene extends Phaser.Scene {
  mode: 'idle' | 'camera' | 'mouse' = 'idle';
  showSkeleton = true;
  minSpeed = 220;
  paused = false;
  private fruits: Fruit[] = [];
  private fragments: Fragment[] = [];
  private strokes: Stroke[] = [];
  private skeletons: Skeleton[] = [];
  private skeletonTime = 0;
  private overlay!: Phaser.GameObjects.Graphics;
  round = new Round(1);
  players = 1;
  preparation = new Preparation(1);
  onPreparation: (views: PreparationView[]) => void = () => {};
  onRound: (round: Round) => void = () => {};
  private pointerBlade = new Blade();
  private hiddenAt = 0;
  onSlice: (kind: FruitKind, player: number, points: number) => void = () => {};

  constructor() { super('watermelon'); }

  create() {
    this.makeTextures();
    this.overlay = this.add.graphics().setDepth(10);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.mode !== 'mouse' || this.paused) return;
      const player = this.players === 2 && pointer.x >= WIDTH / 2 ? 1 : 0;
      const stroke = this.pointerBlade.push({ x: pointer.x, y: pointer.y }, performance.now(), player, this.minSpeed);
      if (stroke && this.players === 2 && (stroke.from.x < WIDTH / 2) !== (stroke.to.x < WIDTH / 2)) return;
      if (stroke) this.slice(stroke);
    });
    this.input.on('gameout', () => this.pointerBlade.reset());
  }

  setMode(mode: typeof this.mode) { this.mode = mode; this.reset(); }
  setPaused(paused: boolean) {
    const now = performance.now();
    if (paused && !this.paused) this.hiddenAt = now;
    if (!paused && this.paused) {
      // Phaser may stop updates in a background tab, so record pause time from visibilitychange.
      for (const f of this.fruits) f.born += now - this.hiddenAt;
      this.strokes = []; this.pointerBlade.reset();
    }
    this.round.pause(now, paused);
    if (this.mode === 'camera' && ['waiting', 'countdown'].includes(this.round.state)) {
      this.preparation = new Preparation(this.players); this.round.cancelCountdown();
    }
    this.paused = paused;
  }
  reset() {
    for (const f of this.fruits) f.image.destroy();
    for (const f of this.fragments) f.image.destroy();
    this.fruits = []; this.fragments = []; this.strokes = []; this.skeletons = [];
    this.pointerBlade.reset(); this.preparation = new Preparation(this.players);
    this.round = new Round(this.players);
    if (this.mode === 'mouse') this.round.ready(performance.now());
    if (this.paused) this.round.pause(performance.now(), true);
    this.onRound(this.round);
  }
  setSkeletons(skeletons: Skeleton[], time: number) {
    this.skeletons = skeletons; this.skeletonTime = time;
    if (this.mode === 'camera' && !this.paused && ['waiting', 'countdown'].includes(this.round.state)) {
      this.preparation.update(skeletons, time);
      if (!this.preparation.allReady) this.round.cancelCountdown();
    }
  }

  private makeTextures() {
    // All artwork is drawn locally; no external image assets or licensing dependencies.
    const make = (key: string, cut: boolean) => {
      const texture = this.textures.createCanvas(key, 144, 144)!;
      const c = texture.context;
      c.translate(72, 72);
      c.shadowColor = '#0008'; c.shadowBlur = 10; c.shadowOffsetY = 5;
      c.beginPath(); c.arc(0, 0, 58, 0, cut ? Math.PI : Math.PI * 2); c.closePath();
      c.fillStyle = '#145942'; c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.save(); c.clip();
      if (cut) {
        c.fillStyle = '#c4ed8c'; c.beginPath(); c.arc(0, 0, 53, 0, Math.PI); c.fill();
        c.fillStyle = '#ff5573'; c.beginPath(); c.arc(0, 0, 46, 0, Math.PI); c.fill();
        for (let i = 0; i < 9; i++) {
          const a = 0.28 + i * 0.32, r = i % 2 ? 22 : 36;
          c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a);
          c.fillStyle = '#522e3a'; c.beginPath(); c.ellipse(0, 0, 3, 5, 0, 0, 2 * Math.PI); c.fill(); c.restore();
        }
      } else {
        const g = c.createRadialGradient(-24, -25, 1, 0, 0, 70);
        g.addColorStop(0, '#97d75c'); g.addColorStop(0.65, '#419452'); g.addColorStop(1, '#18543e');
        c.fillStyle = g; c.fillRect(-70, -70, 140, 140);
        c.strokeStyle = '#185b3e'; c.lineWidth = 7;
        for (let i = -2; i <= 2; i++) {
          c.beginPath(); c.moveTo(i * 13, -60); c.bezierCurveTo(i * 28 + 12, -20, i * 28 - 12, 30, i * 13, 60); c.stroke();
        }
        c.fillStyle = '#ffffff35'; c.beginPath(); c.ellipse(-22, -27, 16, 9, -0.7, 0, 7); c.fill();
      }
      c.restore(); texture.refresh();
    };
    make('melon', false); make('half', true);
    for (const cut of [false, true]) {
      const texture = this.textures.createCanvas(cut ? 'pineapple-half' : 'pineapple', 144, 144)!;
      const c = texture.context; c.translate(72, 72);
      if (cut) {
        c.fillStyle = '#c58a21'; c.beginPath(); c.arc(0, 0, 58, 0, Math.PI); c.fill();
        c.fillStyle = '#ffe58a'; c.beginPath(); c.arc(0, 0, 51, 0, Math.PI); c.fill();
        c.fillStyle = '#fff5bf'; c.fillRect(-7, 0, 14, 48);
      } else {
        c.fillStyle = '#528c39';
        for (let i = -2; i <= 2; i++) {
          c.beginPath(); c.moveTo(0, -28); c.lineTo(i * 16, -71 + Math.abs(i) * 7); c.lineTo(i * 13 + 10, -32); c.fill();
        }
        c.save(); c.beginPath(); c.ellipse(0, 8, 46, 51, 0, 0, Math.PI * 2); c.clip();
        const g = c.createLinearGradient(-45, 0, 45, 0); g.addColorStop(0, '#c48b29'); g.addColorStop(.4, '#ffe275'); g.addColorStop(1, '#d7a139');
        c.fillStyle = g; c.fillRect(-60, -55, 120, 120); c.strokeStyle = '#9f762f'; c.lineWidth = 2;
        for (let i = -100; i < 120; i += 18) {
          c.beginPath(); c.moveTo(-55, i); c.lineTo(55, i + 75); c.stroke();
          c.beginPath(); c.moveTo(55, i); c.lineTo(-55, i + 75); c.stroke();
        }
        c.restore();
      }
      texture.refresh();
    }
    const dot = this.textures.createCanvas('juice', 12, 12)!;
    dot.context.fillStyle = '#ffffff'; dot.context.beginPath(); dot.context.arc(6, 6, 5, 0, 7); dot.context.fill(); dot.refresh();
  }

  private position(f: Fruit, time: number): Point {
    const age = Math.max(0, time - f.born) / 1000;
    return { x: f.x + f.vx * age, y: HEIGHT + 85 + f.vy * age + 0.5 * 460 * age * age };
  }

  private spawn(event: Spawn, index: number, born: number, player: number) {
    const spec = spawnForPlayer(event, player, this.players);
    const image = this.add.image(spec.x, HEIGHT + 85, spec.kind).setDisplaySize(spec.radius * 2.48, spec.radius * 2.48).setDepth(3);
    this.fruits.push({ ...spec, image, born, index });
  }

  slice(stroke: Stroke) {
    if (this.mode === 'idle' || this.paused || document.hidden || this.round.state !== 'playing') return;
    this.strokes.push(stroke);
    for (const fruit of [...this.fruits]) {
      if (fruit.player !== stroke.player || stroke.from.time < fruit.born) continue;
      const from = this.position(fruit, stroke.from.time), to = this.position(fruit, stroke.to.time);
      if (!movingHit(stroke, from, to, fruit.radius + 7)) continue;
      const points = this.round.award(fruit.index, stroke.player, performance.now(), stroke.to.time);
      if (!points) continue;
      this.fruits.splice(this.fruits.indexOf(fruit), 1);
      const at = this.position(fruit, performance.now());
      fruit.image.destroy();
      const angle = Math.atan2(stroke.to.y - stroke.from.y, stroke.to.x - stroke.from.x);
      // shortcut: center cuts follow the swipe angle; use clipping for off-center pieces later.
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      for (const side of [-1, 1]) {
        const image = this.add.image(at.x, at.y, fruit.kind === 'melon' ? 'half' : 'pineapple-half').setDisplaySize(fruit.radius * 2.48, fruit.radius * 2.48)
          .setRotation(angle + (side < 0 ? Math.PI : 0)).setDepth(4);
        this.fragments.push({ image, vx: side * nx * 135 + fruit.vx + Math.cos(angle) * 45, vy: side * ny * 135 - 100 + Math.sin(angle) * 45, spin: side * 2, age: 0 });
      }
      for (let i = 0; i < 12; i++) {
        const image = this.add.image(at.x, at.y, 'juice').setScale(Phaser.Math.FloatBetween(0.5, 1.3)).setTint(fruit.kind === 'pineapple' ? 0xffe080 : 0xff5573).setDepth(5);
        this.fragments.push({ image, vx: Phaser.Math.Between(-240, 240), vy: Phaser.Math.Between(-240, 70), spin: 0, age: 0 });
      }
      this.onSlice(fruit.kind, stroke.player, points);
      this.onRound(this.round);
    }
  }

  update(_time: number, delta: number) {
    const now = performance.now();
    if (document.hidden || this.paused) return;
    if (this.mode === 'camera' && ['waiting', 'countdown'].includes(this.round.state)) {
      this.preparation.expire(now);
      if (!this.preparation.allReady) this.round.cancelCountdown();
      else if (this.preparation.allPresent(now)) this.round.ready(now);
      this.onPreparation(this.preparation.views);
    }
    if (this.mode !== 'idle') {
      const previous = this.round.state;
      for (const { event, index, born } of this.round.tick(now)) {
        for (let player = 0; player < this.players; player++) this.spawn(event, index, born, player);
      }
      if (previous !== 'finished' && this.round.state === 'finished') {
        for (const f of this.fruits) f.image.destroy();
        this.fruits = []; this.strokes = [];
      }
      this.onRound(this.round);
    }
    for (const f of [...this.fruits]) {
      const p = this.position(f, now); f.image.setPosition(p.x, p.y).setRotation((now - f.born) / 1600);
      if (now - f.born > 1000 && p.y > HEIGHT + 150) { f.image.destroy(); this.fruits.splice(this.fruits.indexOf(f), 1); }
    }
    const dt = Math.min(delta / 1000, 0.05);
    for (const f of [...this.fragments]) {
      f.age += dt; f.vy += 460 * dt; f.image.x += f.vx * dt; f.image.y += f.vy * dt;
      f.image.rotation += f.spin * dt; f.image.setAlpha(Math.max(0, 1 - f.age / 1.3));
      if (f.age > 1.3) { f.image.destroy(); this.fragments.splice(this.fragments.indexOf(f), 1); }
    }
    this.overlay.clear();
    if (this.mode === 'camera' && this.round.state === 'waiting') {
      this.preparation.views.forEach((view, player) => {
        if (!view.line) return;
        const { x1, x2, y } = view.line;
        this.overlay.lineStyle(3, PLAYER_COLORS[player], .9).lineBetween(x1, y, x2, y);
        this.overlay.lineBetween(x1, y - 8, x1, y + 8).lineBetween(x2, y - 8, x2, y + 8);
      });
    }
    this.strokes = this.strokes.filter(s => now - s.to.time < 160);
    for (const s of this.strokes) {
      const alpha = Math.max(0, 1 - (now - s.to.time) / 200);
      this.overlay.lineStyle(14, PLAYER_COLORS[s.player], alpha * 0.13).lineBetween(s.from.x, s.from.y, s.to.x, s.to.y);
      this.overlay.lineStyle(4, PLAYER_COLORS[s.player], alpha).lineBetween(s.from.x, s.from.y, s.to.x, s.to.y);
      this.overlay.fillStyle(0xffffff, alpha).fillCircle(s.to.x, s.to.y, 5);
    }
    if (now - this.skeletonTime < 220) for (const skeleton of this.skeletons) {
      const color = PLAYER_COLORS[skeleton.player];
      if (this.showSkeleton) {
        this.overlay.lineStyle(2, color, 0.6);
        for (const [a,b] of links) {
          const from = skeleton.points[a], to = skeleton.points[b];
          if (from && to) this.overlay.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
      for (const index of [9,10]) {
        const p = skeleton.points[index]; if (!p) continue;
        this.overlay.lineStyle(3, color, 0.9).strokeCircle(p.x, p.y, 13);
        this.overlay.fillStyle(color, 0.9).fillCircle(p.x, p.y, 4);
      }
    }
  }
}

export function createGame(parent: HTMLElement, scene: WatermelonScene) {
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT, transparent: true,
    scene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' }, audio: { noAudio: true },
    fps: { target: 60 }, banner: false });
}
