import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Preparation, upperBodyCheck, type Body } from '../src/preparation';
import { Round } from '../src/round';
function body(player = 0, raised = true, id = player + 1): Body {
  const points: Body['points'] = Array(17).fill(null);
  for (const i of [5,6,7,8,9,10,11,12]) points[i] = { x: i % 2 ? 200 : 300, y: i < 7 ? 200 : i < 9 ? 310 : i < 11 ? raised ? 350 : 550 : 500 };
  return { player, id, points };
}
function hold(p: Preparation, bodies: Body[], start = 0, end = 1000) {
  for (let t = start; t <= end; t += 100) p.update(bodies, t);
}
test('belly line is proportional; wrists below shoulders can qualify without legs or face', () => {
  const view = upperBodyCheck(body().points);
  assert.equal(view.line?.y, 395); assert.deepEqual(view.hands, [true, true]);
  const p = new Preparation(1); hold(p, [body()]); assert.equal(p.allReady, true);
});
test('one hand, missing elbow, or missing hip cannot confirm', () => {
  for (const index of [7,9,11]) {
    const b = body(); b.points[index] = null;
    const p = new Preparation(1); hold(p, [b]); assert.equal(p.allReady, false);
  }
  const b = body(); b.points[9]!.y = 500;
  const p = new Preparation(1); hold(p, [b]); assert.equal(p.allReady, false);
});
test('both players confirm independently and can lower hands while waiting', () => {
  const p = new Preparation(2); hold(p, [body(0), body(1, false)]);
  assert.equal(p.views[0].ready, true); assert.equal(p.allReady, false);
  hold(p, [body(0, false), body(1)], 1100, 2200);
  assert.equal(p.allReady, true); assert.equal(p.allPresent(2200), true);
});
test('brief uncertainty does not advance progress; sustained loss clears it', () => {
  const p = new Preparation(1); hold(p, [body()], 0, 500);
  p.update([body(0, false)], 600); p.update([body()], 700);
  assert.equal(p.views[0].progress, .5);
  p.update([], 800); p.expire(1100); assert.equal(p.views[0].progress, 0);
  hold(p, [body()], 1200, 2200); assert.equal(p.allReady, true);
  p.expire(3000); assert.equal(p.allReady, true);
  p.expire(3201); assert.equal(p.allReady, false);
});
test('replacement ID clears confirmation and an interrupted countdown preserves the plan', () => {
  const p = new Preparation(2); hold(p, [body(0), body(1)]);
  const r = new Round(2); const plan = r.plan; r.ready(1000);
  p.update([body(0, true, 99), body(1)], 1100);
  assert.equal(p.views[0].ready, false); assert.equal(p.views[1].ready, true);
  if (!p.allReady) r.cancelCountdown();
  assert.equal(r.state, 'waiting'); assert.equal(r.plan, plan);
  assert.deepEqual(r.tick(9000), []);
  hold(p, [body(0, true, 99), body(1)], 1200, 2200);
  assert.equal(p.allReady, true); r.ready(2200);
  r.tick(5199); assert.equal(r.state, 'countdown');
  r.tick(5200); assert.equal(r.state, 'playing');
});
test('widely spaced inference samples cannot masquerade as holding a pose', () => {
  const p = new Preparation(1);
  p.update([body()], 0); p.update([body()], 1500);
  assert.equal(p.allReady, false); assert.equal(p.views[0].progress, 0);
});
