import assert from 'node:assert/strict';
import {eyeGaze,handTargets,colorNumber,armReach,HandMotion} from './detail-tracking.mjs';
assert.equal(colorNumber('#123abc'),0xff123abc);
assert.throws(()=>colorNumber('red'));
assert.equal(eyeGaze([]),null);
const points=Array.from({length:478},()=>({x:.5,y:.5}));
for(const [a,b,t,d,i] of [[33,133,159,145,468],[362,263,386,374,473]]){
  points[a]={x:.4,y:.5};points[b]={x:.6,y:.5};points[t]={x:.5,y:.47};points[d]={x:.5,y:.53};points[i]={x:.5,y:.5};
}
assert.deepEqual(eyeGaze(points),{left:{x:0,y:0},right:{x:0,y:0}});
points[468].x=.52;assert.ok(eyeGaze(points).right.x>0);
assert.equal(eyeGaze(points,{eyeBlinkRight:.9}).right,null,'blink must not fling the iris');
const hand=Array.from({length:21},()=>({x:.2,y:.7}));hand[9]={x:.2,y:.6};
const result={landmarks:[hand],handedness:[[{categoryName:'Left',score:.9}]]};
const a=handTargets(result,{x:.5,y:.4,span:.2});
const b=handTargets(result,{x:.5,y:.4,span:.2},{flipX:true});
assert.ok(a.right&&b.left);assert.equal(a.right.x+b.left.x,500,'mirroring position and identity stay together');
assert.deepEqual(handTargets(null,{span:.2}),{left:null,right:null});
console.log('PASS: iris direction, blink suppression, hand identity/mirroring, background ARGB');
const shoulder={x:200,y:250};
for(const point of [{x:-999,y:-999},{x:200,y:250},{x:900,y:900}]){
  const p=armReach(point,shoulder),distance=Math.hypot(p.x-200,p.y-250);
  assert.ok(distance>=64.99&&distance<=235.01,'hand remains within IK chain reach');
}
for(const rate of [24,30,60]){
  const motion=new HandMotion(0,0);let last=0;
  for(let i=0;i<rate*2;i++){const p=motion.update({x:200,y:100},1/rate);assert.ok(p.x>=last&&p.x<=200.01);last=p.x;}
  assert.ok(motion.x>199,'hand settles without overshoot');
  for(let i=0;i<rate*2;i++)motion.update({x:0,y:0},1/rate,false);
  assert.ok(motion.x<1,'tracking loss returns softly to rest');
}
console.log('PASS: arm reach, bounded hand response, no overshoot and smooth rest at 24/30/60 Hz');
