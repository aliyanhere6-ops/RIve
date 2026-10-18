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
assert.deepEqual(a,b,'detection order must not swap arms');assert.ok(a.left&&a.right);assert.ok(Number.isFinite(a.left.angle)&&Number.isFinite(a.right.angle));
assert.deepEqual(mapHands(null,pose),a,'elbows work without hand detection');
const moved=structuredClone(pose);moved[15]={x:.5,y:.1};assert.notDeepEqual(mapHands(null,moved).right,a.right,'wrist direction must guide the forearm');
pose[13].visibility=0;assert.equal(mapHands(null,pose).right,null,'lost elbow releases only its target');assert.deepEqual(mapHands(hands,null),{left:null,right:null});
pose[13].visibility=1;
const tracker=new ElbowTracker();const result=tracker.update(pose,100);
assert.ok(result.left&&result.right);
const held=tracker.update(null,200);assert.deepEqual(held.right,result.right);
assert.equal(tracker.update(null,500).right,null);
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

for(const raised of [false,true]){
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));p[11]={x:.65,y:.4};p[12]={x:.35,y:.4};p[13]={x:.8,y:.6};p[14]={x:.2,y:.6};p[15]={x:.7,y:raised?.22:.85};p[16]={x:.3,y:raised?.22:.85};
 const goals=mapHands(null,p,{mirror:false});
 for(const side of ['left','right']){
  const g=goals[side],node=art.node(side==='left'?'hand left':'hand  right'),shoulder=art.rootBone(side==='left'?'Left Arm Shoulder':'Right Arm Shoulder');
  const anim=new r.LinearAnimationInstance(art.animationByName('Camera '+(side==='left'?'Left':'Right')+' Bend '+(g.bendInverse?'B':'A')),art);anim.time=0;anim.apply(1);anim.delete();
  const sm=shoulder.worldTransform(),pm=new r.Mat2D();node.parentWorldTransform(pm);
  const pos=worldToParent({x:sm.tx+g.x,y:sm.ty+g.y},pm);node.x=pos.x;node.y=pos.y;
  const direction=worldToParent({x:pm.tx-Math.cos(g.angle),y:pm.ty-Math.sin(g.angle)},pm);node.rotation=Math.atan2(direction.y,direction.x)-Math.atan2(-31.7285*node.scaleY,2.54745*node.scaleX);
  art.advance(0);const elbow=art.bone((side==='left'?'Left':'Right')+' Arm Forearm').worldTransform();
  assert.ok(Math.hypot(elbow.tx-(sm.tx+g.upper.x*134.5048),elbow.ty-(sm.ty+g.upper.y*134.5048))<.15,'actual Rive elbow must follow camera upper-arm direction in raised AND lowered poses');
  sm.delete();pm.delete();elbow.delete();
 }
}
machine.delete();art.delete();inst.unref();f.unref();
console.log('PASS: mirrored mapping, stable hand identity, lost detection, reach limits, smoothing, and actual Rive parent-space targets');
