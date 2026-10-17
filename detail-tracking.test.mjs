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
const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
pose[11]={x:.7,y:.4,visibility:1};pose[12]={x:.3,y:.4,visibility:1};
pose[13]={x:.75,y:.6,visibility:1};pose[14]={x:.25,y:.6,visibility:1};
pose[15]={x:.8,y:.8,visibility:1};pose[16]={x:.2,y:.8,visibility:1};
const a=handTargets(result,pose);
const b=handTargets(result,pose,{flipX:true});
assert.ok(a.right&&b.left);assert.equal(a.right.x,-b.left.x,'mirroring position and identity stay together');
assert.equal(a.right.y,b.left.y);assert.equal(a.right.relative,true);
const wrongLabel=structuredClone(result);wrongLabel.handedness[0][0].categoryName='Right';
assert.deepEqual(handTargets(wrongLabel,pose),a,'mirrored detector labels cannot swap arms');
const translated=pose.map(p=>({...p,x:p.x+.05,y:p.y+.03}));
const movedHand=structuredClone(result);movedHand.landmarks[0]=hand.map(p=>({...p,x:p.x+.05,y:p.y+.03}));
const moved=handTargets(movedHand,translated);
assert.ok(Math.abs(moved.right.x-a.right.x)<1e-6&&Math.abs(moved.right.y-a.right.y)<1e-6,'body translation cannot drag the arm target away from its shoulder');
assert.deepEqual(handTargets(null,null),{left:null,right:null});
assert.ok(handTargets(null,pose).right,'visible body wrist can bridge a missed palm detection');
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
