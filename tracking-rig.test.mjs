import fs from 'node:fs';import assert from 'node:assert/strict';import{cameraPointerRig,rigPointer,PointerMotion}from'./pointer-mapping.mjs';
globalThis.document={createElement:()=>({getContext:()=>null})};const{default:init}=await import('./vendor/canvas_advanced.mjs');const runtime=await init({wasmBinary:fs.readFileSync('vendor/runtime.wasm')});
const file=await runtime.load(fs.readFileSync('vtuber.riv'));
function rig(){const a=file.artboardByName('character'),v=file.viewModelByName('main ').instanceByName('Room'),m=new runtime.StateMachineInstance(a.stateMachineByName('State Machine 1'),a);a.bindViewModelInstance(v);m.bindViewModelInstance(v);v.number('xy').value=1;v.number('poses').value=0;v.number('sizing ').value=0;const reset=new runtime.LinearAnimationInstance(a.animationByName('RESET'),a);m.advanceAndApply(0);a.advance(0);return{a,v,m,reset,pointer:a.node('Head Pointer Target')};}
const camera=rig(),editor=rig();assert.equal(camera.a.isAliasOf(editor.a),false);const profile=cameraPointerRig(camera.a.bounds,{x:camera.pointer.x,y:camera.pointer.y}),smooth=new PointerMotion();
for(const[x,y]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,1],[1,1],[1,-1],[-1,-1],[0,0]]){
 for(let frame=0;frame<90;frame++){
  const normalized=smooth.update(x,y,1/60),point=rigPointer(normalized.x,normalized.y,profile.center,profile.bounds);
  camera.m.pointerMove(point.x,point.y,1);editor.pointer.x=point.x;editor.pointer.y=point.y;
  for(const r of[camera,editor]){r.reset.time=0;r.reset.apply(1);r.m.advanceAndApply(1/60);r.a.advance(1/60);}
  assert.ok(Math.abs(camera.pointer.x-point.x)<.01&&Math.abs(camera.pointer.y-point.y)<.01,'face-driven cursor must keep updating at every edge and corner');
  for(const name of['body','Hair Motion']){const a=camera.a.node(name).worldTransform(),b=editor.a.node(name).worldTransform();for(const key of['xx','xy','yx','yy','tx','ty'])assert.ok(Math.abs(a[key]-b[key])<.002,'camera must match the authored editor pointer rig: '+name+' '+key);a.delete();b.delete();}
 }
}
assert.ok(Math.abs(camera.pointer.x-profile.center.x)<.02&&Math.abs(camera.pointer.y-profile.center.y)<.02,'return to authored neutral');
for(const r of[camera,editor]){r.reset.delete();r.m.delete();r.a.delete();r.v.unref();}file.unref();console.log('PASS: smoothed camera motion matches direct Rive target movement across all directions, corners, reversals and neutral return');
