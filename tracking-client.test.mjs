import assert from 'node:assert/strict';import{createTrackingClient}from'./tracking-client.mjs';
const workers=[];let captures=0;
globalThis.Worker=class{
 constructor(url){this.body=String(url).endsWith('/body-worker.js');workers.push(this);}
 postMessage(data){if(data.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',acceleration:'CPU'}}));else this.frame=data;}
 terminate(){this.terminated=true;}
};
globalThis.createImageBitmap=async()=>{captures++;return{close(){}};};
const client=createTrackingClient();await client.ready;await Promise.resolve();const face=workers.find(w=>!w.body),body=workers.find(w=>w.body),video={videoWidth:640,videoHeight:480};
const first=client.detect(video,100,true);await Promise.resolve();await Promise.resolve();
assert.equal(client.busy,true);assert.equal(face.frame.body,false,'body inference must never run in the face worker');assert.ok(body.frame,'body has its own frame');assert.equal(await client.detect(video,110,true),null,'face queue stays bounded');
face.onmessage({data:{type:'result',id:face.frame.id,result:{faceLandmarks:[]},ms:20,acceleration:'CPU'}});const fast=await first;assert.equal(fast.body,null,'face result must resolve while body is still busy');
const before=captures;const second=client.detect(video,200,true);await Promise.resolve();await Promise.resolve();assert.equal(captures,before+1,'a busy body worker must not queue extra captures');
body.onmessage({data:{type:'body',id:body.frame.id,body:{landmarks:[[1]]}}});face.onmessage({data:{type:'result',id:face.frame.id,result:{faceLandmarks:[]},ms:20,acceleration:'CPU'}});const combined=await second;assert.equal(combined.bodyFresh,true);assert.deepEqual(combined.body,{landmarks:[[1]]});
const third=client.detect(video,300,true);await Promise.resolve();await Promise.resolve();const bodyFrame=body.frame;client.reset();body.onmessage({data:{type:'body',id:bodyFrame.id,body:{landmarks:[[99]]}}});face.onmessage({data:{type:'result',id:face.frame.id,result:{faceLandmarks:[]},ms:20,acceleration:'CPU'}});assert.equal((await third).body,null,'calibration discards body samples from before reset');
const pending=client.detect(video,400,false);await Promise.resolve();client.dispose();assert.equal(await pending,null);assert.ok(workers.every(w=>w.terminated),'both workers must release on disposal');
console.log('PASS: face results bypass slow body inference, independent bounded queues, fresh body delivery, calibration reset and shutdown');
