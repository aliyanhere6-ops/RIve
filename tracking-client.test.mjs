import assert from 'node:assert/strict';
import {createTrackingClient} from './tracking-client.mjs';
let worker,captures=0;
globalThis.Worker=class {
  constructor(){worker=this;}
  postMessage(data){if(data.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',acceleration:'CPU'}}));else this.frame=data;}
  terminate(){this.terminated=true;}
};
globalThis.createImageBitmap=async()=>{captures++;return {close(){}};};
const client=createTrackingClient();await client.ready;
const first=client.detect({videoWidth:640,videoHeight:480},100,false,true);
await Promise.resolve();
assert.equal(client.busy,true);
assert.equal(worker.frame.hands,true,'hand capture request reaches the worker');
assert.equal(await client.detect({videoWidth:640,videoHeight:480},110,false),null);
assert.equal(captures,1,'a slow detector must not accumulate camera frames');
worker.onmessage({data:{type:'result',id:worker.frame.id,result:{faceLandmarks:[]},ms:200,acceleration:'CPU'}});
await first;assert.equal(client.busy,false);
const pending=client.detect({videoWidth:640,videoHeight:480},200,false);await Promise.resolve();client.dispose();
assert.equal(await pending,null,'disposing releases a waiting frame');
assert.equal(worker.terminated,true);
console.log('PASS: worker readiness, single-frame backpressure, result release, shutdown');
