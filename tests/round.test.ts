import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, Round, makePlan, pace, spawnForPlayer } from '../src/round';

test('pace smoothly accelerates and pineapple probabilities are reduced by five points', () => {
  const times = [0, 15000, 30000, 45000, 60000];
  assert.deepEqual(times.map(t => pace(t).pineapple), [.05, .10, .15, .25, .35]);
  assert.deepEqual(times.map(t => pace(t).interval), [1500, 1200, 950, 750, 600]);
  for (let t = 1; t <= DURATION; t++) {
    assert.ok(pace(t).interval <= pace(t - 1).interval);
    assert.ok(pace(t).pineapple >= pace(t - 1).pineapple);
  }
});
test('plan is immutable during play, ends spawning early, and mirrors identical opportunities', () => {
  const plan = makePlan(() => .2);
  assert.ok(plan.length > 40 && plan.length < 90);
  assert.ok(plan.every(e => e.at < 58500));
  for (const e of plan) {
    const left = spawnForPlayer(e, 0, 2), right = spawnForPlayer(e, 1, 2);
    assert.equal(left.x + right.x, 1280); assert.equal(left.vx, -right.vx);
    assert.equal(left.kind, right.kind); assert.equal(left.at, right.at);
    assert.equal(left.vy, right.vy); assert.equal(left.radius, right.radius);
  }
  assert.equal(plan[0].kind, 'melon'); assert.equal(plan.at(-1)?.kind, 'pineapple');
});
test('waiting and countdown do not spend game time; scoring is independent and deduplicated', () => {
  const r = new Round(2, () => 0);
  assert.deepEqual(r.tick(100000), []); assert.equal(r.state, 'waiting');
  r.ready(100000); r.tick(102999); assert.equal(r.state, 'countdown');
  assert.equal(r.award(0, 0, 102999, 102999), 0);
  assert.equal(r.tick(103400).length, 1);
  assert.equal(r.award(0, 0, 103400, 103400), 2);
  assert.equal(r.award(0, 0, 103410, 103410), 0);
  assert.equal(r.award(0, 1, 103410, 103410), 2);
  assert.deepEqual(r.scores, [2, 2]);
  assert.deepEqual(r.counts, [{melon:0,pineapple:1},{melon:0,pineapple:1}]);
});
test('60 second deadline rejects late inference even before next render tick', () => {
  const r = new Round(1, () => .9); r.ready(0); r.tick(3400);
  assert.equal(r.award(0, 1, 3500, 3500), 0);
  assert.equal(r.award(0, 0, 3500, 3399), 0);
  assert.equal(r.award(0, 0, 3500, 3500), 1);
  assert.equal(r.award(1, 0, 63000, 62000), 0);
  assert.deepEqual(r.tick(63000), []); assert.equal(r.state, 'finished');
  assert.equal(r.elapsed, 60000); assert.deepEqual(r.tick(70000), []);
});
test('pause freezes countdown and deadline; overdue events are skipped symmetrically', () => {
  const r = new Round(2); r.ready(0); r.tick(1000);
  r.pause(1000, true); assert.deepEqual(r.tick(20000), []);
  r.pause(21000, false); r.tick(22000); assert.equal(r.countdown, 1);
  r.tick(23400); assert.equal(r.elapsed, 400);
  r.pause(24000, true); r.pause(34000, false);
  assert.equal(r.award(0, 0, 34000, 23400), 0);
  const due = r.tick(50000); assert.ok(due.every(e => 50000 - e.born < 2500));
  r.tick(92999); assert.equal(r.state, 'playing');
  r.tick(93000); assert.equal(r.state, 'finished');
});
