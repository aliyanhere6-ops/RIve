import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worldToParent,limitReach,HandMotion,mapHands,ElbowTracker} from './hand-tracking.mjs';
const matrix={xx:0,xy:2,yx:-2,yy:0,tx:147,ty:385};
assert.deepEqual(worldToParent({x:107,y:445},matrix),{x:30,y:20});
assert.equal(worldToParent({x:1,y:1},{xx:0,xy:0,yx:0,yy:0,tx:0,ty:0}),null);
assert.ok(Math.hypot(...Object.values(limitReach({x:800,y:-900},{x:0,y:0})))<=294.001);
const motion=new HandMotion(0,0);for(let i=0;i<180;i++){const p=motion.update({x:100,y:-50},1/60);assert.ok(p.x<=100.001&&p.y>=-50.001);}assert.ok(Math.abs(motion.x-100)<.01);
const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));pose[11]={x:.7,y:.45};pose[12]={x:.3,y:.45};pose[13]={x:.75,y:.2};pose[14]={x:.25,y:.2};pose[15]={x:.9,y:.8};pose[16]={x:.1,y:.8};
const hands={landmarks:[[{x:.75,y:.2}],[{x:.25,y:.2}]]};
const a=mapHands(hands,pose),b=mapHands({landmarks:[...hands.landmarks].reverse()},pose);
assert.deepEqual(a,b,'detection order must not swap arms');assert.ok(a.left&&a.right);assert.ok(a.left.y<0&&a.right.y<0);
assert.deepEqual(mapHands(null,pose),a,'elbows work without hand detection');
pose[15].x=.1;pose[16].y=.9;assert.deepEqual(mapHands(null,pose),a,'wrist motion cannot move elbow targets');
pose[13].visibility=0;assert.equal(mapHands(null,pose).right,null,'lost elbow releases only its target');assert.deepEqual(mapHands(hands,null),{left:null,right:null});
pose[13].visibility=1;
const tracker=new ElbowTracker();let result;
for(let t=0;t<=800;t+=100)result=tracker.update(pose,t);
assert.ok(result.left&&result.right);
assert.ok(Math.abs(result.right.x)<.001&&Math.abs(result.right.y)<.001,'calibration keeps authored resting hand position');
pose[13].y-=.1;result=tracker.update(pose,900);
assert.ok(result.right.y<0,'raising elbow produces an upward offset');
assert.ok(Math.abs(result.left.y)<.001,'one elbow cannot move the other arm');
assert.equal(result.right.relativeToRest,true);
const held=tracker.update(null,1000);assert.deepEqual(held.right,result.right,'brief tracking loss must not snap to rest');
assert.equal(tracker.update(null,1300).right,null,'sustained loss releases safely');
globalThis.document={createElement:()=>({getContext:()=>null})};
const {default:init}=await import('./vendor/canvas_advanced.mjs');
const r=await init({wasmBinary:fs.readFileSync('vendor/runtime.wasm'),locateFile:n=>'vendor/'+n});
const f=await r.load(fs.readFileSync('vtuber.riv')),art=f.artboardByName('character');
const vm=f.viewModelByName('main '),inst=vm.instanceByName('Room')||vm.defaultInstance();art.bindViewModelInstance(inst);
const machine=new r.StateMachineInstance(art.stateMachineByName('State Machine 1'),art);machine.bindViewModelInstance(inst);machine.advanceAndApply(0);art.advance(0);
for(const side of ['left','right']){
 const node=art.node(side==='left'?'hand left':'hand  right'),shoulder=art.rootBone(side==='left'?'Left Arm Shoulder':'Right Arm Shoulder');assert.ok(node&&shoulder);
 const base={x:node.x,y:node.y};
 for(const offset of [{x:90,y:-150},{x:-80,y:-100},{x:20,y:210}]){
  const sm=shoulder.worldTransform(),pm=new r.Mat2D();node.parentWorldTransform(pm);const goal=limitReach({x:sm.tx+offset.x,y:sm.ty+offset.y},{x:sm.tx,y:sm.ty});const local=worldToParent(goal,pm);node.x=local.x;node.y=local.y;art.advance(0);const w=node.worldTransform();assert.ok(Math.hypot(w.tx-goal.x,w.ty-goal.y)<.01,'native target must match requested world position');w.delete();sm.delete();pm.delete();
 }
 node.x=base.x;node.y=base.y;art.advance(0);
}
machine.delete();art.delete();inst.unref();f.unref();
console.log('PASS: mirrored mapping, stable hand identity, lost detection, reach limits, smoothing, and actual Rive parent-space targets');

