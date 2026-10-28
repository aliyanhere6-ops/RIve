import fs from 'node:fs';import assert from 'node:assert/strict';
globalThis.document={createElement:()=>({getContext:()=>null})};
const {default:init}=await import('./vendor/canvas_advanced.mjs');const runtime=await init({wasmBinary:fs.readFileSync('vendor/runtime.wasm')});
const file=await runtime.load(fs.readFileSync('vtuber.riv'));assert.ok(file,'updated Rive export loads');
const artboard=file.artboardByName('character'),instance=file.viewModelByName('main ').instanceByName('Room');
for(const key of ['visemes','Expressions','poses','sizing ','xy'])assert.ok(instance.number(key),'existing binding '+key);
for(const name of ['body','Hair Motion','Head Pointer Target'])assert.ok(artboard.node(name),'existing rig node '+name);
const names=['idle ','L','R','Th','Fv','Ch.j.Sh','DGKNSTXYZ','A E I','Ee','Uh H Ah','O','Oo Uu W','Oo Uu W 2','wink ','shoking ','Angry'];
for(const name of ['RESET',...names])assert.ok(artboard.animationByName(name),'existing mouth animation '+name);
const machine=new runtime.StateMachineInstance(artboard.stateMachineByName('State Machine 1'),artboard);artboard.bindViewModelInstance(instance);machine.bindViewModelInstance(instance);
instance.number('xy').value=1;instance.number('visemes').value=7;
const reset=new runtime.LinearAnimationInstance(artboard.animationByName('RESET'),artboard),mouth=new runtime.LinearAnimationInstance(artboard.animationByName('A E I'),artboard);
for(const [name,expected]of [['Guide','guide 1'],['hey','hey 1'],['peace sign','peace sign 1'],['perfect','perfect'],['win','winning ']]){
 const trigger=instance.trigger(name);assert.ok(trigger,'pose binding '+name);trigger.trigger();let reached=false,returned=false;
 for(let i=0;i<750;i++){
  machine.pointerMove(270,150,1);reset.time=0;reset.apply(1);machine.advanceAndApply(.02);mouth.time=0;mouth.apply(1);artboard.advance(.02);
  for(let j=0;j<machine.stateChangedCount();j++){const state=machine.stateChangedNameByIndex(j);if(state===expected)reached=true;if(reached&&state==='still')returned=true;}
 }
 assert.ok(reached,name+' reaches authored pose');assert.ok(returned,name+' returns to rest');
 assert.equal(instance.number('visemes').value,7,'pose preserves lip binding');assert.equal(instance.number('xy').value,1,'pose preserves neutral legacy head binding');
}
reset.delete();mouth.delete();machine.delete();artboard.delete();instance.unref();file.unref();console.log('PASS: all five pose triggers complete with existing mouth/head bindings and rig nodes intact');
