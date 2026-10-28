import fs from 'node:fs';import assert from 'node:assert/strict';import {CAMERA_RIG,rigPointer} from './pointer-mapping.mjs';
globalThis.document={createElement:()=>({getContext:()=>null})};const{default:init}=await import('./vendor/canvas_advanced.mjs');const r=await init({wasmBinary:fs.readFileSync('vendor/runtime.wasm')});
const f=await r.load(fs.readFileSync('vtuber.riv')),a=f.artboardByName('character'),v=f.viewModelByName('main ').instanceByName('Room'),m=new r.StateMachineInstance(a.stateMachineByName('State Machine 1'),a);a.bindViewModelInstance(v);m.bindViewModelInstance(v);v.number('xy').value=1;v.number('poses').value=0;v.number('sizing ').value=0;
const reset=new r.LinearAnimationInstance(a.animationByName('RESET'),a),mouth=new r.LinearAnimationInstance(a.animationByName('idle '),a);m.advanceAndApply(0);a.advance(0);
for(const sample of JSON.parse(fs.readFileSync('tracking-rig-baseline.json','utf8')).samples){
 for(let i=0;i<90;i++){m.pointerMove(sample.point.x,sample.point.y,1);reset.time=0;reset.apply(1);m.advanceAndApply(1/60);mouth.time=0;mouth.apply(1);a.advance(1/60);}
 const pointer=a.node('Head Pointer Target');assert.ok(Math.abs(pointer.x-sample.point.x)<.01&&Math.abs(pointer.y-sample.point.y)<.01,'camera pointer must remain inside the authored listener even at bottom corners');
 for(const[name,expected]of Object.entries(sample.nodes)){const t=a.node(name).worldTransform(),actual=[t.xx,t.xy,t.yx,t.yy,t.tx,t.ty];t.delete();actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<.002,name+' must match original rig at '+JSON.stringify(sample.point)+' matrix component '+index+': '+value+' vs '+expected[index]));}
}
assert.deepEqual(rigPointer(0,0,CAMERA_RIG.center,CAMERA_RIG.bounds),{x:250,y:154});assert.equal(rigPointer(0,1,CAMERA_RIG.center,CAMERA_RIG.bounds).y,499,'background/artboard growth must not change camera travel');
reset.delete();mouth.delete();m.delete();a.delete();v.unref();f.unref();console.log('PASS: body and head transforms match original pre-hand rig across all pointer directions; downward travel never freezes');
