import assert from 'node:assert/strict';
import {headPointer,rigPointer,clientPointer,facePointer,PointerMotion} from './pointer-mapping.mjs';
assert.deepEqual(facePointer({x:.5,y:.4},{x:.5,y:.4,span:.2}),{x:0,y:0});
const moved=facePointer({x:.55,y:.45},{x:.5,y:.4,span:.2});
assert.ok(Math.abs(moved.x-.5)<1e-8&&Math.abs(moved.y-.5)<1e-8);
assert.ok(facePointer({x:.6,y:.3},{x:.5,y:.4,span:.2},{flipX:true}).x<0);
const turn=facePointer({x:.5,y:.4,yaw:.175,pitch:-.15},{x:.5,y:.4,span:.2,yaw:0,pitch:0});
assert.equal(turn.x,.5,'turning in place drives the authored pointer');
assert.equal(turn.y,-.5,'pitch drives the pointer without translating the face');
assert.deepEqual(headPointer(0,0),{x:250,y:154});
assert.deepEqual(headPointer(1,-1),{x:310,y:109});
assert.deepEqual(headPointer(-5,8),{x:190,y:199});
assert.deepEqual(headPointer(NaN,Infinity),{x:250,y:154});
const bounds={minX:0,minY:0,maxX:500,maxY:500};
assert.deepEqual(rigPointer(0,0,{x:250,y:154},bounds),{x:250,y:154},'keep authored translation neutral');
assert.deepEqual(rigPointer(-1,-1,{x:250,y:154},bounds),{x:0,y:0});
assert.deepEqual(rigPointer(1,1,{x:250,y:154},bounds),{x:500,y:500},'reach the same full range as editor pointer');
assert.deepEqual(clientPointer(500,350,{left:0,top:100,width:1000,height:500},bounds),{x:250,y:250},'letterboxing must not offset mouse coordinates');
assert.equal(clientPointer(0,0,{left:0,top:0,width:0,height:0},bounds),null);
console.log('PASS: head centering, axis direction, clamp, invalid input and contain-fit mouse mapping');
for(const rate of [24,30,60]){
  const motion=new PointerMotion();let previous=0;
  for(let i=0;i<rate*2;i++){
    const p=motion.update(1,-1,1/rate);
    assert.ok(p.x>=previous-1e-9&&p.x<=1,'step stays monotonic without overshoot');
    assert.ok(p.x-previous<=6/rate+1e-8,'camera jumps remain bounded by elapsed time');previous=p.x;
  }
  assert.ok(motion.x>.98&&motion.y<-.98,'motion settles across camera rates');
  for(let i=0;i<rate*2;i++)motion.update(0,0,1/rate);
  assert.ok(Math.abs(motion.x)<.02,'capture stop returns smoothly to neutral');
}
const quiet=new PointerMotion();for(let i=0;i<120;i++)quiet.update(i%2?.005:-.005,0,1/30);
assert.equal(quiet.x,0,'small camera noise does not shake the rig');
console.log('PASS: smooth pointer steps, no overshoot, neutral return and noise rejection at 24/30/60 Hz');
