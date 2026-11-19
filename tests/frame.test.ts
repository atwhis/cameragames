import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferenceSize, cameraPoses } from '../src/frame';
import { toStage } from '../src/motion';

test('frame is reduced to model size for 720p, 1080p, 4:3 and portrait', () => {
  assert.deepEqual(inferenceSize(1280,720,256), {width:256,height:144});
  assert.deepEqual(inferenceSize(1920,1080,256), {width:256,height:144});
  assert.deepEqual(inferenceSize(640,480,320), {width:320,height:240});
  assert.deepEqual(inferenceSize(1080,1920,256), {width:144,height:256});
  assert.deepEqual(inferenceSize(128,96,256), {width:128,height:96});
});
test('scaled keypoints retain identities and map to exactly the same display coordinates', () => {
  for (const [width,height] of [[1920,1080],[640,480],[1080,1920],[1000,777]]) {
    const size = inferenceSize(width,height,256);
    const original = {x:width*.27,y:height*.63};
    const poses = [{id:7,score:.8,keypoints:[{x:original.x*size.width/width,y:original.y*size.height/height,score:.9,name:'left_wrist'}]}];
    const restored = cameraPoses(poses,width/size.width,height/size.height);
    assert.equal(restored[0].id,7); assert.equal(restored[0].keypoints[0].score,.9);
    const expected=toStage(original,width,height), actual=toStage(restored[0].keypoints[0],width,height);
    assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-9);
    assert.notEqual(restored[0].keypoints[0],poses[0].keypoints[0]);
  }
});
