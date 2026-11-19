import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vision } from '../src/vision';

test('pause parks inference, rejects in-flight results, resumes safely, and stop disposes while parked', async () => {
  const saved = ['document','requestAnimationFrame','cancelAnimationFrame'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  let pending: ((poses: any[]) => void) | undefined;
  let disposed=0, calls=0;
  const raf = new Map<number, FrameRequestCallback>(); let serial=0;
  const draws: number[][]=[];
  const canvas = { width:0,height:0,getContext:()=>({drawImage:(_video:unknown,...args:number[])=>draws.push(args)}) };
  Object.defineProperty(globalThis,'document',{value:{hidden:false,createElement:()=>canvas},configurable:true});
  Object.defineProperty(globalThis,'requestAnimationFrame',{value:(cb:FrameRequestCallback)=>{raf.set(++serial,cb);return serial;},configurable:true});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{value:(id:number)=>raf.delete(id),configurable:true});
  const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
  const video = {readyState:2,currentTime:0,videoWidth:1920,videoHeight:1080};
  const frame = async () => { video.currentTime++; for(const [id,cb] of [...raf]) {raf.delete(id);cb(performance.now());} await flush(); };
  const vision = new Vision(); const output:any[]=[];
  try {
    (vision as any).detector={estimatePoses:()=>{calls++;return new Promise<any[]>(resolve=>pending=resolve);},reset:()=>{throw new Error("MultiPose reset is unsupported");},dispose:()=>disposed++};
    vision.settings={dimension:256,hz:Infinity};
    vision.start(video as HTMLVideoElement,observation=>output.push(observation),error=>{throw error;});
    await frame(); assert.equal(calls,1); assert.deepEqual(draws[0],[0,0,256,144]);
    vision.pause(); vision.resume();
    pending!([{id:3,keypoints:[{x:128,y:72}]}]); await flush();
    assert.equal(output.length,0,'pre-pause result must not leak into resumed round');
    await frame(); assert.equal(calls,2);
    pending!([{id:3,keypoints:[{x:128,y:72}]}]); await flush();
    assert.equal(output[0].width,1920); assert.deepEqual(output[0].poses[0].keypoints[0],{x:960,y:540});
    vision.pause(); await frame();
    assert.equal(calls,2); assert.equal(raf.size,0,'paused loop must not keep scheduling frames');
    vision.resume(); await flush(); await frame(); assert.equal(calls,3);
    vision.pause(); pending!([]); await flush(); assert.equal(output.length,1);
    await vision.stop(); assert.equal(disposed,1); assert.equal(raf.size,0);
  } finally {
    await vision.stop();
    for(const [key,descriptor] of saved) {if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key);}
  }
});
