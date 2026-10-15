import assert from 'node:assert/strict';
import {HeadTracker,LipTracker,measureFace,mapDirection} from './tracking-core.mjs';
const neutral={x:.5,y:.4,span:.2,yaw:0,pitch:.5,opening:.02,mouthWidth:.5};
assert.equal(mapDirection(2,true,false),3);
assert.equal(mapDirection(3,true,false),2);
assert.equal(mapDirection(4,true,false),4,'horizontal reversal leaves pitch unchanged');
assert.equal(mapDirection(5,false,true),4);
assert.equal(mapDirection(1,true,true),1,'neutral remains neutral when reversed');
let now=0;
function feed(head,change={},options={},frames=60){let result;for(let i=0;i<frames;i++){now+=33;result=head.update({...neutral,...change},now,options);}return result;}
const head=new HeadTracker();feed(head);
assert.equal(feed(head,{span:.5},{currentSize:1}).size,1,'size remains locked during distance changes');
assert.equal(feed(head,{yaw:.22}).xy,2,'turning head without moving across screen is detected');
assert.equal(feed(head,{yaw:-.22}).xy,3,'opposite head turn is detected');
assert.equal(feed(head,{pitch:.8}).xy,5,'looking down is detected');
assert.equal(feed(head,{pitch:.2}).xy,4,'looking up is detected');
assert.equal(feed(head).xy,1,'returning to neutral resets direction');
for(let i=0;i<100;i++)assert.equal(feed(head,{yaw:(i%2?.02:-.02),pitch:.5+(i%2?.02:-.02)},{},1).xy,1,'small tracking noise does not switch direction');
const distance=new HeadTracker();feed(distance);
let size=0;
for(let i=0;i<150;i++)size=feed(distance,{span:.31},{autoSize:true,currentSize:size},1).size;
assert.equal(size,1,'sustained closer distance selects size 150');
for(let i=0;i<100;i++)size=feed(distance,{span:i%2?.28:.29},{autoSize:true,currentSize:size},1).size;
assert.equal(size,1,'distance boundary jitter does not flip size');
for(let i=0;i<100;i++)size=feed(distance,{span:.5,yaw:.3},{autoSize:true,currentSize:size},1).size;
assert.equal(size,1,'turning head freezes auto sizing');
const lips=new LipTracker();let mouth;
for(let i=0;i<60;i++){now+=33;mouth=lips.update({},neutral,.004,now);}
assert.equal(mouth.viseme,0,'background noise does not animate closed mouth');
for(let i=0;i<15;i++){now+=33;mouth=lips.update({jawOpen:.65},{...neutral,opening:.25},.06,now);}
assert.equal(mouth.viseme,9,'open speaking mouth selects Ah');
for(let i=0;i<20;i++){now+=33;mouth=lips.update({jawOpen:.3,mouthPucker:.8},{...neutral,opening:.1},.06,now);}
assert.equal(mouth.viseme,12,'rounded speaking mouth selects rounded Oo');
for(let i=0;i<40;i++){now+=33;mouth=lips.update({},neutral,.004,now);}
assert.equal(mouth.viseme,0,'mouth returns to idle after speech');
assert.equal(measureFace(Array.from({length:478},()=>({x:.5,y:.5}))),null,'degenerate face detections are ignored');
const landmarks=Array.from({length:478},()=>({x:.5,y:.5}));
for(const i of [33,133])landmarks[i]={x:.4,y:.35};
for(const i of [362,263])landmarks[i]={x:.6,y:.35};
landmarks[61]={x:.45,y:.6};landmarks[291]={x:.55,y:.6};
const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const before=measureFace(landmarks,matrix);landmarks[61].y=.7;landmarks[291].y=.7;
const after=measureFace(landmarks,matrix);
assert.equal(before.pitch,after.pitch,'opening mouth cannot change matrix-based head pitch');
assert.equal(before.yaw,after.yaw,'mouth motion cannot change matrix-based head yaw');
console.log('PASS: head turns, pitch, neutral return, noise rejection, size lock, size hysteresis, turn freeze, mouth onset/rounding/release, invalid landmarks');
