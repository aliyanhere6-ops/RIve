import assert from 'node:assert/strict';
import {eyeGaze,handTargets,colorNumber} from './detail-tracking.mjs';
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
