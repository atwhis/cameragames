import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blade, PlayerSlots, movingHit, segmentHitsCircle, toStage, type Pose } from '../src/motion';

test('fast swipe hits even when neither endpoint is inside the fruit', () => {
  assert.equal(segmentHitsCircle({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 50, y: 10 }, 8), true);
  assert.equal(segmentHitsCircle({ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 50, y: 10 }, 8), false);
  assert.equal(segmentHitsCircle({ x: 50, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 10 }, 8), true);
});
test('relative collision catches moving fruit crossing a moving hand', () => {
  assert.equal(movingHit({ from: { x: 0, y: 0, time: 0 }, to: { x: 100, y: 0, time: 50 }, player: 0 },
    { x: 100, y: 0 }, { x: 0, y: 0 }, 5), true);
});
test('stationary hands, jitter, tracking loss and teleports do not cut', () => {
  const blade = new Blade();
  assert.equal(blade.push({ x: 10, y: 10 }, 0, 0, 220), null);
  assert.equal(blade.push({ x: 11, y: 10 }, 33, 0, 220), null);
  assert.ok(blade.push({ x: 60, y: 10 }, 66, 0, 220));
  assert.equal(blade.push(null, 99, 0, 220), null);
  assert.equal(blade.push({ x: 130, y: 10 }, 132, 0, 220), null);
  assert.equal(blade.push({ x: 180, y: 10 }, 500, 0, 220), null);
  assert.equal(blade.push({ x: 1100, y: 10 }, 533, 0, 220), null);
});
test('mirroring and 4:3 letterboxing match the video display', () => {
  assert.deepEqual(toStage({ x: 0, y: 0 }, 640, 480), { x: 1120, y: 0 });
  assert.deepEqual(toStage({ x: 640, y: 480 }, 640, 480), { x: 160, y: 720 });
  assert.deepEqual(toStage({ x: 640, y: 360 }, 1280, 720), { x: 640, y: 360 });
});
function pose(id: number, x: number): Pose {
  return { id, score: 0.9, keypoints: Array.from({ length: 17 }, () => ({ x, y: 100, score: 0.9 })) };
}
test('player IDs survive reordered results and crossing the center', () => {
  const slots = new PlayerSlots();
  assert.deepEqual(slots.update([pose(10, 750), pose(20, 250)], 0, 1000, 2).map(p => p.pose.id), [10, 20]);
  assert.deepEqual(slots.update([pose(20, 700), pose(10, 300)], 33, 1000, 2).map(p => p.pose.id), [10, 20]);
});
test('brief player loss does not instantly assign a bystander; reacquisition resets motion', () => {
  const slots = new PlayerSlots();
  slots.update([pose(10, 750), pose(20, 250)], 0, 1000, 2);
  assert.equal(slots.update([pose(30, 750), pose(20, 250)], 500, 1000, 2).length, 1);
  const next = slots.update([pose(30, 750), pose(20, 250)], 1500, 1000, 2);
  assert.equal(next[0].pose.id, 30); assert.equal(next[0].changed, true);
  assert.equal(next[1].changed, false);
});
