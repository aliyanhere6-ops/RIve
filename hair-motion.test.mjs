import assert from 'node:assert/strict';
import {HairMotion} from './hair-motion.mjs';
function sample(fps,voice){const hair=new HairMotion();let sum=0,max=0;for(let i=0;i<fps*8;i++){const state=hair.update(1/fps,i/fps,{voice});assert.ok(Number.isFinite(state.rotation));max=Math.max(max,Math.abs(state.rotation));if(i>fps*2)sum+=state.rotation**2;}return {rms:Math.sqrt(sum/(fps*6)),max,hair};}
const idle=sample(30,0),speaking=sample(30,1);
assert.ok(idle.rms>0,'idle hair must move without camera or audio');
assert.ok(speaking.rms>idle.rms*1.2,'speech should increase hair movement');
assert.ok(speaking.max<.065,'hair rotation stays inside a small safe range');
assert.ok(Math.abs(sample(15,1).rms-sample(60,1).rms)<.002,'spring behavior should survive variable frame rates');
let state;for(let i=0;i<180;i++)state=speaking.hair.update(1/30,8+i/30,{enabled:false});
assert.ok(Math.abs(state.rotation)<.0001&&Math.abs(state.y)<.001,'disabling gently settles hair to rest');
const turning=new HairMotion();let turnMotion=0;for(let i=0;i<90;i++){const result=turning.update(1/30,i/30,{head:i<15?0:.8});turnMotion=Math.max(turnMotion,Math.abs(result.rotation));}
assert.ok(turnMotion>.006&&turnMotion<.065,'head turns visibly sway hair while staying controlled');
console.log('PASS: idle motion, speech response, bounded rotation, frame-rate stability, settle to rest');
