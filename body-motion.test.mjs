import assert from 'node:assert/strict';import{BodyMotion}from'./body-motion.mjs';
for(const fps of [15,24,30,60]){
 const b=new BodyMotion();let previous=0;
 for(let i=0;i<fps*2;i++){const o=b.update(1/fps,{enabled:true,x:1,y:1,roll:1});assert.ok(o.x>=previous-1e-9&&o.x<=12+.001,'step must never bounce');assert.ok(o.y<=6+.001&&o.rotation<=.1+.001);previous=o.x;}
 assert.ok(Math.abs(previous-12)<.001);
 const before=b.axes.x.value;const first=b.update(1/fps,{enabled:false});assert.ok(first.x<before&&first.x>before*.8,'stopping must ease toward rest');
 for(let i=0;i<fps*2;i++)b.update(1/fps,{enabled:false});assert.ok(Math.abs(b.axes.x.value)<.001,'camera loss settles to neutral');
}
const b=new BodyMotion();for(let i=0;i<120;i++)b.update(1/60,{enabled:true,x:Math.sin(i)*.007,y:Math.cos(i)*.008,roll:Math.sin(i)*.008});assert.ok(Math.abs(b.axes.x.value)<.001&&Math.abs(b.axes.rotation.value)<.001,'shoulder landmark noise must not shake the avatar');
const first=new BodyMotion().update(1/60,{enabled:true,x:1});const oldFirst=12*(1-Math.exp(-(1/60)/.16));assert.ok(first.x<oldFirst*.25,'motion onset removes the old position jump');
const samples=[24,30,60].map(fps=>{const b=new BodyMotion();let o;for(let i=0;i<fps/2;i++)o=b.update(1/fps,{enabled:true,x:1,roll:1});return o;});for(const o of samples)assert.ok(Math.abs(o.x-samples[0].x)<1e-8,'same response at different render rates');
console.log('PASS: smooth onset, no bounce, neutral return, noise rejection, and frame-rate-independent body movement');
